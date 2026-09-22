// ============================================================================
// Query Laporan (server-only) — sumber data: tabel existing transactions,
// invoices, invoice_items, rooms, properties. Tanpa tabel/view baru.
// Definisi keuangan mengikuti Finance Phase 3:
//   income  = SUM(transactions.amount WHERE type='income')
//   expense = SUM(transactions.amount WHERE type='expense')
//   net     = income - expense
// INVOICE dihitung TERPISAH (jumlah tagihan per status) — tidak dicampur
// dengan transaksi agar tidak double-count.
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { TX_CATEGORIES } from "@/lib/constants";
import type { TxCategory } from "@/lib/constants";

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
] as const;

/** "YYYY-MM" -> label "September 2026" (id-ID). */
export function periodLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return key;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });
}

/** Label pendek untuk chart, mis. "Jan 26". */
function shortLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return key;
  return `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`;
}

/** Deret periode YYYY-MM urut naik dari `from` ke `to` (inklusif, max 24). */
function periodRange(from: string, to: string): string[] {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  if (!fy || !fm || !ty || !tm) return [];
  const out: string[] = [];
  let y = fy;
  let m = fm;
  while ((y < ty) || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
    if (out.length > 24) break; // pengaman, tidak akan tercapai via UI
  }
  return out;
}

export interface FinanceSummary {
  income: number;
  expense: number;
  net: number;
  count: number;
}

export interface MonthlyPoint {
  period: string;
  label: string;
  income: number;
  expense: number;
}

export interface CategoryBreakdown {
  category: TxCategory;
  label: string;
  count: number;
  total: number;
}

export interface InvoiceStatusCount {
  total: number;
  unpaid: number;
  pending: number;
  paid: number;
  /** nilai nominal tagihan per status (base_rent + invoice_items) */
  unpaidValue: number;
  pendingValue: number;
  paidValue: number;
}

export interface PropertyReport {
  id: string;
  name: string;
  totalRooms: number;
  occupied: number;
  vacant: number;
  maintenance: number;
  occupancy: number | null; // occupied / total rooms, null bila tak ada kamar
  income: number;
  expense: number;
  net: number;
}

export interface ReportTransactionRow {
  id: string;
  txn_date: string;
  type: "income" | "expense";
  category: TxCategory;
  amount: number;
  description: string | null;
  property_name: string | null;
  invoice_period: string | null;
}

export interface ReportsData {
  summary: FinanceSummary;
  monthly: MonthlyPoint[];
  categoriesIncome: CategoryBreakdown[];
  categoriesExpense: CategoryBreakdown[];
  invoices: InvoiceStatusCount;
  properties: PropertyReport[];
  transactions: ReportTransactionRow[];
}

/** Hasil report; error dipisah dari "data kosong" agar UI tidak menipu. */
export interface ReportsResult {
  data: ReportsData | null;
  error: string | null;
}

/** Status filter laporan yang dikirim client -> server via URL query. */
export interface ReportsFilterState {
  mode: "month" | "year";
  /** "YYYY-MM" — dipakai saat mode "month" */
  month: string;
  /** "YYYY" — dipakai saat mode "year" */
  year: string;
  /** id properti atau "all" */
  propertyId: string;
}

function emptySummary(): FinanceSummary {
  return { income: 0, expense: 0, net: 0, count: 0 };
}

/**
 * Ambil seluruh data laporan untuk periode + property scope tertentu.
 * Semua query memakai Supabase client user (RLS aktif) — landlord hanya bisa
 * membaca properti/transaksi miliknya, super admin sesuai policy existing.
 * Filter diterapkan SERVER-SIDE (.gte/.lte/.in property_id).
 */
