"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { STORAGE_BUCKETS } from "@/lib/constants";
import { buildPrivateDocumentPath, deleteStoragePath, signPath, validatePrivateDocumentFile } from "@/lib/media";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";
import type { ContractStatus, BillingCycle } from "@/lib/constants";
import type { ContractWithDetails } from "@/lib/types";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export interface ContractInput {
  tenant_id: string;
  property_id: string;
  room_id: string;
  start_date: string;
  end_date?: string | null;
  due_day: number;
  billing_cycle: BillingCycle;
  rent_amount: number;
  deposit_amount: number;
  status: ContractStatus;
  notes?: string | null;
}

const CONTRACT_STATUSES: ContractStatus[] = ["active", "expired", "terminated"];
const BILLING_CYCLES: BillingCycle[] = ["daily", "monthly", "yearly"];

/**
 * Validasi sesi user dan role pemilik kos / super admin.
 * (Pola sama dengan requirePropertyOwner / requireTenantManager)
 */
async function requireContractManager() {
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
    return { ok: false as const, error: "Anda tidak memiliki izin untuk mengelola kontrak." };
  }

  return { ok: true as const, supabase, user, role: profile.role };
}

/** Validasi input kontrak (server-side, bukan hanya client). Return pesan error atau null. */
function validateContractInput(input: ContractInput): string | null {
  if (!input.tenant_id) return "Penyewa wajib dipilih.";
  if (!input.property_id) return "Properti wajib dipilih.";
  if (!input.room_id) return "Kamar wajib dipilih.";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.start_date)) {
    return "Tanggal mulai tidak valid.";
  }
  if (input.end_date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.end_date)) {
      return "Tanggal berakhir tidak valid.";
    }
    if (input.end_date < input.start_date) {
      return "Tanggal berakhir tidak boleh sebelum tanggal mulai.";
    }
  }

  const dueDay = Number(input.due_day);
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) {
    return "Tanggal jatuh tempo harus angka 1 sampai 28.";
  }

  if (!BILLING_CYCLES.includes(input.billing_cycle)) {
    return "Siklus pembayaran tidak valid.";
  }

  if (!Number.isFinite(Number(input.rent_amount)) || Number(input.rent_amount) < 0) {
    return "Harga sewa tidak boleh negatif.";
  }
  if (!Number.isFinite(Number(input.deposit_amount)) || Number(input.deposit_amount) < 0) {
    return "Deposit tidak boleh negatif.";
  }

  if (!CONTRACT_STATUSES.includes(input.status)) {
    return "Status kontrak tidak valid.";
  }

  return null;
}

/**
 * Ambil kontrak (dalam scope RLS) + relasi ringkas + jumlah invoice.
 * Scope ditegakkan RLS: landlord hanya melihat kontrak propertinya.
 */
export async function getContractsWithDetails(): Promise<ContractWithDetails[]> {
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

  const { data: contracts, error } = await supabase
    .from("contracts")
    .select(
      "*, tenants(id, full_name), rooms(id, room_number), properties(id, name)"
    )
    .order("created_at", { ascending: false });

  if (error || !contracts || contracts.length === 0) return [];

  const contractIds = (contracts as ContractWithDetails[]).map((c) => c.id);

  // Hitung dependensi invoice (untuk peringatan delete) — 1 query, bukan N+1
  const { data: invoiceRows } = await supabase
    .from("invoices")
    .select("contract_id")
    .in("contract_id", contractIds);

  const invoiceCount: Record<string, number> = {};
  for (const row of invoiceRows ?? []) {
    invoiceCount[row.contract_id] = (invoiceCount[row.contract_id] ?? 0) + 1;
  }

  return (contracts as ContractWithDetails[]).map((c) => ({
    ...c,
    invoice_count: invoiceCount[c.id] ?? 0
  }));
}

