"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  revalidatePath("/portal/akun");
  revalidatePath("/portal");
}
