"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDownCircle, ArrowUpCircle, CheckCircle2, Plus, Scale, Search, Wallet, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Card, CardContent } from "@/components/ui/card";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { TransactionList } from "@/components/transactions/transaction-list";
import { DeleteTransactionModal } from "@/components/transactions/delete-transaction-modal";
import {
  createTransactionAction,
  updateTransactionAction,
  deleteTransactionAction,
  type TransactionInput,
  type TransactionFormData
} from "@/app/(dashboard)/transactions/actions";
import { TX_CATEGORIES, TX_TYPES } from "@/lib/constants";
import type { TxType } from "@/lib/constants";
import { formatIDR } from "@/lib/utils";
import type { TransactionWithDetails } from "@/lib/types";

interface TransactionsClientProps {
  initialTransactions: TransactionWithDetails[];
  formData: TransactionFormData;
}

type TypeFilter = "all" | TxType;

/** Filter periode bulan-tahun (YYYY-MM) untuk dropdown. */
function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

export function TransactionsClient({ initialTransactions, formData }: TransactionsClientProps) {
  const router = useRouter();
  const [transactions, setTransactions] = React.useState<TransactionWithDetails[]>(initialTransactions);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [monthFilter, setMonthFilter] = React.useState<string>("all");

  const [isFormModalOpen, setIsFormModalOpen] = React.useState(false);
  const [editingTransaction, setEditingTransaction] = React.useState<TransactionWithDetails | null>(null);

  const [deletingTransaction, setDeletingTransaction] = React.useState<TransactionWithDetails | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);

  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  React.useEffect(() => {
    setTransactions(initialTransactions);
  }, [initialTransactions]);

  React.useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const availableMonths = React.useMemo(() => {
    const keys = new Set<string>();
    for (const t of transactions) keys.add(monthKey(t.txn_date));
    return [...keys].sort().reverse();
  }, [transactions]);

  const filteredTransactions = transactions.filter((t) => {
    const q = searchQuery.toLowerCase().trim();
    const matchQuery =
      !q ||
      (t.description ?? "").toLowerCase().includes(q) ||
      (t.properties?.name ?? "").toLowerCase().includes(q) ||
      (t.invoices?.period_label ?? "").toLowerCase().includes(q) ||
      TX_CATEGORIES[t.category]?.label.toLowerCase().includes(q);

    if (!matchQuery) return false;
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
    if (monthFilter !== "all" && monthKey(t.txn_date) !== monthFilter) return false;
    return true;
  });

  /** Ringkasan dihitung dari hasil filter agar angka konsisten dgn tabel. */
  const filteredSummary = React.useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of filteredTransactions) {
      const amount = Number(t.amount) || 0;
      if (t.type === "income") income += amount;
      else expense += amount;
    }
    return { income, expense, net: income - expense };
  }, [filteredTransactions]);

  function handleOpenCreate() {
    setEditingTransaction(null);
    setIsFormModalOpen(true);
  }

  function handleOpenEdit(transaction: TransactionWithDetails) {
    setEditingTransaction(transaction);
    setIsFormModalOpen(true);
  }

  function handleOpenDelete(transaction: TransactionWithDetails) {
    setDeletingTransaction(transaction);
    setIsDeleteModalOpen(true);
  }

  async function handleFormSubmit(data: TransactionInput) {
    if (editingTransaction) {
      const res = await updateTransactionAction(editingTransaction.id, data);
      if (res.ok) {
        setFeedback({ type: "success", message: "Transaksi berhasil diperbarui." });
        setIsFormModalOpen(false);
        setEditingTransaction(null);
        router.refresh();
        return { ok: true };
      }
      return res;
    }

    const res = await createTransactionAction(data);
    if (res.ok) {
      setFeedback({ type: "success", message: "Transaksi berhasil dicatat." });
      setIsFormModalOpen(false);
      router.refresh();
      return { ok: true };
    }
    return res;
  }

  async function handleConfirmDelete(id: string) {
    const res = await deleteTransactionAction(id);
    if (res.ok) {
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      setFeedback({ type: "success", message: "Transaksi berhasil dihapus." });
      router.refresh();
    }
    return res;
  }

  const summaryCards = [
    {
      key: "income",
      label: "Total Pemasukan",
      icon: ArrowDownCircle,
      accent: "bg-emerald-100 text-emerald-700",
      value: formatIDR(filteredSummary.income)
    },
    {
      key: "expense",
      label: "Total Pengeluaran",
      icon: ArrowUpCircle,
      accent: "bg-red-100 text-red-700",
      value: formatIDR(filteredSummary.expense)
    },
    {
      key: "net",
      label: "Saldo",
      icon: Scale,
      accent: filteredSummary.net >= 0 ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700",
      value: formatIDR(filteredSummary.net)
    },
    {
      key: "count",
      label: "Jumlah Transaksi",
      icon: Wallet,
      accent: "bg-violet-100 text-violet-700",
      value: String(filteredTransactions.length)
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Keuangan</h1>
          <p className="text-sm text-muted-foreground">
            Catatan uang masuk &amp; keluar per properti. Pembayaran tagihan tercatat otomatis setelah disetujui.
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="w-full sm:w-auto">
          <Plus className="mr-1.5 size-4" />
          Tambah Transaksi
        </Button>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-lg p-3 text-sm transition-all ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          ) : (
            <XCircle className="size-4 shrink-0 text-red-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {summaryCards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.key}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {c.label}
                    </p>
                    <p className="mt-1.5 text-xl font-bold sm:text-2xl">{c.value}</p>
                  </div>
                  <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${c.accent}`}>
                    <Icon className="size-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Controls: Search + Filter */}
      {transactions.length > 0 && (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari keterangan / properti / invoice..."
              className="pl-9"
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              aria-label="Filter tipe transaksi"
            >
              <option value="all">Semua Tipe</option>
              {(Object.keys(TX_TYPES) as TxType[]).map((t) => (
                <option key={t} value={t}>
                  {TX_TYPES[t].label}
                </option>
              ))}
            </Select>

            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter kategori transaksi"
            >
              <option value="all">Semua Kategori</option>
              {Object.entries(TX_CATEGORIES).map(([key, cfg]) => (
                <option key={key} value={key}>
                  {cfg.label}
                </option>
              ))}
            </Select>

            <Select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              aria-label="Filter periode transaksi"
            >
              <option value="all">Semua Periode</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}

      {/* Transaction Table */}
      <TransactionList
        transactions={filteredTransactions}
        onEdit={handleOpenEdit}
        onDelete={handleOpenDelete}
        onOpenCreate={handleOpenCreate}
      />

      {/* Add / Edit Modal */}
      <Modal
        open={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingTransaction(null);
        }}
        title={editingTransaction ? "Edit Transaksi" : "Tambah Transaksi"}
        description={
          editingTransaction
            ? "Perbarui catatan transaksi manual."
            : "Catat uang masuk/keluar di luar tagihan (perbaikan, gaji penjaga, token, dll)."
        }
      >
        <TransactionForm
          initialData={editingTransaction}
          formData={formData}
          onSubmit={handleFormSubmit}
          onCancel={() => {
            setIsFormModalOpen(false);
            setEditingTransaction(null);
          }}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <DeleteTransactionModal
        open={isDeleteModalOpen}
        transaction={deletingTransaction}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingTransaction(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
