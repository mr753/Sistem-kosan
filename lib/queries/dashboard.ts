// ============================================================================
// Query agregat Dashboard — hanya dipakai di Server (Server Components).
// Semua nama kolom mengikuti supabase/migrations/0001_init.sql.
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDate } from "@/lib/utils";

export interface DashboardSummary {
  totalRooms: number;
  occupiedRooms: number;
  vacantRooms: number;
  maintenanceRooms: number;
  activeTenants: number;
  /** tagihan bulan ini (jatuh tempo bulan berjalan) yang belum lunas */
  dueCountThisMonth: number;
  dueAmountThisMonth: number;
  /** tagihan lewat jatuh tempo & belum lunas */
  overdueCount: number;
}

export interface MonthlyFinance {
  /** label bulan pendek, mis. "Apr" */
  month: string;
  income: number;
  expense: number;
}

export type AlertKind = "payment_overdue" | "contract_expiring" | "new_ticket";
export type AlertSeverity = "high" | "medium" | "low";

export interface DashboardAlert {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  body: string;
  href: string;
}

export interface DashboardData {
  summary: DashboardSummary;
  finance: MonthlyFinance[];
  alerts: DashboardAlert[];
}

const MONTHS = 6;

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date) {
  return d.toLocaleDateString("id-ID", { month: "short" });
}

function lastMonths(n: number): { key: string; label: string; start: Date; end: Date }[] {
  const now = new Date();
  const out: { key: string; label: string; start: Date; end: Date }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    out.push({ key: monthKey(start), label: monthLabel(start), start, end });
  }
  return out;
}

interface InvoiceRow {
  id: string;
  due_date: string;
  base_rent: number;
  status: "unpaid" | "pending_confirmation" | "paid";
  tenants: { full_name: string | null } | null;
  rooms: { room_number: string | null } | null;
}

interface ContractRow {
  id: string;
  tenant_id: string;
  status: string;
  end_date: string | null;
  rooms: { room_number: string | null } | null;
  tenants: { full_name: string | null } | null;
}

interface TicketRow {
  id: string;
  subject: string;
  priority: string;
  tenants: { full_name: string | null } | null;
}

