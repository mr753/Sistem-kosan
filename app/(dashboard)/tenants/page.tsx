import { Users } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata = { title: "Penyewa" };

export default function TenantsPage() {
  return (
    <ModulePlaceholder
      title="Penyewa"
      description="Database profil penyewa lengkap."
      icon={Users}
      planned={[
        "Profil: nama, No. HP, email, alamat, kontak darurat",
        "Upload foto KTP/ID ke Supabase Storage (bucket tenant-docs, private)",
        "Hubungkan akun login penyewa (user_id) ke profil",
        "Skema lengkap: tabel tenants + kebijakan RLS pemilik/penyewa"
      ]}
    />
  );
}
