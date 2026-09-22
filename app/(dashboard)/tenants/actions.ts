"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { STORAGE_BUCKETS } from "@/lib/constants";
import { buildPrivateDocumentPath, deleteStoragePath, signPath, validatePrivateDocumentFile } from "@/lib/media";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";
import type { TenantWithStats } from "@/lib/types";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export interface TenantInput {
  full_name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  notes?: string | null;
}

/**
 * Validasi sesi user dan role pemilik kos / super admin.
 * (Pola sama dengan requirePropertyOwner di lib/actions/properties.ts)
 */
async function requireTenantManager() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false as const, error: "Sesi telah berakhir. Silakan login kembali." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAllowed = profile?.role === "landlord" || profile?.role === "super_admin";
  if (!isAllowed) {
    return { ok: false as const, error: "Anda tidak memiliki izin untuk mengelola penyewa." };
  }

  return { ok: true as const, supabase, user, role: profile.role };
}

/** Normalisasi & validasi input form penyewa. Return pesan error (Indonesia) atau null. */
function validateTenantInput(input: TenantInput): string | null {
  const fullName = (input.full_name || "").trim();
  if (fullName.length < 2) {
    return "Nama lengkap wajib diisi (minimal 2 karakter).";
  }

  const email = (input.email || "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Format email tidak valid.";
  }

  const phone = (input.phone || "").trim();
  if (phone && !/^[0-9+()-\s]{6,20}$/.test(phone)) {
    return "Nomor telepon tidak valid (6-20 digit).";
  }

  const ecPhone = (input.emergency_contact_phone || "").trim();
  if (ecPhone && !/^[0-9+()-\s]{6,20}$/.test(ecPhone)) {
    return "Nomor telepon kontak darurat tidak valid (6-20 digit).";
  }

  return null;
}

/** Bentuk payload bersih dari input (trim + null untuk kolom opsional). */
function cleanPayload(input: TenantInput) {
  return {
    full_name: (input.full_name || "").trim(),
    phone: (input.phone || "").trim() || null,
    email: (input.email || "").trim() || null,
    address: (input.address || "").trim() || null,
    emergency_contact_name: (input.emergency_contact_name || "").trim() || null,
    emergency_contact_phone: (input.emergency_contact_phone || "").trim() || null,
    notes: (input.notes || "").trim() || null
  };
}

/**
 * Ambil seluruh penyewa dalam scope RLS + ringkasan kontrak (kueri efisien, bukan N+1).
 * RLS menegakkan scope: landlord melihat penyewa yang boleh ia kelola
 * (policy tenants_select_owner via owns_any_property), super admin melihat semua —
 * tidak ada filter owner di level aplikasi karena tabel tenants tidak punya kolom owner_id.
 */
export async function getTenantsWithStats(): Promise<TenantWithStats[]> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "landlord" && profile?.role !== "super_admin") return [];

  const { data: tenants, error: tenantError } = await supabase
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: false });

  if (tenantError || !tenants || tenants.length === 0) {
    return [];
  }

  const tenantIds = tenants.map((t) => t.id);

  const { data: contracts } = await supabase
    .from("contracts")
    .select("tenant_id, status")
    .in("tenant_id", tenantIds);

  const statsByTenant: Record<string, { total: number; active: number }> = {};
  for (const t of tenantIds) {
    statsByTenant[t] = { total: 0, active: 0 };
  }
  for (const c of contracts ?? []) {
    const stats = statsByTenant[c.tenant_id];
    if (stats) {
      stats.total += 1;
      if (c.status === "active") stats.active += 1;
    }
  }

  return tenants.map((t) => ({
    ...t,
    contract_count: statsByTenant[t.id]?.total ?? 0,
    active_contract_count: statsByTenant[t.id]?.active ?? 0
  }));
}

/** Membuat penyewa baru. user_id tidak pernah diambil dari form (linking = phase berikutnya). */
export async function createTenantAction(input: TenantInput): Promise<ActionResult<{ id: string }>> {
  const auth = await requireTenantManager();
  if (!auth.ok) return auth;

  const validationError = validateTenantInput(input);
  if (validationError) return { ok: false, error: validationError };

  const { data, error } = await auth.supabase
    .from("tenants")
    .insert(cleanPayload(input))
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: `Gagal menyimpan penyewa: ${error.message}` };
  }

  await logActivity(
    {
      action: "create",
      entityType: "tenant",
      entityId: data.id,
      description: "Membuat data tenant baru",
      metadata: { tenant_name: (input.full_name || "").trim() }
    },
    auth.supabase
  );

  revalidatePath("/tenants");
  revalidatePath("/dashboard");
  return { ok: true, data: { id: data.id } };
}

