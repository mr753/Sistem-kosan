import { FileBarChart } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  getReportsData,
  periodLabel,
  type ReportsFilterState
} from "@/lib/queries/reports";
import { ReportsFilters } from "@/components/reports/reports-filters";
import { ExportButton } from "@/components/reports/export-button";
import { ReportsChart } from "@/components/reports/reports-chart";
import {
  ReportSummaryCards,
  ReportTransactionTable,
  ReportInvoiceSection,
  ReportPropertyTable,
  ReportCategorySection
} from "@/components/reports/report-sections";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Laporan" };

/** Parse & validasi filter dari URL query (server-side, tidak percaya input mentah). */
function parseFilter(searchParams: Promise<Record<string, string | string[] | undefined>>): Promise<ReportsFilterState> {
  return searchParams.then((sp) => {
    const mode = sp.mode === "year" ? "year" : "month";
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const rawMonth = typeof sp.month === "string" ? sp.month : undefined;
    const rawYear = typeof sp.year === "string" ? sp.year : undefined;
    const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth ?? "") ? rawMonth! : currentMonth;
    const year = /^\d{4}$/.test(rawYear ?? "") ? rawYear! : String(now.getFullYear());
    const propertyId =
      typeof sp.property === "string" && sp.property !== "all" && sp.property.length > 0
        ? sp.property
        : "all";
    return { mode, month, year, propertyId };
  });
}

export default async function ReportsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Role guard: /reports hanya untuk landlord & super_admin.
  // Layout dashboard sudah me-redirect tenant ke /portal, ini lapis kedua.
  const { profile } = await requireUser();
  if (profile.role === "tenant") {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Anda tidak memiliki akses ke halaman laporan.
        </CardContent>
      </Card>
    );
  }

  const supabase = await createClient();
  const filter = await parseFilter(searchParams);

  // Property scope ditegakkan server-side: landlord hanya mendapat properti
  // miliknya (RLS properties_select juga aktif sebagai lapis kedua).
  const ownerFilter =
    profile.role === "super_admin" ? {} : { owner_id: profile.id };
  const { data: properties, error: propertiesError } = await supabase
    .from("properties")
    .select("id, name")
    .match(ownerFilter)
    .order("created_at", { ascending: true });

  if (propertiesError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Gagal memuat properti: {propertiesError.message}
      </div>
    );
  }

  const propertyList = properties ?? [];
  const propertyIds =
    filter.propertyId !== "all" && propertyList.some((p) => p.id === filter.propertyId)
      ? [filter.propertyId]
      : propertyList.map((p) => p.id);

  // Periode YYYY-MM inklusif: mode tahun -> Jan..Des tahun terpilih.
  const fromPeriod = filter.mode === "month" ? filter.month : `${filter.year}-01`;
  const toPeriod = filter.mode === "month" ? filter.month : `${filter.year}-12`;

  const result = await getReportsData(supabase, propertyIds, fromPeriod, toPeriod);

  const periodText =
    filter.mode === "month"
      ? periodLabel(filter.month)
      : `Tahun ${filter.year}`;
  const propertyText =
    filter.propertyId !== "all"
      ? propertyList.find((p) => p.id === filter.propertyId)?.name ?? "Semua Properti"
      : "Semua Properti";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Laporan</h1>
          <p className="text-sm text-muted-foreground">
            Ringkasan operasional &amp; keuangan dari data aktual: transaksi, tagihan, dan okupansi kamar.
          </p>
        </div>
        <ExportButton {...filter} />
      </div>

      {/* Filter periode + properti (memicu navigasi server-side) */}
      <ReportsFilters
        state={filter}
        properties={propertyList}
        showPropertyFilter={propertyList.length > 1}
      />

      {/* Error state: jangan tampilkan angka 0 seolah data kosong */}
      {result.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {result.error}
        </div>
      ) : !result.data ? null : (
        <>
          <p className="text-sm text-muted-foreground">
            Menampilkan: <b>{periodText}</b> · {propertyText}
          </p>

          {result.data.summary.count === 0 && result.data.invoices.total === 0 && propertyIds.length > 0 ? (
            <Card>
              <CardContent className="flex min-h-[300px] flex-col items-center justify-center text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <FileBarChart className="size-7" />
                </div>
                <p className="mt-4 font-semibold">Belum ada data pada periode ini</p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Tidak ditemukan transaksi maupun tagihan untuk filter yang dipilih. Coba ubah periode
                  atau pilih properti lain.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <ReportSummaryCards summary={result.data.summary} />

              <ReportsChart data={result.data.monthly} />

              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Status Tagihan</h2>
                <ReportInvoiceSection invoices={result.data.invoices} />
              </div>

              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Per Properti</h2>
                <ReportPropertyTable properties={result.data.properties} />
              </div>

              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Breakdown Kategori Transaksi</h2>
                <ReportCategorySection
                  income={result.data.categoriesIncome}
                  expense={result.data.categoriesExpense}
                />
              </div>

              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Detail Transaksi</h2>
                <ReportTransactionTable transactions={result.data.transactions} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
