import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Endpoint cron (gratis): membuat invoice bulan berjalan untuk semua kontrak
 * aktif yang belum memiliki invoice pada periode tsb (idempotent via unique
 * index invoices(contract_id, period_start)).
 *
 * Jadwalkan di Vercel Cron (Hobby: 1x/hari) atau cron-job.org dengan header:
 *   x-cron-secret: <CRON_SECRET>
 */

const ALLOWED_CYCLE = "monthly";

interface ContractRow {
  id: string;
  tenant_id: string;
  room_id: string;
  property_id: string;
  rent_amount: number;
  due_day: number;
  billing_cycle: string;
  start_date: string;
}

function lastDayOfMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY belum diisi" }, { status: 500 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    return NextResponse.json({ error: "NEXT_PUBLIC_SUPABASE_URL belum diisi" }, { status: 500 });
  }

  const admin = createSupabaseClient(
    url,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based
  const periodStart = new Date(y, m, 1).toISOString().slice(0, 10);
  const periodEnd = new Date(y, m, lastDayOfMonth(y, m + 1), 23, 59, 59).toISOString().slice(0, 10);
  const label = now.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  // Invoice periode ini yang sudah pernah dibuat (contract_id) — utk anti duplikat.
  // Catatan: PostgREST tidak menerima subquery SQL di dalam filter, jadi
  // kumpulkan dulu id kontrak yang sudah punya invoice pada periode ini.
  const { data: existing, error: exErr } = await admin
    .from("invoices")
    .select("contract_id")
    .eq("period_start", periodStart);
  if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 });

  const existingContractIds: string[] = (existing ?? []).map((r) => r.contract_id as string);

  // Semua kontrak aktif (monthly) yang belum punya invoice periode ini
  let contractQuery = admin
    .from("contracts")
    .select("id,tenant_id,room_id,property_id,rent_amount,due_day,billing_cycle,start_date")
    .eq("status", "active")
    .eq("billing_cycle", ALLOWED_CYCLE)
    .lte("start_date", periodEnd);
  if (existingContractIds.length > 0) {
    contractQuery = contractQuery.not("id", "in", `(${existingContractIds.join(",")})`);
  }

  const { data: contracts, error: cErr } = await contractQuery;

  const contractsRows = (contracts ?? []) as ContractRow[];
  let created = 0;

  for (const c of contractsRows) {
    const dueDay = Math.min(c.due_day, lastDayOfMonth(y, m + 1));
    const dueDate = new Date(y, m, dueDay).toISOString().slice(0, 10);

    const { error: insErr } = await admin.from("invoices").insert({
      contract_id: c.id,
      tenant_id: c.tenant_id,
      room_id: c.room_id,
      property_id: c.property_id,
      period_label: label,
      period_start: periodStart,
      period_end: periodEnd,
      due_date: dueDate,
      base_rent: c.rent_amount
    });
    if (insErr) {
      // unik index menolak duplikat — lewati bila sudah ada
      if (!String(insErr.message).includes("one_invoice_per_contract_period")) {
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
      continue;
    }
    created++;
  }

  return NextResponse.json({ ok: true, period: label, created, skipped: contractsRows.length - created });
}
