"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface TicketInput {
  subject: string;
  description: string;
  priority: "low" | "medium" | "high";
  photos: string[]; // path di bucket ticket-photos (folder <user_id>/)
}

type ActionResult = { ok: true } | { ok: false; error: string };

export async function createTicketAction(input: TicketInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesi berakhir." };

  const subject = input.subject.trim().slice(0, 200);
  if (!subject) return { ok: false, error: "Subjek komplain wajib diisi." };

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!tenant) return { ok: false, error: "Akun belum terhubung ke profil penyewa." };

  // Konteks properti/kamar dari kontrak aktif pertama
  const { data: contract } = await supabase
    .from("contracts")
    .select("id,property_id,room_id")
    .eq("tenant_id", tenant.id)
    .eq("status", "active")
    .maybeSingle();

  const propertyId = contract?.property_id;
  if (!propertyId) return { ok: false, error: "Tidak ada kontrak aktif untuk melaporkan komplain." };

  // Photo paths must be inside the user's own storage folder (<user_id>/...).
  // Prevents using the service-role signed URL to access other users' files.
  const photoPrefix = `${user.id}/`;
  const photos = (input.photos ?? [])
    .filter((p): p is string => typeof p === "string" && p.startsWith(photoPrefix));
  if (photos.length !== (input.photos ?? []).length) {
    return { ok: false, error: "Path foto tidak valid." };
  }

  const { error } = await supabase.from("tickets").insert({
    tenant_id: tenant.id,
    property_id: propertyId,
    room_id: contract?.room_id ?? null,
    subject,
    description: input.description.trim().slice(0, 2000) || null,
    priority: input.priority,
    photos: photos.slice(0, 3)
  });
  if (error) return { ok: false, error: error.message };

  // Notifikasi ke pemilik properti (admin client, bukan RLS user)
  try {
    const admin = createAdminClient();
      if (admin) {
      const { data: prop } = await admin
        .from("properties")
        .select("owner_id")
        .eq("id", propertyId)
        .single();
      if (prop?.owner_id) {
        const { data: ten } = await admin
          .from("tenants")
          .select("full_name")
          .eq("id", tenant.id)
          .single();
        await admin.from("notifications").insert({
          user_id: prop.owner_id,
          type: "new_ticket",
          title: `Komplain baru dari ${ten?.full_name ?? "Penyewa"}`,
          body: subject,
          link: "/tickets"
      });
    }
    }
  } catch {
    // notifikasi bersifat best-effort
  }

  revalidatePath("/portal/komplain");
  return { ok: true };
}

export async function requireTenantRedirect() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}
