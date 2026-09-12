"use client";

import { createBrowserClient } from "@supabase/ssr";

// Pastikan kita tidak memicu error saat build time
const getEnv = (name: string) => (typeof process !== "undefined" ? process.env[name] : "") || "";

export function createClient() {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  // Jika URL atau Key kosong, klien tetap terinisialisasi
  // (akan gagal saat penggunaan di runtime, tapi build berhasil)
  return createBrowserClient(url, key);
}
