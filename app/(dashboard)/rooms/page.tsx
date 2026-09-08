import { DoorOpen } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata = { title: "Kamar" };

export default function RoomsPage() {
  return (
    <ModulePlaceholder
      title="Kamar"
      description="Inventaris kamar & papan status visual."
      icon={DoorOpen}
      planned={[
        "CRUD kamar: tipe, fasilitas (AC, KM Dalam, dll.), harga harian/bulanan/tahunan",
        "Papan status berwarna: Terisi (hijau), Kosong (biru), Pemeliharaan (kuning)",
        "Filter per properti dan kata kunci",
        "Skema lengkap: tabel rooms + kolom facilities[], status, price_*"
      ]}
    />
  );
}
