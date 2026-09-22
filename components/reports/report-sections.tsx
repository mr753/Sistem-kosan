"use client";

import { Building2, FileText, Scale, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { TX_CATEGORIES, TX_TYPES } from "@/lib/constants";
import type { TxCategory, TxType } from "@/lib/constants";
import { formatIDR, formatDate } from "@/lib/utils";
import type {
  FinanceSummary, InvoiceStatusCount, PropertyReport
} from "@/lib/queries/reports";

/** Kartu ringkasan keuangan (sumber data sama dgn chart & tabel). */
export function ReportSummaryCards({ summary }: { summary: FinanceSummary }) {
  const cards = [
    {
      key: "income",
      label: "Total Pemasukan",
      icon: TrendingUp,
      accent: "bg-emerald-100 text-emerald-700",
      value: formatIDR(summary.income)
    },
    {
      key: "expense",
      label: "Total Pengeluaran",
      icon: TrendingDown,
      accent: "bg-red-100 text-red-700",
      value: formatIDR(summary.expense)
    },
    {
      key: "net",
      label: "Saldo Bersih",
      icon: Scale,
      accent: summary.net >= 0 ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700",
      value: formatIDR(summary.net)
    },
    {
      key: "count",
      label: "Jumlah Transaksi",
      icon: Wallet,
      accent: "bg-violet-100 text-violet-700",
      value: String(summary.count)
    }
  ];

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {cards.map((c) => {
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
  );
}

function typeBadge(type: TxType) {
  return type === "income" ? (
    <Badge className="bg-emerald-100 text-emerald-700">{TX_TYPES.income.label}</Badge>
  ) : (
    <Badge className="bg-red-100 text-red-700">{TX_TYPES.expense.label}</Badge>
  );
}

/** Tabel detail transaksi pada periode & scope yang sama dengan ringkasan. */
export function ReportTransactionTable({
  transactions
}: {
  transactions: {
    id: string;
    txn_date: string;
    type: "income" | "expense";
    category: TxCategory;
    amount: number;
    description: string | null;
    property_name: string | null;
    invoice_period: string | null;
  }[];
}) {
  if (transactions.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Tidak ada transaksi pada periode ini.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Jumlah</TableHead>
                <TableHead>Properti</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead>Invoice</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatDate(t.txn_date)}
                  </TableCell>
                  <TableCell>{typeBadge(t.type)}</TableCell>
                  <TableCell className="text-sm">
                    {TX_CATEGORIES[t.category]?.label ?? t.category}
                  </TableCell>
                  <TableCell
                    className={`whitespace-nowrap text-sm font-medium ${
                      t.type === "income" ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {t.type === "income" ? "+" : "-"} {formatIDR(t.amount)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.property_name ?? "-"}
                  </TableCell>
                  <TableCell className="max-w-56 truncate text-sm text-muted-foreground" title={t.description ?? ""}>
                    {t.description ?? "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.invoice_period ?? "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

const INVOICE_STATUS_CARDS: {
  key: keyof Pick<InvoiceStatusCount, "unpaid" | "pending" | "paid">;
  label: string;
  badge: string;
}[] = [
  { key: "unpaid", label: "Belum Dibayar", badge: "bg-red-100 text-red-700" },
  { key: "pending", label: "Menunggu Konfirmasi", badge: "bg-amber-100 text-amber-700" },
  { key: "paid", label: "Lunas", badge: "bg-emerald-100 text-emerald-700" }
];

/** Ringkasan tagihan per status — konsep INVOICE, terpisah dari transaksi. */
export function ReportInvoiceSection({ invoices }: { invoices: InvoiceStatusCount }) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div>
          <p className="text-sm font-semibold">Status Tagihan (Invoice)</p>
          <p className="text-xs text-muted-foreground">
            Tagihan yang dibuat pada periode ini — bukan uang yang diterima. Uang aktual tercatat di
            bagian transaksi; keduanya sengaja tidak dijumlahkan agar tidak terjadi penghitungan ganda.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Tagihan</p>
            <p className="mt-1 text-lg font-bold">{invoices.total}</p>
          </div>
          {INVOICE_STATUS_CARDS.map((c) => (
            <div key={c.key} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {c.label}
                </p>
                <Badge className={c.badge}>{invoices[c.key]}</Badge>
              </div>
              <p className="mt-1 text-sm font-semibold">{formatIDR(invoices[`${c.key}Value` as const])}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** Ringkasan per properti: okupansi + keuangan (dari transaksi aktual). */
export function ReportPropertyTable({ properties }: { properties: PropertyReport[] }) {
  if (properties.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Belum ada properti.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Properti</TableHead>
                <TableHead>Kamar</TableHead>
                <TableHead>Okupansi</TableHead>
                <TableHead>Pemasukan</TableHead>
                <TableHead>Pengeluaran</TableHead>
                <TableHead>Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Building2 className="size-4" />
                      </div>
                      <p className="font-medium">{p.name}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.totalRooms} kamar · {p.occupied} terisi · {p.vacant} kosong ·{" "}
                    {p.maintenance} perbaikan
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.occupancy === null ? (
                      "-"
                    ) : (
                      `${Math.round(p.occupancy * 100)}% (terisi / total kamar)`
                    )}
                  </TableCell>
                  <TableCell className="text-sm font-medium text-emerald-700">{formatIDR(p.income)}</TableCell>
                  <TableCell className="text-sm font-medium text-red-700">{formatIDR(p.expense)}</TableCell>
                  <TableCell className={`text-sm font-semibold ${p.net >= 0 ? "text-blue-700" : "text-amber-700"}`}>
                    {formatIDR(p.net)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/** Breakdown kategori transaksi, dipisah pemasukan vs pengeluaran. */
export function ReportCategorySection({
  income,
  expense
}: {
  income: { category: TxCategory; label: string; count: number; total: number }[];
  expense: { category: TxCategory; label: string; count: number; total: number }[];
}) {
  const empty = (kind: string) => (
    <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
      Tidak ada transaksi {kind} pada periode ini.
    </p>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardContent className="space-y-2 pt-5">
          <p className="text-sm font-semibold">Kategori Pemasukan</p>
          {income.length === 0 ? (
            empty("pemasukan")
          ) : (
            <ul className="divide-y rounded-lg border">
              {income.map((c) => (
                <li key={c.category} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{c.label}</p>
                    <p className="text-xs text-muted-foreground">{c.count} transaksi</p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-700">{formatIDR(c.total)}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 pt-5">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Kategori Pengeluaran</p>
          </div>
          {expense.length === 0 ? (
            empty("pengeluaran")
          ) : (
            <ul className="divide-y rounded-lg border">
              {expense.map((c) => (
                <li key={c.category} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{c.label}</p>
                    <p className="text-xs text-muted-foreground">{c.count} transaksi</p>
                  </div>
                  <p className="text-sm font-semibold text-red-700">{formatIDR(c.total)}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
