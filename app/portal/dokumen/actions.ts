"use server";

import { createClient } from "@/lib/supabase/server";
import { STORAGE_BUCKETS } from "@/lib/constants";
import { signPath } from "@/lib/media";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

/**
 * Signed URL KTP milik penyewa yang sedang login (view-only).
 * Scope ditegakkan berlapis: RLS tenants_select_self membatasi baris yang
 * terbaca, lalu server memaksa .eq("user_id", user.id) — penyewa tidak akan
 * pernah menerima signed URL KTP penyewa lain. Tidak ada upload/delete di
 * portal: data KTP tetap dikelola pengelola kos.
 */
export async function getMyIdCardSignedUrlAction(): Promise<
  ActionResult<{ url: string | null; exists: boolean }>
> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Sesi telah berakhir. Silakan login kembali." };
  }

  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("id, user_id, id_card_url")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return { ok: false, error: "Gagal memuat data KTP. Coba lagi beberapa saat." };
  }
  if (!tenant || !tenant.id_card_url) {
    return { ok: true, data: { url: null, exists: false } };
  }

  const url = await signPath(STORAGE_BUCKETS.tenantDocs, tenant.id_card_url);
  if (!url) {
    return { ok: false, error: "Gagal membuka KTP. Coba lagi beberapa saat." };
  }
  return { ok: true, data: { url, exists: true } };
}

/**
 * Signed URL dokumen kontrak milik penyewa yang sedang login (view-only).
 * .eq("tenant_id", tenant.id) memastikan hanya kontrak miliknya sendiri yang
 * bisa ditandatangani — kontrak penyewa lain tidak pernah tersentuh.
 */
export async function getMyContractDocumentSignedUrlAction(
  contractId: string
): Promise<ActionResult<{ url: string | null; exists: boolean }>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Sesi telah berakhir. Silakan login kembali." };
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!tenant) {
    return { ok: false, error: "Akun Anda belum terhubung ke profil penyewa." };
  }

  const { data: contract, error } = await supabase
    .from("contracts")
    .select("id, tenant_id, contract_doc_url")
    .eq("id", contractId)
    .eq("tenant_id", tenant.id)
    .maybeSingle();

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
