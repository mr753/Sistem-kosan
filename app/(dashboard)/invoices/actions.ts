"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { invoiceTotal } from "@/lib/invoicing";

type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const MONTHS_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

async function currentScope(supabase: SupabaseClient) {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "landlord" && profile?.role !== "super_admin") return null;
  let q = supabase.from("properties").select("id");
  if (profile.role === "landlord") q = q.eq("owner_id", user.id);
  const { data } = await q;
  return (data ?? []).map((p) => p.id);
}

/** Generate invoice bulan berjalan untuk kontrak aktif yang belum ditagih. */
export async function generateInvoicesAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const ids = await currentScope(supabase);
  if (!ids) return { ok: false, error: "Akses ditolak." };
  if (!ids.length) return { ok: false, error: "Belum ada properti." };

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const cur = `${y}-${String(m + 1).padStart(2, "0")}`;
  const periodStart = `${cur}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const periodEnd = `${cur}-${String(lastDay).padStart(2, "0")}`;

  const { data: contracts } = await supabase
    .from("contracts")
    .select("id,tenant_id,room_id,property_id,due_day,rent_amount,start_date")
    .in("property_id", ids)
    .eq("status", "active")
    .eq("billing_cycle", "monthly")
    .lte("start_date", periodEnd);

  const { data: existing } = await supabase
    .from("invoices")
    .select("contract_id")
    .eq("period_start", periodStart)
    .in("property_id", ids);

  const done = new Set((existing ?? []).map((i) => i.contract_id));
  const rows = (contracts ?? [])
    .filter((c) => !done.has(c.id))
    .map((c) => {
      const dueDay = Math.min(c.due_day, lastDay);
      return {
        contract_id: c.id,
        tenant_id: c.tenant_id,
        property_id: c.property_id,
        room_id: c.room_id,
        period_label: `${MONTHS_ID[m]} ${y}`,
        period_start: periodStart,
        period_end: periodEnd,
        due_date: `${cur}-${String(dueDay).padStart(2, "0")}`,
        base_rent: c.rent_amount
      };
    });

  if (rows.length) {
    const { error } = await supabase.from("invoices").insert(rows);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/invoices");
  return { ok: true, message: `${rows.length} tagihan dibuat untuk ${MONTHS_ID[m]} ${y}.` };
}

/** Verifikasi: setujui pembayaran (unpaid/pending -> paid) + catat transaksi. */
export async function approveInvoiceAction(invoiceId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const ids = await currentScope(supabase);
  if (!ids) return { ok: false, error: "Akses ditolak." };

  const { data: inv } = await supabase
    .from("invoices")
    .select("id,contract_id,tenant_id,property_id,period_label,base_rent,status")
    .eq("id", invoiceId)
    .in("property_id", ids)
    .single();
  if (!inv) return { ok: false, error: "Tagihan tidak ditemukan." };

  const { data: items } = await supabase
    .from("invoice_items")
    .select("invoice_id,amount")
    .eq("invoice_id", invoiceId);
  const total = invoiceTotal(inv, items ?? []);

  const { error: upErr } = await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", invoiceId);
  if (upErr) return { ok: false, error: upErr.message };

  // Catat pemasukan otomatis (jika belum ada utk invoice ini)
  const { data: existingTx } = await supabase
    .from("transactions")
    .select("id")
    .eq("invoice_id", invoiceId)
    .maybeSingle();
  if (!existingTx) {
    const { error: txErr } = await supabase.from("transactions").insert({
      property_id: inv.property_id,
      type: "income",
      category: "rent",
      amount: total,
      description: `Pembayaran tagihan ${inv.period_label} (verifikasi manual)`,
      txn_date: new Date().toISOString().slice(0, 10),
      invoice_id: invoiceId
    });
    if (txErr) return { ok: false, error: txErr.message };
  }

  // Notifikasi ke penyewa (best-effort via admin)
  try {
    const { data: ten } = await createAdminClient()
      .from("tenants")
      .select("user_id")
      .eq("id", inv.tenant_id)
      .single();
    if (ten?.user_id) {
      await createAdminClient().from("notifications").insert({
        user_id: ten.user_id,
        type: "payment_confirmed",
        title: "Pembayaran dikonfirmasi",
        body: `Tagihan ${inv.period_label} dinyatakan LUNAS oleh pengelola. Terima kasih!`,
        link: "/portal/tagihan"
      });
    }
  } catch {
    // ignore
  }

  revalidatePath("/invoices");
  revalidatePath("/portal/tagihan");
  return { ok: true };
}

/** Tolak bukti transfer -> kembalikan ke Belum Dibayar. */
export async function rejectInvoiceAction(invoiceId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const ids = await currentScope(supabase);
  if (!ids) return { ok: false, error: "Akses ditolak." };
  const { error } = await supabase
    .from("invoices")
    .update({ status: "unpaid", proof_url: null })
    .eq("id", invoiceId)
    .in("property_id", ids);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/invoices");
  return { ok: true };
}

/** Koreksi: batalkan status Lunas (hapus transaksi terkait). */
export async function revertInvoiceAction(invoiceId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const ids = await currentScope(supabase);
  if (!ids) return { ok: false, error: "Akses ditolak." };
  const { error: txErr } = await supabase
    .from("transactions")
    .delete()
    .eq("invoice_id", invoiceId);
  if (txErr) return { ok: false, error: txErr.message };
  const { error } = await supabase
    .from("invoices")
    .update({ status: "unpaid", paid_at: null })
    .eq("id", invoiceId)
    .in("property_id", ids);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/invoices");
  return { ok: true };
}
