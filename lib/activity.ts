"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export interface LogActivityInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  propertyId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Catat aktivitas penting ke tabel activity_logs (audit trail append-only).
 * - actor_user_id SELALU diambil dari sesi terautentikasi (tidak pernah dari input klien).
 * - Best-effort: kegagalan logging TIDAK menggagalkan operasi bisnis utama
 *   (error hanya dicatat ke console server, tidak pernah di-throw).
 * - Jangan pernah memasukkan password/token/secret/KTP/URL storage privat
 *   ke dalam description maupun metadata.
 * - Memakai Supabase server client existing (anon key): RLS tetap berlaku,
 *   tanpa service_role dan tanpa SECURITY DEFINER.
 */
export async function logActivity(
  input: LogActivityInput,
  client?: SupabaseClient
): Promise<void> {
  try {
    const supabase = client ?? (await createClient());

    const {
      data: { user }
    } = await supabase.auth.getUser();

    const payload = {
      actor_user_id: user?.id ?? null,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      property_id: input.propertyId ?? null,
      description: input.description ?? null,
      metadata: input.metadata ?? {}
    };

    const { error } = await supabase.from("activity_logs").insert(payload);
    if (error) {
      console.error("[logActivity] Gagal mencatat activity log:", error.message);
    }
  } catch (err) {
    console.error("[logActivity] Unexpected error saat mencatat activity log:", err);
  }
}
