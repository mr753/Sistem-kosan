import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/queries/dashboard";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();

  // Super admin melihat semua properti; landlord hanya properti miliknya.
  const ownerFilter =
    profile.role === "super_admin" ? {} : { owner_id: profile.id };

  const { data: properties, error: propertiesError } = await supabase
    .from("properties")
    .select("id,name")
    .match(ownerFilter)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (propertiesError) {
    console.error("Error fetching properties:", propertiesError);
  }

  const propertyIds = (properties ?? []).map((p) => p.id);
  const data = await getDashboardData(supabase, propertyIds);

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
