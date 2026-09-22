// ============================================================================
// Helper media server: signed URL utk file privat (bucket tenant-docs,
// payment-proofs, ticket-photos). Hanya boleh dipakai server-side.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";

const TTL_SECONDS = 300; // 5 menit — cukup utk render gambar / preview dokumen di halaman

export const PRIVATE_DOCUMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
]);

export const MAX_PRIVATE_DOCUMENT_BYTES = 5 * 1024 * 1024; // 5 MB, konservatif untuk KTP / dokumen kontrak

export function validatePrivateDocumentFile(file: File): string | null {
  if (!file || file.size <= 0) return "File kosong tidak dapat diunggah.";
  if (!PRIVATE_DOCUMENT_TYPES.has(file.type)) {
    return "Format file tidak didukung. Gunakan JPG, PNG, WEBP, atau PDF.";
  }
  if (file.size > MAX_PRIVATE_DOCUMENT_BYTES) {
    return "Ukuran file terlalu besar. Maksimal 5 MB untuk dokumen KTP/kontrak.";
  }

  const safeName = file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .slice(0, 40);

  if (!safeName.trim()) {
    return "Nama file tidak valid untuk dokumen identitas.";
  }

  return null;
}

export function buildPrivateDocumentPath(ownerKey: string, prefix: string, file: File): string {
  const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1] || "bin";
  const safePrefix = prefix.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/-+/g, "-").slice(0, 32) || "doc";
  return `${ownerKey}/${safePrefix}-${Date.now()}.${ext}`;
}

export async function deleteStoragePath(bucket: string, path: string | null | undefined): Promise<boolean> {
  if (!path) return true;
  const admin = createAdminClient();
  if (!admin) return false;
  const { error } = await admin.storage.from(bucket).remove([path]);
  return !error;
}

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
