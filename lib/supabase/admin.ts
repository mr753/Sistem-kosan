import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Klien admin (service role) — HANYA untuk server (Server Components,
 * Server Actions, Route Handlers). TIDAK pernah diimpor dari komponen client.
 * Dipakai utk membuat signed URL storage & notifikasi lintas-user.
 */
export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY atau URL belum diisi. Klien admin mungkin tidak berfungsi.");
    return null;
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
