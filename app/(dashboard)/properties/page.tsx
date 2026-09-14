import { requireUser } from "@/lib/auth";
import { getPropertiesWithStats } from "@/lib/actions/properties";
import { PropertiesClient } from "./properties-client";

export const metadata = { title: "Properti" };

export default async function PropertiesPage() {
  // Wajib login sebelum mengakses halaman properti
  await requireUser();

  const properties = await getPropertiesWithStats();

  return <PropertiesClient initialProperties={properties} />;
}
