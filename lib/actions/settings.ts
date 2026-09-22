"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

interface ProfileUpdateInput {
  full_name: string | null;
  phone: string | null;
}

function validateProfileInput(input: ProfileUpdateInput): string | null {
  const fullName = (input.full_name || "").trim();
  if (fullName.length === 0) {
    return "Nama lengkap wajib diisi.";
  }
  if (fullName.length > 255) {
    return "Nama lengkap terlalu panjang.";
  }

  const phone = (input.phone || "").trim();
  if (phone.length > 50) {
    return "Nomor telepon terlalu panjang.";
  }

  return null;
}

function cleanProfilePayload(input: ProfileUpdateInput) {
  return {
    full_name: (input.full_name || "").trim() || null,
    phone: (input.phone || "").trim() || null,
  };
}

function friendlyError(message: string): string {
  if (!message) return "Gagal memperbarui profil.";
  if (message.includes("updated_at")) {
    return "Gagal memperbarui profil.";
  }
  return "Gagal memperbarui profil.";
}

export async function updateProfile(input: ProfileUpdateInput): Promise<ActionResult> {
  const { user, profile } = await requireUser();
  const supabase = await createClient();

  // Email tidak bisa diubah lewat Settings.
  // Tampilkan hanya sebagai informasi; simpan tetap tidak menyentuh kolom email.

  const validationError = validateProfileInput(input);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  // Hanya kolom yang benar-benar berubah yang dikirim, agar
  // data existing tetap aman dan tidak ada field yang dipaksa null.
  const payload = cleanProfilePayload(input);

  const hasFullNameChange =
    payload.full_name !== null &&
    profile.full_name !== payload.full_name;
  const hasPhoneChange =
    payload.phone !== null &&
    profile.phone !== payload.phone;

  const updates: Record<string, unknown> = {};

  if (hasFullNameChange) {
    updates.full_name = payload.full_name;
  }
  if (hasPhoneChange) {
    updates.phone = payload.phone;
  }

  if (Object.keys(updates).length === 0) {
    return { ok: true };
  }

  updates.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (error) {
    return { ok: false, error: friendlyError(error.message) };
  }

  await logActivity(
    {
      action: "update",
      entityType: "profile",
      entityId: user.id,
      description: "Memperbarui profil sendiri",
      metadata: { updated_fields: Object.keys(updates).filter((k) => k !== "updated_at") }
    },
    supabase
  );

  revalidatePath("/settings");
  return { ok: true };
}
