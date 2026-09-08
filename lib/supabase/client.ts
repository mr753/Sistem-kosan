"use client";

import { createBrowserClient } from "@supabase/ssr";

function assertEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Environment variable ${name} belum diisi. Lihat .env.example`);
  return v;
}

export function createClient() {
  return createBrowserClient(
    assertEnv("NEXT_PUBLIC_SUPABASE_URL"),
    assertEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
}
