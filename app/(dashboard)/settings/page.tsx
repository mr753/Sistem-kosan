import { Settings } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata = { title: "Pengaturan" };

export default function SettingsPage() {
  return (
    <ModulePlaceholder
      title="Pengaturan"
      description="Profil & preferensi akun."
      icon={Settings}
      planned={[
        "Edit profil (nama, No. HP, foto)",
        "Notifikasi in-app (tabel notifications sudah tersedia)",
        "Manajemen role oleh Super Admin"
      ]}
    />
  );
}
