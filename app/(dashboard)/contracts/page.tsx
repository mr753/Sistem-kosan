import { FileSignature } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata = { title: "Kontrak" };

export default function ContractsPage() {
  return (
    <ModulePlaceholder
      title="Kontrak Sewa"
      description="Kontrak digital penyewa & kamar."
      icon={FileSignature}
      planned={[
        "Tanggal mulai/akhir, durasi, tanggal jatuh tempo (due_day), deposit",
        "Upload PDF surat perjanjian / generator draft otomatis",
        "Satu kontrak aktif per kamar (dijaga unique index di DB)",
        "Status: Aktif, Berakhir, Dihentikan — pemicu notifikasi kontrak hampir habis"
      ]}
    />
  );
}
