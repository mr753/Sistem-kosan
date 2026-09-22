"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Upload file privat ke Supabase Storage milik user yang sedang login.
 * Folder otomatis: <user_id>/<prefix>-<timestamp>.<ext> — pola ini cocok
 * dengan policy storage di supabase/migrations/0001_init.sql (tenant-docs,
 * payment-proofs, ticket-photos).
 */
export interface UploadResult {
  path: string | null;
  error?: string;
}

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf"
};

export async function uploadUserFile(
  bucket: string,
  prefix: string,
  file: File,
  opts: { maxMb?: number } = {}
): Promise<UploadResult> {
  const maxMb = opts.maxMb ?? 1.5;
  const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!allowed.includes(file.type)) {
    return { path: null, error: "File harus berupa gambar (JPG/PNG/WEBP) atau PDF." };
  }
  if (!file.size || file.size <= 0) {
    return { path: null, error: "File kosong tidak dapat diunggah." };
  }
  if (file.size > maxMb * 1024 * 1024) {
    return { path: null, error: `Ukuran file maksimal ${maxMb} MB.` };
  }

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { path: null, error: "Sesi berakhir. Silakan masuk lagi." };

  const ext = EXT_BY_TYPE[file.type] ?? "bin";
  const path = `${user.id}/${prefix}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) return { path: null, error: error.message };
  return { path };
}

/** Upload beberapa gambar berurutan; berhenti & kembalikan error bila gagal. */
export async function uploadUserFiles(
  bucket: string,
  prefix: string,
  files: File[]
): Promise<{ paths: string[]; error?: string }> {
  const paths: string[] = [];
  for (const f of files) {
    const res = await uploadUserFile(bucket, `${prefix}-${f.name.replace(/\.[^.]+$/, "")}`, f);
    if (!res.path) return { paths, error: res.error };
    paths.push(res.path);
  }
  return { paths };
}
