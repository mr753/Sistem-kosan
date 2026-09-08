"use server";

import { revalidatePath } from "next/cache";
import type { AgentChannel, CommissionType } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export interface AgentInput {
  name: string;
  agency_name: string;
  channel: AgentChannel;
  contact: string;
  commission_type: CommissionType;
  commission_value: number;
  notes: string;
  property_id: string | null; // null = semua properti
  is_active: boolean;
}

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireLandlord(): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; userId: string } | ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false, error: "Sesi berakhir. Silakan masuk lagi." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (profile?.role !== "landlord") {
    return { ok: false, error: "Hanya akun Pemilik Kos yang bisa mengelola agen." };
  }
  return { supabase, userId: data.user.id };
}

function parseInput(raw: FormData): AgentInput {
  const commissionType = raw.get("commission_type") as CommissionType;
  return {
    name: String(raw.get("name") ?? "").trim(),
    agency_name: String(raw.get("agency_name") ?? "").trim(),
    channel: (raw.get("channel") as AgentChannel) ?? "whatsapp",
    contact: String(raw.get("contact") ?? "").trim(),
    commission_type: commissionType,
    commission_value: Number(raw.get("commission_value") ?? 0),
    notes: String(raw.get("notes") ?? "").trim(),
    property_id: (raw.get("property_id") as string) || null,
    is_active: raw.get("is_active") === "on"
  };
}

export async function createAgentAction(formData: FormData): Promise<ActionResult> {
  const ctx = await requireLandlord();
  if (!("supabase" in ctx)) return ctx;

  const input = parseInput(formData);
  if (!input.name || !input.contact) {
    return { ok: false, error: "Nama dan kontak agen wajib diisi." };
  }

  const { error } = await ctx.supabase
    .from("agents")
    .insert({ owner_id: ctx.userId, ...input });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/agents");
  return { ok: true };
}

export async function updateAgentAction(id: string, formData: FormData): Promise<ActionResult> {
  const ctx = await requireLandlord();
  if (!("supabase" in ctx)) return ctx;

  const input = parseInput(formData);
  const { error } = await ctx.supabase.from("agents").update(input).eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/agents");
  return { ok: true };
}

export async function deleteAgentAction(id: string): Promise<ActionResult> {
  const ctx = await requireLandlord();
  if (!("supabase" in ctx)) return ctx;

  const { error } = await ctx.supabase.from("agents").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/agents");
  return { ok: true };
}
