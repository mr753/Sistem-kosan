import { requireUser } from "@/lib/auth";
import { getTenantsWithStats } from "@/app/(dashboard)/tenants/actions";
import { TenantsClient } from "@/components/tenants/tenants-client";

export const metadata = { title: "Penyewa" };

export default async function TenantsPage() {
  // Wajib login sebelum mengakses halaman penyewa (pola properties/page.tsx)
  await requireUser();

  const tenants = await getTenantsWithStats();

  return <TenantsClient initialTenants={tenants} />;
}
