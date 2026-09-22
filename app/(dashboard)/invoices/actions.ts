"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { invoiceTotal } from "@/lib/invoicing";
import { requireUser } from "@/lib/auth";
import { INVOICE_STATUS } from "@/lib/constants";
import { normalizeWaNumber, whatsappAgentLink } from "@/lib/agents/broadcast";
import { formatDate, formatIDR } from "@/lib/utils";
import { logActivity } from "@/lib/activity";

type ActionResult = { ok: true; message?: string; url?: string; data?: unknown } | { ok: false; error: string };

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

/** True bila error berasal dari unique index anti-duplikat (idempotent, bukan kegagalan). */
function isDuplicateInvoiceError(message: string): boolean {
  return (
    message.includes("one_invoice_per_contract_period") || message.includes("duplicate key")
  );
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

  const { data: contracts, error: contractsError } = await supabase
    .from("contracts")
    .select("id,tenant_id,room_id,property_id,due_day,rent_amount,start_date")
    .in("property_id", ids)
    .eq("status", "active")
    .eq("billing_cycle", "monthly")
    .lte("start_date", periodEnd);
  if (contractsError) return { ok: false, error: contractsError.message };

  // Anti-duplikat: kandidat difilter dgn kontrak yang SUDAH punya invoice periode ini.
  // Query ini sengaja diletakkan sesudah (dan sedekat mungkin dengan) INSERT agar jendela
  // race-nya seminimal mungkin; unique index one_invoice_per_contract_period tetap
  // menjadi lapisan pamungkas di level DB.
  const { data: existing, error: existingError } = await supabase
    .from("invoices")
    .select("contract_id")
    .eq("period_start", periodStart)
    .in("property_id", ids);
  if (existingError) return { ok: false, error: existingError.message };

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

  let created = 0;
  if (rows.length) {
    const { error } = await supabase.from("invoices").insert(rows);
    if (error && !isDuplicateInvoiceError(error.message)) {
      return { ok: false, error: error.message };
    }
    // Bila sebagian baris ditolak unique index (sudah dibuat proses lain),
    // hitung ulang jumlah aktual agar pesan tetap akurat — idempotent, bukan error.
    created = error ? await countCreated(supabase, ids, periodStart) : rows.length;
  }

  if (created > 0) {
    await logActivity(
      {
        action: "generate",
        entityType: "invoice",
        description: `Membuat ${created} tagihan untuk ${MONTHS_ID[m]} ${y}`
      },
      supabase
    );
  }

  revalidatePath("/invoices");
  return { ok: true, message: `${created} tagihan dibuat untuk ${MONTHS_ID[m]} ${y}.` };
}

/** Hitung ulang jumlah invoice periode ini dalam scope (setelah insert parsial). */
async function countCreated(
  supabase: SupabaseClient,
  propertyIds: string[],
  periodStart: string
): Promise<number> {
  const { count } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("period_start", periodStart)
    .in("property_id", propertyIds);
  return count ?? 0;
}

/** Verifikasi: setujui pembayaran (unpaid/pending -> paid) + catat transaksi. */
export async function approveInvoiceAction(invoiceId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const ids = await currentScope(supabase);
  if (!ids) return { ok: false, error: "Akses ditolak." };

  const { data: inv, error: invError } = await supabase
    .from("invoices")
    .select("id,contract_id,tenant_id,property_id,period_label,base_rent,status")
    .eq("id", invoiceId)
    .in("property_id", ids)
    .single();
  if (invError || !inv) return { ok: false, error: "Tagihan tidak ditemukan." };

  // Guard status: hanya unpaid/pending_confirmation yang boleh di-approve.
  if (inv.status === "paid") {
    return { ok: false, error: "Tagihan ini sudah lunas." };
  }

  const { data: items } = await supabase
    .from("invoice_items")
    .select("invoice_id,amount")
    .eq("invoice_id", invoiceId);
  const total = invoiceTotal(inv, items ?? []);

  // Update yang di-scope-kan hanya dari status valid. Bila proses lain sudah lebih
  // dulu mengubah status ke paid, update menyentuh 0 baris dan kita berhenti
  // SEBELUM membuat transaksi/notifikasi (anti double income saat double-click).
  const { data: updated, error: upErr } = await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .in("status", ["unpaid", "pending_confirmation"])
    .select("id")
    .maybeSingle();
  if (upErr) return { ok: false, error: upErr.message };
  if (!updated) {
    return { ok: false, error: "Status tagihan sudah berubah. Muat ulang halaman." };
  }

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
    const admin = createAdminClient();
    if (admin) {
      const { data: ten } = await admin
        .from("tenants")
        .select("user_id")
        .eq("id", inv.tenant_id)
        .single();
      if (ten?.user_id) {
        await admin.from("notifications").insert({
          user_id: ten.user_id,
          type: "payment_confirmed",
          title: "Pembayaran dikonfirmasi",
          body: `Tagihan ${inv.period_label} dinyatakan LUNAS oleh pengelola. Terima kasih!`,
          link: "/portal/tagihan"
        });
      }
    }
  } catch {
    // ignore
  }

  await logActivity(
    {
      action: "approve",
      entityType: "invoice",
      entityId: invoiceId,
      propertyId: inv.property_id,
      description: "Menyetujui pembayaran invoice",
      metadata: { period_label: inv.period_label, amount: total }
    },
    supabase
  );

  revalidatePath("/invoices");
  revalidatePath("/portal/tagihan");
  return { ok: true };
}