export interface ContractFormData {
  tenants: { id: string; full_name: string }[];
  properties: { id: string; name: string }[];
  rooms: { id: string; property_id: string; room_number: string }[];
  activeContractRoomIds: string[];
}

/** Data dropdown form kontrak (penyewa, properti, kamar) dalam scope masing-masing. */
export async function getContractFormData(): Promise<ContractFormData> {
  const supabase = await createClient();
  const empty: ContractFormData = { tenants: [], properties: [], rooms: [], activeContractRoomIds: [] };

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "landlord" && profile?.role !== "super_admin") return empty;

  const [tenantsRes, propsRes, roomsRes, activeContractsRes] = await Promise.all([
    supabase.from("tenants").select("id, full_name").order("full_name", { ascending: true }),
    supabase.from("properties").select("id, name").order("name", { ascending: true }),
    supabase
      .from("rooms")
      .select("id, property_id, room_number")
      .order("room_number", { ascending: true }),
    supabase.from("contracts").select("room_id").eq("status", "active")
  ]);

  return {
    tenants: (tenantsRes.data ?? []) as { id: string; full_name: string }[],
    properties: (propsRes.data ?? []) as { id: string; name: string }[],
    rooms: (roomsRes.data ?? []) as { id: string; property_id: string; room_number: string }[],
    activeContractRoomIds: ((activeContractsRes.data ?? []) as { room_id: string }[]).map((r) => r.room_id)
  };
}

/**
 * Sinkronisasi status kamar (solusi minimal tanpa migration/trigger):
 * hitung ulang status kamar dari kontrak aktif yang ada.
 * - Ada kontrak aktif  -> occupied
 * - Tidak ada kontrak  -> vacant (kecuali sedang maintenance: dipertahankan)
 */
async function syncRoomStatus(supabase: Awaited<ReturnType<typeof createClient>>, roomIds: string[]) {
  const uniqueIds = [...new Set(roomIds)].filter(Boolean);
  if (uniqueIds.length === 0) return;

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, status")
    .in("id", uniqueIds);

  const { data: activeContracts } = await supabase
    .from("contracts")
    .select("room_id")
    .in("room_id", uniqueIds)
    .eq("status", "active");

  const roomsWithActiveContract = new Set((activeContracts ?? []).map((c) => c.room_id));

  for (const room of rooms ?? []) {
    const hasActive = roomsWithActiveContract.has(room.id);
    if (hasActive && room.status !== "occupied") {
      await supabase.from("rooms").update({ status: "occupied" }).eq("id", room.id);
    } else if (!hasActive && room.status === "occupied") {
      // Kamar sempat occupied namun tak lagi punya kontrak aktif -> kembali kosong.
      // Status 'maintenance' tidak pernah diubah otomatis (dipertahankan).
      await supabase.from("rooms").update({ status: "vacant" }).eq("id", room.id);
    }
  }
}

/** Pesan ramah utk pelanggaran constraint DB yang diketahui. */
function friendlyError(message: string, fallback: string): string {
  if (message.includes("one_active_contract_per_room")) {
    return "Kamar ini sudah memiliki kontrak aktif. Nonaktifkan kontrak lama terlebih dahulu.";
  }
  if (message.includes("duplicate key")) {
    return "Data sudah ada atau bentrok dengan data lain.";
  }
  return `${fallback}: ${message}`;
}

