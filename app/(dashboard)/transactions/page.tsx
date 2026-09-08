import { Wallet } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata = { title: "Keuangan" };

export default function TransactionsPage() {
  return (
    <ModulePlaceholder
      title="Keuangan"
      description="Catatan uang masuk & keluar per properti."
      icon={Wallet}
      planned={[
        "Uang masuk: sewa, listrik/air tambahan, deposit",
        "Uang keluar: perbaikan, gaji penjaga kos, token listrik utama",
        "Daftar & filter per bulan/properti/kategori",
        "Grafik dashboard sudah membaca data dari tabel transactions"
      ]}
    />
  );
}