export async function getReportsData(
  supabase: SupabaseClient,
  propertyIds: string[],
  fromPeriod: string, // "YYYY-MM" inklusif
  toPeriod: string    // "YYYY-MM" inklusif
): Promise<ReportsResult> {
  const emptyData = (): ReportsData => ({
    summary: emptySummary(),
    monthly: [],
    categoriesIncome: [],
    categoriesExpense: [],
    invoices: { total: 0, unpaid: 0, pending: 0, paid: 0, unpaidValue: 0, pendingValue: 0, paidValue: 0 },
    properties: [],
    transactions: []
  });

  if (propertyIds.length === 0) return { data: emptyData(), error: null };

  // Rentang tanggal server-side dari periode YYYY-MM.
  // txn_date & due_date bertipe DATE; UTC aman untuk tanggal murni (tanpa jam).
  const startDate = `${fromPeriod}-01`;
  const [ty, tm] = toPeriod.split("-").map(Number);
  const endDateIso = new Date(Date.UTC(ty, tm, 0)).toISOString().slice(0, 10);

  const [txRes, invRes, roomsRes, propRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, txn_date, type, category, amount, description, property_id, invoices(period_label)")
      .in("property_id", propertyIds)
      .gte("txn_date", startDate)
      .lte("txn_date", endDateIso)
      .order("txn_date", { ascending: false }),
    supabase
      .from("invoices")
      .select("id, status, base_rent, property_id")
      .in("property_id", propertyIds)
      // Periode invoice dihitung dari due_date (tanggal tagihan jatuh tempo)
      // agar satu definisi "periode tagihan" dipakai konsisten.
      .gte("due_date", startDate)
      .lte("due_date", endDateIso),
    supabase
      .from("rooms")
      .select("id, property_id, status")
      .in("property_id", propertyIds),
    supabase
      .from("properties")
      .select("id, name")
      .in("id", propertyIds)
  ]);

  const queryError = [txRes, invRes, roomsRes, propRes].find((r) => r.error)?.error;
  if (queryError) {
    return { data: null, error: "Gagal memuat data laporan. Coba lagi beberapa saat." };
  }

  const transactions = (txRes.data ?? []) as unknown as Array<{
    id: string; txn_date: string; type: "income" | "expense"; category: string;
    amount: number | string; description: string | null; property_id: string;
    invoices: { period_label: string }[] | null;
  }>;
  const invoices = (invRes.data ?? []) as Array<{
    id: string; status: "unpaid" | "pending_confirmation" | "paid";
    base_rent: number | string; property_id: string;
  }>;
  const rooms = (roomsRes.data ?? []) as Array<{ id: string; property_id: string; status: string }>;
  const propertyRows = (propRes.data ?? []) as Array<{ id: string; name: string }>;
  const nameById = new Map(propertyRows.map((p) => [p.id, p.name]));

  // invoice_items untuk invoice dalam periode (satu query, bukan N+1)
  const invoiceIds = invoices.map((i) => i.id);
  const itemsByInvoice: Record<string, number> = {};
  if (invoiceIds.length > 0) {
    const { data: items, error: itemsError } = await supabase
      .from("invoice_items")
      .select("invoice_id, amount")
      .in("invoice_id", invoiceIds);
    if (itemsError) {
      return { data: null, error: "Gagal memuat rincian tagihan. Coba lagi beberapa saat." };
    }
    for (const it of (items ?? []) as Array<{ invoice_id: string; amount: number | string }>) {
      itemsByInvoice[it.invoice_id] = (itemsByInvoice[it.invoice_id] ?? 0) + Number(it.amount);
    }
  }

  // ---- Ringkasan keuangan (sumber: transactions) ----
  const summary = emptySummary();
  const monthlyMap = new Map<string, MonthlyPoint>();
  const categoryIncomeMap = new Map<TxCategory, { count: number; total: number }>();
  const categoryExpenseMap = new Map<TxCategory, { count: number; total: number }>();
  const txRows: ReportTransactionRow[] = [];
  const incomeByProperty = new Map<string, number>();
  const expenseByProperty = new Map<string, number>();

  const months = periodRange(fromPeriod, toPeriod);
  for (const p of months) {
    monthlyMap.set(p, { period: p, label: shortLabel(p), income: 0, expense: 0 });
  }

  for (const t of transactions) {
    const amount = Number(t.amount) || 0;
    const isIncome = t.type === "income";

    if (isIncome) summary.income += amount;
    else summary.expense += amount;
    summary.count += 1;

    // chart per bulan (bucket dari deret periode agar bulan tanpa transaksi tetap tampil)
    const period = t.txn_date.slice(0, 7);
    const point = monthlyMap.get(period);
    if (point) {
      if (isIncome) point.income += amount;
      else point.expense += amount;
    }

    // breakdown kategori, dipisah income/expense
    const cat = (Object.prototype.hasOwnProperty.call(TX_CATEGORIES, t.category)
      ? t.category
      : "other") as TxCategory;
    const catMap = isIncome ? categoryIncomeMap : categoryExpenseMap;
    const agg = catMap.get(cat) ?? { count: 0, total: 0 };
    agg.count += 1;
    agg.total += amount;
    catMap.set(cat, agg);

    // per properti
    if (isIncome) incomeByProperty.set(t.property_id, (incomeByProperty.get(t.property_id) ?? 0) + amount);
    else expenseByProperty.set(t.property_id, (expenseByProperty.get(t.property_id) ?? 0) + amount);

    // baris tabel detail
    txRows.push({
      id: t.id,
      txn_date: t.txn_date,
      type: t.type,
      category: cat,
      amount,
      description: t.description,
      property_name: nameById.get(t.property_id) ?? null,
      invoice_period: t.invoices?.[0]?.period_label ?? null
    });
  }
  summary.net = summary.income - summary.expense;

  // ---- Status invoice (sumber: invoices, terpisah dari transactions) ----
  const invCounts: InvoiceStatusCount = {
    total: invoices.length, unpaid: 0, pending: 0, paid: 0,
    unpaidValue: 0, pendingValue: 0, paidValue: 0
  };
  for (const inv of invoices) {
    const value = Number(inv.base_rent) + (itemsByInvoice[inv.id] ?? 0);
    if (inv.status === "unpaid") {
      invCounts.unpaid += 1;
      invCounts.unpaidValue += value;
    } else if (inv.status === "pending_confirmation") {
      invCounts.pending += 1;
      invCounts.pendingValue += value;
    } else if (inv.status === "paid") {
      invCounts.paid += 1;
      invCounts.paidValue += value;
    }
  }

  // ---- Laporan per properti ----
  const properties: PropertyReport[] = propertyRows
    .map((p) => {
      const roomList = rooms.filter((r) => r.property_id === p.id);
      const occupied = roomList.filter((r) => r.status === "occupied").length;
      const vacant = roomList.filter((r) => r.status === "vacant").length;
      const maintenance = roomList.filter((r) => r.status === "maintenance").length;
      const income = incomeByProperty.get(p.id) ?? 0;
      const expense = expenseByProperty.get(p.id) ?? 0;
      return {
        id: p.id,
        name: p.name,
        totalRooms: roomList.length,
        occupied,
        vacant,
        maintenance,
        occupancy: roomList.length > 0 ? occupied / roomList.length : null,
        income,
        expense,
        net: income - expense
      };
    })
    .sort((a, b) => b.net - a.net);

  return {
    data: {
      summary,
      monthly: months.map((p) => monthlyMap.get(p)!),
      categoriesIncome: mapToSorted(categoryIncomeMap),
      categoriesExpense: mapToSorted(categoryExpenseMap),
      invoices: invCounts,
      properties,
      transactions: txRows
    },
    error: null
  };
}

function mapToSorted(m: Map<TxCategory, { count: number; total: number }>): CategoryBreakdown[] {
  return [...m.entries()]
    .map(([category, agg]) => ({ category, label: TX_CATEGORIES[category]?.label ?? category, ...agg }))
    .sort((a, b) => b.total - a.total);
}