/** Tolak bukti transfer -> kembalikan ke Belum Dibayar. */
export async function rejectInvoiceAction(invoiceId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const ids = await currentScope(supabase);
  if (!ids) return { ok: false, error: "Akses ditolak." };
  // Hanya invoice pending_confirmation yang boleh ditolak; scope property dijaga.
  const { error } = await supabase
    .from("invoices")
    .update({ status: "unpaid", proof_url: null })
    .eq("id", invoiceId)
    .in("property_id", ids)
    .eq("status", "pending_confirmation");
  if (error) return { ok: false, error: error.message };

  await logActivity(
    {
      action: "reject",
      entityType: "invoice",
      entityId: invoiceId,
      description: "Menolak bukti pembayaran invoice"
    },
    supabase
  );

  revalidatePath("/invoices");
  return { ok: true };
}

/** Koreksi: batalkan status Lunas (hapus transaksi terkait). */
export async function revertInvoiceAction(invoiceId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const ids = await currentScope(supabase);
  if (!ids) return { ok: false, error: "Akses ditolak." };

  // Hanya invoice yang memang SUDAH PAID (dalam scope property) yang boleh di-revert.
  const { data: inv, error: invError } = await supabase
    .from("invoices")
    .select("id,property_id,status")
    .eq("id", invoiceId)
    .in("property_id", ids)
    .single();
  if (invError || !inv) return { ok: false, error: "Tagihan tidak ditemukan." };
  if (inv.status !== "paid") {
    return { ok: false, error: "Hanya tagihan berstatus Lunas yang dapat dibatalkan." };
  }

  // Hapus HANYA transaksi otomatis milik invoice ini, dalam scope property.
  // Transaksi manual (tanpa invoice_id / milik property lain) tidak tersentuh.
  const { error: txErr } = await supabase
    .from("transactions")
    .delete()
    .eq("invoice_id", invoiceId)
    .in("property_id", ids);
  if (txErr) return { ok: false, error: txErr.message };

  // Kembalikan status dengan guard "masih paid" agar tidak menimpa perubahan lain.
  const { data: reverted, error } = await supabase
    .from("invoices")
    .update({ status: "unpaid", paid_at: null })
    .eq("id", invoiceId)
    .in("property_id", ids)
    .eq("status", "paid")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!reverted) {
    return { ok: false, error: "Status tagihan sudah berubah. Muat ulang halaman." };
  }

  await logActivity(
    {
      action: "update",
      entityType: "invoice",
      entityId: invoiceId,
      propertyId: inv.property_id,
      description: "Membatalkan status lunas invoice"
    },
    supabase
  );

  revalidatePath("/invoices");
  return { ok: true };
}

/**
 * Buka tautan WhatsApp untuk pengingat tagihan (manual click-to-chat via wa.me).
 * Hanya menerima invoiceId. Resolusi invoice, penyewa, total, dan otorisasi dilakukan server-side.
 * Bersifat read-only / informasional: TIDAK mengubah invoice/transaksi/penyewa/kontrak.
 */
export async function openWhatsAppReminderAction(invoiceId: string): Promise<ActionResult> {
  const { profile } = await requireUser();
  if (profile.role !== "landlord" && profile.role !== "super_admin") {
    return { ok: false, error: "Anda tidak memiliki akses ke invoice ini" };
  }

  const supabase = await createClient();
  const ids = await currentScope(supabase);
  if (!ids || !ids.length) {
    return { ok: false, error: "Anda tidak memiliki akses ke invoice ini" };
  }

  const { data: inv, error: invError } = await supabase
    .from("invoices")
    .select("id,property_id,status,period_label,due_date,base_rent,tenant_id,tenants(full_name,phone)")
    .eq("id", invoiceId)
    .in("property_id", ids)
    .single();

  if (invError || !inv) {
    return { ok: false, error: "Anda tidak memiliki akses ke invoice ini" };
  }

  if (inv.status !== "unpaid" && inv.status !== "pending_confirmation") {
    return {
      ok: false,
      error: "Pengingat hanya dapat dikirim untuk tagihan belum dibayar atau menunggu konfirmasi."
    };
  }

  const rawTenant = inv.tenants as unknown;
  const tenant = (Array.isArray(rawTenant) ? rawTenant[0] : rawTenant) as {
    full_name: string | null;
    phone: string | null;
  } | null;

  const rawPhone = tenant?.phone?.trim();
  if (!rawPhone) {
    return { ok: false, error: "Nomor HP tidak tersedia" };
  }

  const cleanPhone = normalizeWaNumber(rawPhone);
  if (!cleanPhone || cleanPhone.length < 9 || cleanPhone.length > 15) {
    return { ok: false, error: "Nomor HP tidak valid" };
  }

  const { data: items } = await supabase
    .from("invoice_items")
    .select("invoice_id,amount")
    .eq("invoice_id", invoiceId);
  const total = invoiceTotal(inv, items ?? []);

  const tenantName = tenant?.full_name?.trim() || "Penyewa";
  const statusLabel =
    INVOICE_STATUS[inv.status as keyof typeof INVOICE_STATUS]?.label ?? inv.status;

  const message = [
    `Halo kak ${tenantName}, ini pengingat tagihan sewa kos untuk periode ${inv.period_label}.`,
    `Total tagihan: ${formatIDR(total)}`,
    `Jatuh tempo: ${formatDate(inv.due_date)}`,
    `Status: ${statusLabel}`,
    "",
    "Mohon segera menyelesaikan pembayaran dan mengunggah bukti transfer melalui portal penyewa. Terima kasih! 🙏"
  ].join("\n");

  const url = whatsappAgentLink(cleanPhone, message);

  return {
    ok: true,
    message: "WhatsApp siap dibuka",
    url
  };
}
