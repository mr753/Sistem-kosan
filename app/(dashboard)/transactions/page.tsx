import { requireUser } from "@/lib/auth";
import {
  getTransactionsWithDetails,
  getTransactionFormData
} from "@/app/(dashboard)/transactions/actions";
import { TransactionsClient } from "@/components/transactions/transactions-client";

export const metadata = { title: "Keuangan" };

export default async function TransactionsPage() {
  // Wajib login sebelum mengakses halaman keuangan (pola properties/page.tsx)
  await requireUser();

  // Semua transaksi dalam scope RLS diambil server-side; ringkasan (pemasukan,
  // pengeluaran, saldo, jumlah) dihitung dari data yang sama agar konsisten dgn filter.
  const [transactions, formData] = await Promise.all([
    getTransactionsWithDetails(),
    getTransactionFormData()
  ]);

  return (
    <TransactionsClient
      initialTransactions={transactions}
      formData={formData}
    />
  );
}
