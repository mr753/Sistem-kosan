"use server";

import { createClient } from "@/lib/supabase/server";
import { getReportsData } from "@/lib/queries/reports";
import { requireUser } from "@/lib/auth";

export async function exportReportsToCsv(
  mode: "month" | "year",
  month: string,
  year: string,
  propertyId: string
) {
  // 1. Validasi Auth
  const { profile } = await requireUser();
  if (profile.role === "tenant") throw new Error("Unauthorized");

  const supabase = await createClient();

  // 2. Validasi Scope (sama dengan Reports page)
  const ownerFilter =
    profile.role === "super_admin" ? {} : { owner_id: profile.id };
  const { data: properties, error: propertiesError } = await supabase
    .from("properties")
    .select("id, name")
    .match(ownerFilter);

  if (propertiesError) throw new Error("Gagal memuat properti");

  const propertyList = properties ?? [];
  const propertyIds =
    propertyId !== "all" && propertyList.some((p) => p.id === propertyId)
      ? [propertyId]
      : propertyList.map((p) => p.id);

  const fromPeriod = mode === "month" ? month : `${year}-01`;
  const toPeriod = mode === "month" ? month : `${year}-12`;

  // 3. Ambil data
  const result = await getReportsData(supabase, propertyIds, fromPeriod, toPeriod);
  if (!result.data || result.error) throw new Error(result.error ?? "Data tidak ditemukan");

  // 4. Generate CSV (Finance Report as default export)
  const escapeCsv = (val: string | number | null | undefined) => {
    if (val === null || val === undefined) return "";
    let s = String(val).replace(/"/g, '""');
    // Proteksi CSV Formula Injection
    if (["=", "+", "-", "@"].includes(s[0])) s = "'" + s;
    return `"${s}"`;
  };

  const headers = ["Tanggal", "Tipe", "Kategori", "Jumlah", "Deskripsi", "Properti"];
  const rows = result.data.transactions.map((t) => [
    t.txn_date,
    t.type,
    t.category,
    t.amount.toString(),
    escapeCsv(t.description),
    escapeCsv(t.property_name)
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  return {
    filename: `finance-report-${fromPeriod}.csv`,
    content: csvContent
  };
}