/** Data dashboard untuk scope properti tertentu (milik landlord / semua utk super admin). */
export async function getDashboardData(
  supabase: SupabaseClient,
  propertyIds: string[]
): Promise<DashboardData> {
  const empty = (): DashboardData => ({
    summary: {
      totalRooms: 0, occupiedRooms: 0, vacantRooms: 0, maintenanceRooms: 0,
      activeTenants: 0, dueCountThisMonth: 0, dueAmountThisMonth: 0, overdueCount: 0
    },
    finance: lastMonths(MONTHS).map((m) => ({ month: m.label, income: 0, expense: 0 })),
    alerts: []
  });

  if (propertyIds.length === 0) return empty();

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const endOfMonthIso = endOfMonth.toISOString().slice(0, 10);
  const horizon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);
  const horizonIso = horizon.toISOString().slice(0, 10);
  const financeFrom = lastMonths(MONTHS)[0].start.toISOString();

  const [roomsRes, contractsRes, invoicesRes, ticketsRes, txRes] = await Promise.all([
    supabase
      .from("rooms")
      .select("id,status")
      .in("property_id", propertyIds),
    supabase
      .from("contracts")
      .select("id,tenant_id,status,end_date,rooms(room_number),tenants(full_name)")
      .in("property_id", propertyIds)
      .in("status", ["active", "expired"]),
    supabase
      .from("invoices")
      .select("id,due_date,base_rent,status,tenants(full_name),rooms(room_number)")
      .in("property_id", propertyIds)
      .neq("status", "paid")
      .lte("due_date", endOfMonthIso),
    supabase
      .from("tickets")
      .select("id,subject,priority,tenants(full_name)")
      .in("property_id", propertyIds)
      .eq("status", "open"),
    supabase
      .from("transactions")
      .select("type,amount,txn_date")
      .in("property_id", propertyIds)
      .gte("txn_date", financeFrom)
  ]);

  if (roomsRes.error) console.error("Error fetching rooms:", roomsRes.error);
  if (contractsRes.error) console.error("Error fetching contracts:", contractsRes.error);
  if (invoicesRes.error) console.error("Error fetching invoices:", invoicesRes.error);
  if (ticketsRes.error) console.error("Error fetching tickets:", ticketsRes.error);
  if (txRes.error) console.error("Error fetching transactions:", txRes.error);

  const rooms = (roomsRes.data ?? []) as Array<{ status: string }>;
  const contracts = (contractsRes.data ?? []) as unknown as ContractRow[];
  const invoices = (invoicesRes.data ?? []) as unknown as InvoiceRow[];
  const tickets = (ticketsRes.data ?? []) as unknown as TicketRow[];
  const txs = (txRes.data ?? []) as Array<{ type: "income" | "expense"; amount: number; txn_date: string }>;

  // ---- Summary ----
  const occupiedRooms = rooms.filter((r) => r.status === "occupied").length;
  const vacantRooms = rooms.filter((r) => r.status === "vacant").length;
  const maintenanceRooms = rooms.filter((r) => r.status === "maintenance").length;
  const activeTenants = new Set(
    contracts.filter((c) => c.status === "active").map((c) => c.tenant_id)
  ).size;

  const dueThisMonth = invoices.filter((i) => i.due_date >= startOfMonth.toISOString().slice(0, 10));
  const overdue = invoices.filter((i) => i.due_date < today);

  // ---- Keuangan per bulan (6 bulan terakhir) ----
  const buckets = lastMonths(MONTHS);
  const finance = buckets.map((b) => ({ month: b.label, income: 0, expense: 0 }));
  for (const tx of txs) {
    const idx = buckets.findIndex((b) => b.key === monthKey(new Date(tx.txn_date)));
    if (idx === -1) continue;
    finance[idx][tx.type === "income" ? "income" : "expense"] += Number(tx.amount);
  }

  // ---- Alert ----
  const alerts: DashboardAlert[] = [];

  for (const inv of overdue) {
    alerts.push({
      id: `ov-${inv.id}`,
      kind: "payment_overdue",
      severity: "high",
      title: `Tunggakan — Kamar ${inv.rooms?.room_number ?? "-"}`,
      body: `${inv.tenants?.full_name ?? "Penyewa"} · jatuh tempo ${formatDate(inv.due_date)}`,
      href: "/invoices"
    });
  }

  for (const c of contracts) {
    if (c.status === "active" && c.end_date && c.end_date <= horizonIso) {
      alerts.push({
        id: `ct-${c.id}`,
        kind: "contract_expiring",
        severity: "medium",
        title: `Kontrak hampir habis — Kamar ${c.rooms?.room_number ?? "-"}`,
        body: `${c.tenants?.full_name ?? "Penyewa"} · berakhir ${formatDate(c.end_date)}`,
        href: "/contracts"
      });
    }
  }

  for (const t of tickets) {
    alerts.push({
      id: `tk-${t.id}`,
      kind: "new_ticket",
      severity: t.priority === "high" ? "high" : "low",
      title: `Komplain baru — ${t.subject}`,
      body: t.tenants?.full_name ?? "Penyewa",
      href: "/tickets"
    });
  }

  // Urut: high dulu, lalu medium, lalu low; paling baru di atas
  const sevRank: Record<AlertSeverity, number> = { high: 0, medium: 1, low: 2 };
  alerts.sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);

  return {
    summary: {
      totalRooms: rooms.length,
      occupiedRooms,
      vacantRooms,
      maintenanceRooms,
      activeTenants,
      dueCountThisMonth: dueThisMonth.length,
      dueAmountThisMonth: dueThisMonth.reduce((s, i) => s + Number(i.base_rent), 0),
      overdueCount: overdue.length
    },
    finance,
    alerts
  };
}
