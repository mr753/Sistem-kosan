"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Jika URL atau Key tidak ada, ini akan menyebabkan runtime error
  // yang tepat dari @supabase/ssr, bukan error "empty string" yang ambigu.
  if (!url || !key) {
    console.error("Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL/KEY) tidak ditemukan.");
  }

  return createBrowserClient(url!, key!);
}