/** Membuat kontrak baru. */
export async function createContractAction(input: ContractInput): Promise<ActionResult<{ id: string }>> {
  const auth = await requireContractManager();
  if (!auth.ok) return auth;

  const validationError = validateContractInput(input);
  if (validationError) return { ok: false, error: validationError };

  // Relasi harus valid & dalam scope (RLS menegakkan):
  // - room harus milik property yang dipilih
  // - tenant harus ada
  const { data: room, error: roomError } = await auth.supabase
    .from("rooms")
    .select("id, property_id")
    .eq("id", input.room_id)
    .eq("property_id", input.property_id)
    .single();

  if (roomError || !room) {
    return { ok: false, error: "Kamar tidak ditemukan pada properti yang dipilih." };
  }

  const { data: tenant, error: tenantError } = await auth.supabase
    .from("tenants")
    .select("id")
    .eq("id", input.tenant_id)
    .single();

  if (tenantError || !tenant) {
    return { ok: false, error: "Penyewa tidak ditemukan." };
  }

  // Kontrak ACTIVE tidak boleh bertabrakan dgn kontrak aktif lain pada kamar yang sama
  if (input.status === "active") {
    const { data: conflict } = await auth.supabase
      .from("contracts")
      .select("id")
      .eq("room_id", input.room_id)
      .eq("status", "active")
      .maybeSingle();
    if (conflict) {
      return { ok: false, error: "Kamar ini sudah memiliki kontrak aktif. Nonaktifkan kontrak lama terlebih dahulu." };
    }
  }

  const { data, error } = await auth.supabase
    .from("contracts")
    .insert({
      tenant_id: input.tenant_id,
      property_id: input.property_id,
      room_id: input.room_id,
      start_date: input.start_date,
      end_date: input.end_date || null,
      due_day: Number(input.due_day),
      billing_cycle: input.billing_cycle,
      rent_amount: Number(input.rent_amount),
      deposit_amount: Number(input.deposit_amount),
      status: input.status,
      notes: (input.notes || "").trim() || null
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: friendlyError(error.message, "Gagal menyimpan kontrak") };
  }

  await syncRoomStatus(auth.supabase, [input.room_id]);

  await logActivity(
    {
      action: "create",
      entityType: "contract",
      entityId: data.id,
      propertyId: input.property_id,
      description: "Membuat kontrak baru",
      metadata: { status: input.status, billing_cycle: input.billing_cycle }
    },
    auth.supabase
  );

  revalidatePath("/contracts");
  revalidatePath("/rooms");
  revalidatePath("/dashboard");
  return { ok: true, data: { id: data.id } };
}

