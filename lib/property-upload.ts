"use client";

import { createClient } from "@/lib/supabase/client";
import { STORAGE_BUCKETS } from "@/lib/constants";

export interface PropertyUploadResult {
  url: string | null;
  path?: string | null;
  error?: string;
}

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

/**
 * Mengunggah foto properti ke Supabase Storage bucket 'property-images'.
 * Path yang dihasilkan: properties/{userId}/{timestamp}-{cleanName}.{ext}
 * Sesuai dengan RLS policy storage_prop_images_insert di 0001_init.sql.
 */
export async function uploadPropertyImage(
  file: File,
  opts: { maxMb?: number } = {}
): Promise<PropertyUploadResult> {
  const maxMb = opts.maxMb ?? 3;

  if (!file.type.startsWith("image/") || !ALLOWED_TYPES[file.type]) {
    return { url: null, error: "Format file tidak didukung. Harap unggah gambar JPG, PNG, atau WebP." };
  }

  if (file.size > maxMb * 1024 * 1024) {
    return { url: null, error: `Ukuran file terlalu besar. Maksimal ${maxMb} MB.` };
  }

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { url: null, error: "Sesi Anda telah berakhir. Silakan login kembali." };
  }

  const ext = ALLOWED_TYPES[file.type] ?? "jpg";
  const cleanName = file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .substring(0, 30);
  
  // Policy RLS mewajibkan folder pertama adalah 'properties'
  const path = `properties/${user.id}/${Date.now()}-${cleanName}.${ext}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKETS.propertyImages)
    .upload(path, file, {
      contentType: file.type,
      upsert: false
    });

  if (error) {
    return { url: null, error: `Gagal mengunggah foto: ${error.message}` };
  }

  const {
    data: { publicUrl }
  } = supabase.storage.from(STORAGE_BUCKETS.propertyImages).getPublicUrl(path);

  return { url: publicUrl, path };
}
