"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

/**
 * Mengambil daftar user (profil) untuk Super Admin.
 */
export async function getUsers() {
  const supabase = await createClient();

  // Guard: pastikan hanya super_admin yang bisa akses
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (myProfile?.role !== "super_admin") return [];

  const { data: users, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching users:", error);
    return [];
  }

  return users;
}

/**
 * Mengubah role user (hanya oleh Super Admin).
 */
export async function updateUserRole(userId: string, newRole: "super_admin" | "landlord" | "tenant"): Promise<ActionResult> {
  const supabase = await createClient();

  // Guard: pastikan hanya super_admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (myProfile?.role !== "super_admin") {
    return { ok: false, error: "Hanya Super Admin yang dapat mengubah role." };
  }

  // Mencegah self-demotion
  if (userId === user.id) {
    return { ok: false, error: "Anda tidak dapat mengubah role diri sendiri." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role: newRole })
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };

  await logActivity(
    {
      action: "update",
      entityType: "user",
      entityId: userId,
      description: `Mengubah role pengguna menjadi ${newRole}`,
      metadata: { new_role: newRole }
    },
    supabase
  );

  revalidatePath("/users");
  return { ok: true };
}
