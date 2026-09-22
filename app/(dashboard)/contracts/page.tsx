import { requireUser } from "@/lib/auth";
import { getContractsWithDetails, getContractFormData } from "@/app/(dashboard)/contracts/actions";
import { ContractsClient } from "@/components/contracts/contracts-client";

export const metadata = { title: "Kontrak" };

export default async function ContractsPage() {
  // Wajib login sebelum mengakses halaman kontrak
  await requireUser();

  const [contracts, formData] = await Promise.all([
    getContractsWithDetails(),
    getContractFormData()
  ]);

  return <ContractsClient initialContracts={contracts} formData={formData} />;
}
