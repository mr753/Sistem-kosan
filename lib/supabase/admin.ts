import { createClient } from "@supabase/supabase-js";

/**
 * Klien admin (service role) — HANYA untuk server (Server Components,
 * Server Actions, Route Handlers). TIDAK pernah diimpor dari komponen client.
 * Dipakai utk membuat signed URL storage & notifikasi lintas-user.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY belum diisi di .env (lihat .env.example)");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