/** Memperbarui kontrak yang sudah ada. */
export async function updateContractAction(id: string, input: ContractInput): Promise<ActionResult> {
  const auth = await requireContractManager();
  if (!auth.ok) return auth;

  const validationError = validateContractInput(input);
  if (validationError) return { ok: false, error: validationError };

  // Pastikan kontrak ada & dalam scope sebelum mengecek perubahan kamar/status
  const { data: existing, error: existingError } = await auth.supabase
    .from("contracts")
    .select("id, room_id, status, property_id")
    .eq("id", id)
    .single();

  if (existingError || !existing) {
    return { ok: false, error: "Kontrak tidak ditemukan atau Anda tidak memiliki akses." };
  }

  const { data: room, error: roomError } = await auth.supabase
    .from("rooms")
    .select("id, property_id")
    .eq("id", input.room_id)
    .eq("property_id", input.property_id)
    .single();

  if (roomError || !room) {
    return { ok: false, error: "Kamar tidak ditemukan pada properti yang dipilih." };
  }

  // Jika kamar berubah dan kontrak AKTIF, kamar baru tidak boleh sudah punya kontrak aktif
  if (input.status === "active" && existing.room_id !== input.room_id) {
    const { data: conflict } = await auth.supabase
      .from("contracts")
      .select("id")
      .eq("room_id", input.room_id)
      .eq("status", "active")
      .neq("id", id)
      .maybeSingle();
    if (conflict) {
      return { ok: false, error: "Kamar ini sudah memiliki kontrak aktif. Nonaktifkan kontrak lama terlebih dahulu." };
    }
  }

  const { error } = await auth.supabase
    .from("contracts")
    .update({
      tenant_id: input.tenant_id,
      property_id: input.property_id,
      room_id: input.room_id,
      start_date: input.start_date,
      end_date: input.end_date || null,
      due_day: Number(input.due_day),
      billing_cycle: input.billing_cycle,
      rent_amount: Number(input.rent_amount),
      deposit_amount: Number(input.deposit_amount),
      status: input.status,
      notes: (input.notes || "").trim() || null
    })
    .eq("id", id);

  if (error) {
    return { ok: false, error: friendlyError(error.message, "Gagal memperbarui kontrak") };
  }

  // Sinkronkan status kamar lama & baru (kamar lama bisa jadi harus vacant kembali)
  await syncRoomStatus(auth.supabase, [existing.room_id, input.room_id]);

  await logActivity(
    {
      action: "update",
      entityType: "contract",
      entityId: id,
      propertyId: input.property_id,
      description: "Memperbarui kontrak",
      metadata: { status: input.status, billing_cycle: input.billing_cycle }
    },
    auth.supabase
  );

  revalidatePath("/contracts");
  revalidatePath("/rooms");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Menghapus kontrak dengan DELETE SAFETY:
 * - Kontrak yang punya invoice TIDAK boleh hard-delete — FK invoices.contract_id
 *   akan CASCADE menghapus tagihan & riwayat pembayaran.
 * - Kontrak tanpa invoice boleh dihapus (belum ada data keuangan yang menempel).
 * Untuk kontrak berjalan, gunakan Edit -> status "Dihentikan/Berakhir".
 */
export async function deleteContractAction(id: string): Promise<ActionResult> {
  const auth = await requireContractManager();
  if (!auth.ok) return auth;

  // 1. Pastikan kontrak ada & dalam scope
  const { data: contract, error: checkError } = await auth.supabase
    .from("contracts")
    .select("id, room_id, status, contract_doc_url")
    .eq("id", id)
    .single();

  if (checkError || !contract) {
    return { ok: false, error: "Kontrak tidak ditemukan atau Anda tidak memiliki akses." };
  }

  // 2. DELETE SAFETY: tolak bila sudah punya invoice (cascade berbahaya)
  const { count: invoiceCount, error: countError } = await auth.supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("contract_id", id);

  if (countError) {
    return { ok: false, error: `Gagal memeriksa tagihan: ${countError.message}` };
  }

  if (invoiceCount && invoiceCount > 0) {
    return {
      ok: false,
      error: `Kontrak tidak dapat dihapus karena sudah memiliki ${invoiceCount} tagihan. Gunakan Edit untuk mengubah status menjadi "Dihentikan" atau "Berakhir" agar riwayat pembayaran tetap utuh.`
    };
  }

  // 3. Eksekusi hapus
  const { error: deleteError } = await auth.supabase
    .from("contracts")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return { ok: false, error: friendlyError(deleteError.message, "Gagal menghapus kontrak") };
  }

  if (contract.contract_doc_url) {
    await deleteStoragePath(STORAGE_BUCKETS.tenantDocs, contract.contract_doc_url);
  }

  // 4. Sinkronkan status kamar (bila kamar tidak lagi punya kontrak aktif)
  await syncRoomStatus(auth.supabase, [contract.room_id]);

  await logActivity(
    {
      action: "delete",
      entityType: "contract",
      entityId: id,
      description: "Menghapus kontrak"
    },
    auth.supabase
  );

  revalidatePath("/contracts");
  revalidatePath("/rooms");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function getContractDocumentSignedUrlAction(contractId: string): Promise<ActionResult<{ url: string | null; exists: boolean }>> {
  const auth = await requireContractManager();
  if (!auth.ok) return auth;

  const { data: contract, error } = await auth.supabase
    .from("contracts")
    .select("id, contract_doc_url")
    .eq("id", contractId)
    .single();

  if (error || !contract) {
    return { ok: false, error: "Dokumen kontrak tidak ditemukan atau Anda tidak memiliki akses." };
  }

  if (!contract.contract_doc_url) {
    return { ok: true, data: { url: null, exists: false } };
  }

  const url = await signPath(STORAGE_BUCKETS.tenantDocs, contract.contract_doc_url);
  if (!url) {
    return { ok: false, error: "Gagal membuka dokumen kontrak. Coba lagi beberapa saat." };
  }
  return { ok: true, data: { url, exists: true } };
}

export async function uploadContractDocumentAction(contractId: string, file: File): Promise<ActionResult> {
  const auth = await requireContractManager();
  if (!auth.ok) return auth;

  const validationError = validatePrivateDocumentFile(file);
  if (validationError) return { ok: false, error: validationError };

  const { data: contract, error: contractError } = await auth.supabase
    .from("contracts")
    .select("id, contract_doc_url, tenant_id, property_id")
    .eq("id", contractId)
    .single();

  if (contractError || !contract) {
    return { ok: false, error: "Kontrak tidak ditemukan atau Anda tidak memiliki akses." };
  }

  const { data: tenant, error: tenantError } = await auth.supabase
    .from("tenants")
    .select("user_id")
    .eq("id", contract.tenant_id)
    .single();

  if (tenantError || !tenant) {
    return { ok: false, error: "Penyewa terkait tidak ditemukan." };
  }

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Konfigurasi storage tidak tersedia saat ini." };

  const folderOwner = tenant.user_id ?? contract.tenant_id;
  const nextPath = buildPrivateDocumentPath(folderOwner, "contract", file);

  const { error: uploadError } = await admin.storage
    .from(STORAGE_BUCKETS.tenantDocs)
    .upload(nextPath, file, { contentType: file.type, cacheControl: "3600", upsert: false });

  if (uploadError) {
    return { ok: false, error: `Gagal mengunggah dokumen kontrak: ${uploadError.message}` };
  }

  const { error: updateError } = await auth.supabase
    .from("contracts")
    .update({ contract_doc_url: nextPath })
    .eq("id", contractId);

  if (updateError) {
    await admin.storage.from(STORAGE_BUCKETS.tenantDocs).remove([nextPath]);
    return { ok: false, error: `Gagal menyimpan dokumen kontrak: ${updateError.message}` };
  }

  if (contract.contract_doc_url && contract.contract_doc_url !== nextPath) {
    await deleteStoragePath(STORAGE_BUCKETS.tenantDocs, contract.contract_doc_url);
  }

  await logActivity(
    {
      action: "update",
      entityType: "contract",
      entityId: contractId,
      propertyId: contract.property_id,
      description: "Mengunggah dokumen kontrak"
    },
    auth.supabase
  );

  revalidatePath("/contracts");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteContractDocumentAction(contractId: string): Promise<ActionResult> {
  const auth = await requireContractManager();
  if (!auth.ok) return auth;

  const { data: contract, error } = await auth.supabase
    .from("contracts")
    .select("id, contract_doc_url")
    .eq("id", contractId)
    .single();

  if (error || !contract) {
    return { ok: false, error: "Dokumen kontrak tidak ditemukan atau Anda tidak memiliki akses." };
  }

  if (!contract.contract_doc_url) {
    return { ok: true };
  }

  const { error: updateError } = await auth.supabase
    .from("contracts")
    .update({ contract_doc_url: null })
    .eq("id", contractId);

  if (updateError) {
    return { ok: false, error: `Gagal menghapus dokumen kontrak: ${updateError.message}` };
  }

  const removed = await deleteStoragePath(STORAGE_BUCKETS.tenantDocs, contract.contract_doc_url);
  if (!removed) {
    return { ok: false, error: "Dokumen kontrak di database sudah dihapus, tetapi file storage gagal dibersihkan." };
  }

  await logActivity(
    {
      action: "delete",
      entityType: "contract",
      entityId: contractId,
      description: "Menghapus dokumen kontrak"
    },
    auth.supabase
  );

  revalidatePath("/contracts");
  revalidatePath("/dashboard");
  return { ok: true };
}
