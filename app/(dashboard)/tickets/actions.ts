"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireOwner(supabase: SupabaseClient) {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "landlord" && profile?.role !== "super_admin") return null;
  return profile;
}

export async function updateTicketStatusAction(ticketId: string, status: TicketStatus): Promise<ActionResult> {
  const supabase = await createClient();
  const profile = await requireOwner(supabase);
  if (!profile) return { ok: false, error: "Akses ditolak." };

  if (!["open", "in_progress", "resolved", "closed"].includes(status)) {
    return { ok: false, error: "Status tidak valid." };
  }

  const payload: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString()
  };
  if (status === "resolved") payload.resolved_at = new Date().toISOString();

  const { data: ticket, error: selErr } = await supabase
    .from("tickets")
    .select("id,subject,property_id,tenant_id")
    .eq("id", ticketId)
    .maybeSingle();
  if (selErr || !ticket) return { ok: false, error: "Tiket tidak ditemukan." };

  // Scope properti: super admin semua; landlord hanya miliknya (RLS menegakkan)
  let scopeQuery = supabase.from("properties").select("id");
  if (profile.role === "landlord") scopeQuery = scopeQuery.eq("owner_id", (await supabase.auth.getUser()).data.user!.id);
  const { data: props } = await scopeQuery;
  const ownProps = (props ?? []).map((p) => p.id);
  if (!ownProps.includes(ticket.property_id)) return { ok: false, error: "Bukan properti Anda." };

  const { error } = await supabase.from("tickets").update(payload).eq("id", ticketId);
  if (error) return { ok: false, error: error.message };

  // Beri tahu penyewa (best-effort)
  try {
    const admin = createAdminClient();
    if (admin) {
      const { data: ten } = await admin
        .from("tenants")
        .select("user_id")
        .eq("id", ticket.tenant_id)
        .single();
      if (ten?.user_id) {
        const labels: Record<TicketStatus, string> = { open: "Baru", in_progress: "Dikerjakan", resolved: "Selesai", closed: "Ditutup" };
        await admin.from("notifications").insert({
          user_id: ten.user_id,
          type: "ticket_update",
          title: "Status komplain diperbarui",
          body: `${ticket.subject} → ${labels[status]}`,
          link: "/portal/komplain"
        });
      }
    }
  } catch {
    // ignore
  }

  revalidatePath("/tickets");
  revalidatePath("/dashboard");
  revalidatePath("/portal/komplain");
  return { ok: true };
}
