// ============================================================================
// Helper media server: signed URL utk file privat (bucket tenant-docs,
// payment-proofs, ticket-photos). Hanya boleh dipakai server-side.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";

const TTL_SECONDS = 300; // 5 menit — cukup utk render gambar di halaman

export async function signPath(bucket: string, path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function signPaths(bucket: string, paths: (string | null)[]): Promise<(string | null)[]> {
  return Promise.all(paths.map((p) => signPath(bucket, p)));
}
