import { Building2 } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata = { title: "Properti" };

export default function PropertiesPage() {
  return (
    <ModulePlaceholder
      title="Properti"
      description="Kelola beberapa gedung kos dalam satu akun."
      icon={Building2}
      planned={[
        "CRUD gedung kos (nama, alamat, kota, foto)",
        "Status aktif/nonaktif properti",
        "Ringkasan okupansi per gedung",
        "Struktur data sudah siap: tabel properties + relasi rooms"
      ]}
    />
  );
}
