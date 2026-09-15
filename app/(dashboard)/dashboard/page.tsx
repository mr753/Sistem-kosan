import Link from "next/link";
import { Building2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/queries/dashboard";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const ownerFilter =
    profile.role === "super_admin" ? {} : { owner_id: profile.id };

  const { data: properties, error: propertiesError } = await supabase
    .from("properties")
    .select("id,name")
    .match(ownerFilter)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (propertiesError) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-md">
        <p>Gagal memuat properti: {propertiesError.message}</p>
      </div>
    );
  }

  if (!properties || properties.length === 0) {
    return (
      <div className="flex min-h-[380px] flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center animate-in fade-in-50">
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Building2 className="size-7" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">Belum Ada Properti Aktif</h2>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          Tambahkan atau aktifkan gedung kos Anda terlebih dahulu untuk melihat rangkuman statistik dan laporan keuangan kos.
        </p>
        <Link href="/properties" className={buttonVariants({ className: "mt-5" })}>
          + Kelola Properti
        </Link>
      </div>
    );
  }

  const propertyIds = properties.map((p) => p.id);
  const data = await getDashboardData(supabase, propertyIds);
  if (data.error) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-red-700">
        <p>Gagal memuat dashboard: {data.error}</p>
      </div>
    );
  }

  // Tampilkan state kosong jika tidak ada data yang relevan
  if (data.summary.totalRooms === 0 && data.alerts.length === 0) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
        <p className="text-muted-foreground">Koneksi ke database berhasil, namun belum ada data untuk properti yang dipilih.</p>
      </div>
    );
  }

  const firstName = profile.full_name?.split(" ")[0] ?? "Pemilik";
  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Halo, {firstName} 👋</h1>
          <p className="text-sm text-muted-foreground">{today}</p>
        </div>
        {data.summary.overdueCount > 0 && (
          <p className="rounded-md bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700">
            {data.summary.overdueCount} tagihan melewati jatuh tempo
          </p>
        )}
      </div>

      <SummaryCards summary={data.summary} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChart finance={data.finance} />
        </div>
        <AlertsPanel alerts={data.alerts} />
      </div>
    </div>
  );
}