/** Memperbarui data penyewa. user_id tidak boleh diubah lewat form. */
export async function updateTenantAction(id: string, input: TenantInput): Promise<ActionResult> {
  const auth = await requireTenantManager();
  if (!auth.ok) return auth;

  const validationError = validateTenantInput(input);
  if (validationError) return { ok: false, error: validationError };

  const { error } = await auth.supabase
    .from("tenants")
    .update(cleanPayload(input))
    .eq("id", id);

  if (error) {
    return { ok: false, error: `Gagal memperbarui penyewa: ${error.message}` };
  }

  await logActivity(
    {
      action: "update",
      entityType: "tenant",
      entityId: id,
      description: "Memperbarui data tenant",
      metadata: { tenant_name: (input.full_name || "").trim() }
    },
    auth.supabase
  );

  revalidatePath("/tenants");
  return { ok: true };
}

/**
 * Menghapus penyewa dengan DELETE SAFETY (pola deletePropertyAction):
 * tolak bila masih memiliki kontrak — cascade DB akan ikut menghapus kontrak &
 * invoice, jadi kami tolak di level aplikasi lebih dulu agar tidak ada data terhapus diam-diam.
 */
export async function deleteTenantAction(id: string): Promise<ActionResult> {
  const auth = await requireTenantManager();
  if (!auth.ok) return auth;

  // 1. Pastikan penyewa ada & dalam scope (RLS menegakkan);
  //    ambil sekalian path KTP untuk cleanup storage setelah delete.
  const { data: tenant, error: checkError } = await auth.supabase
    .from("tenants")
    .select("id, full_name, id_card_url")
    .eq("id", id)
    .single();
  if (checkError || !tenant) {
    return { ok: false, error: "Penyewa tidak ditemukan atau Anda tidak memiliki akses." };
  }

  // 2. DELETE SAFETY: tolak bila masih memiliki kontrak
  const { count: contractCount, error: countError } = await auth.supabase
    .from("contracts")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", id);

  if (countError) {
    return { ok: false, error: `Gagal memeriksa kontrak: ${countError.message}` };
  }

  if (contractCount && contractCount > 0) {
    return {
      ok: false,
      error: `Penyewa tidak dapat dihapus karena masih memiliki ${contractCount} kontrak. Hapus kontrak terlebih dahulu.`
    };
  }

  // 3. Eksekusi hapus penyewa
  const { error: deleteError } = await auth.supabase
    .from("tenants")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return { ok: false, error: `Gagal menghapus penyewa: ${deleteError.message}` };
  }

  await logActivity(
    {
      action: "delete",
      entityType: "tenant",
      entityId: id,
      description: "Menghapus data tenant"
    },
    auth.supabase
  );

  // 4. BEST-EFFORT CLEANUP: setelah penyewa terhapus, file KTP-nya tidak lagi
  //    tertaut ke siapa pun — hapus agar tidak menjadi orphan file.
  if (tenant.id_card_url) {
    const removed = await deleteStoragePath(STORAGE_BUCKETS.tenantDocs, tenant.id_card_url);
    if (!removed) {
      return {
        ok: false,
        error: "Penyewa berhasil dihapus, tetapi file KTP di storage gagal dibersihkan. Hapus manual melalui dashboard Supabase."
      };
    }
  }

  revalidatePath("/tenants");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Cek akses dokumen penyewa dari sisi landlord:
 * landlord hanya berhak bila penyewa memiliki kontrak di minimal SATU
 * properti miliknya (bukan sekadar "landlord memiliki properti apa pun").
 * super_admin = full access; penyewa terhubung (user_id = userId) mengakses
 * dokumennya sendiri. Scope level storage ditambahkan policy storage.
 */
async function canAccessTenantDocument(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  role: "landlord" | "super_admin",
  tenantId: string
): Promise<boolean> {
  if (role === "super_admin") return true;

  const { data: tenant } = await supabase
    .from("tenants")
    .select("user_id")
    .eq("id", tenantId)
    .single();
  if (tenant?.user_id === userId) return true;

  const { data: owned } = await supabase
    .from("properties")
    .select("id")
    .eq("owner_id", userId);

  const ownedIds = (owned ?? []).map((p) => p.id);
  if (ownedIds.length === 0) return false;

  const { count, error } = await supabase
    .from("contracts")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .in("property_id", ownedIds);

  return !error && (count ?? 0) > 0;
}

