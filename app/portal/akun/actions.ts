"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";

export async function updateAccountAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return;

  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 30);

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: name || null, phone: phone || null })
    .eq("id", user.id);

  if (error) throw new Error(`Gagal menyimpan profil: ${error.message}`);

  await logActivity(
    {
      action: "update",
      entityType: "profile",
      entityId: user.id,
      description: "Memperbarui profil akun portal"
    },
    supabase
  );

  revalidatePath("/portal/akun");
  revalidatePath("/portal");
}