export async function getTenantIdCardSignedUrlAction(tenantId: string): Promise<ActionResult<{ url: string | null; exists: boolean }>> {
  const auth = await requireTenantManager();
  if (!auth.ok) return auth;

  const { data: tenant, error } = await auth.supabase
    .from("tenants")
    .select("id, user_id, id_card_url")
    .eq("id", tenantId)
    .single();

  if (error || !tenant) {
    return { ok: false, error: "KTP tidak ditemukan atau Anda tidak memiliki akses." };
  }

  const allowed = await canAccessTenantDocument(auth.supabase, auth.user.id, auth.role, tenantId);
  if (!allowed) {
    return { ok: false, error: "Anda tidak berhak melihat KTP penyewa ini." };
  }

  if (!tenant.id_card_url) {
    return { ok: true, data: { url: null, exists: false } };
  }

  const url = await signPath(STORAGE_BUCKETS.tenantDocs, tenant.id_card_url);
  if (!url) {
    return { ok: false, error: "Gagal membuka KTP. Coba lagi beberapa saat." };
  }
  return { ok: true, data: { url, exists: true } };
}

export async function uploadTenantIdCardAction(tenantId: string, file: File): Promise<ActionResult> {
  const auth = await requireTenantManager();
  if (!auth.ok) return auth;

  const validationError = validatePrivateDocumentFile(file);
  if (validationError) return { ok: false, error: validationError };

  const { data: tenant, error: tenantError } = await auth.supabase
    .from("tenants")
    .select("id, user_id, id_card_url")
    .eq("id", tenantId)
    .single();

  if (tenantError || !tenant) {
    return { ok: false, error: "Penyewa tidak ditemukan atau Anda tidak memiliki akses." };
  }

  const allowed = await canAccessTenantDocument(auth.supabase, auth.user.id, auth.role, tenantId);
  if (!allowed) {
    return { ok: false, error: "Anda tidak berhak mengunggah KTP penyewa ini." };
  }

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Konfigurasi storage tidak tersedia saat ini." };

  const folderOwner = tenant.user_id ?? tenant.id;
  const nextPath = buildPrivateDocumentPath(folderOwner, "ktp", file);

  const { error: uploadError } = await admin.storage
    .from(STORAGE_BUCKETS.tenantDocs)
    .upload(nextPath, file, { contentType: file.type, cacheControl: "3600", upsert: false });

  if (uploadError) {
    return { ok: false, error: `Gagal mengunggah KTP: ${uploadError.message}` };
  }

  const { error: updateError } = await auth.supabase
    .from("tenants")
    .update({ id_card_url: nextPath })
    .eq("id", tenantId);

  if (updateError) {
    await admin.storage.from(STORAGE_BUCKETS.tenantDocs).remove([nextPath]);
    return { ok: false, error: `Gagal menyimpan KTP: ${updateError.message}` };
  }

  if (tenant.id_card_url && tenant.id_card_url !== nextPath) {
    await deleteStoragePath(STORAGE_BUCKETS.tenantDocs, tenant.id_card_url);
  }

  await logActivity(
    {
      action: "update",
      entityType: "tenant",
      entityId: tenantId,
      description: "Mengunggah dokumen KTP tenant"
    },
    auth.supabase
  );

  revalidatePath("/tenants");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteTenantIdCardAction(tenantId: string): Promise<ActionResult> {
  const auth = await requireTenantManager();
  if (!auth.ok) return auth;

  const { data: tenant, error } = await auth.supabase
    .from("tenants")
    .select("id, full_name, id_card_url, user_id")
    .eq("id", tenantId)
    .single();

  if (error || !tenant) {
    return { ok: false, error: "KTP tidak ditemukan atau Anda tidak memiliki akses." };
  }

  const allowed = await canAccessTenantDocument(auth.supabase, auth.user.id, auth.role, tenantId);
  if (!allowed) {
    return { ok: false, error: "Anda tidak berhak menghapus KTP penyewa ini." };
  }

  if (!tenant.id_card_url) {
    return { ok: true };
  }

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Konfigurasi storage tidak tersedia saat ini." };

  const { error: updateError } = await auth.supabase
    .from("tenants")
    .update({ id_card_url: null })
    .eq("id", tenantId);

  if (updateError) {
    return { ok: false, error: `Gagal menghapus KTP: ${updateError.message}` };
  }

  const removed = await deleteStoragePath(STORAGE_BUCKETS.tenantDocs, tenant.id_card_url);
  if (!removed) {
    return { ok: false, error: "KTP di database sudah dihapus, tetapi file storage gagal dibersihkan." };
  }

  await logActivity(
    {
      action: "delete",
      entityType: "tenant",
      entityId: tenantId,
      description: "Menghapus dokumen KTP tenant"
    },
    auth.supabase
  );

  revalidatePath("/tenants");
  revalidatePath("/dashboard");
  return { ok: true };
}
