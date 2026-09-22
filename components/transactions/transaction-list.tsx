"use client";

import { Building2, ArrowDownCircle, ArrowUpCircle, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { TX_CATEGORIES, TX_TYPES, INVOICE_STATUS } from "@/lib/constants";
import { formatDate, formatIDR } from "@/lib/utils";
import type { TransactionWithDetails } from "@/lib/types";

interface TransactionListProps {
  transactions: TransactionWithDetails[];
  onEdit: (transaction: TransactionWithDetails) => void;
  onDelete: (transaction: TransactionWithDetails) => void;
  onOpenCreate: () => void;
}

export function TransactionList({ transactions, onEdit, onDelete, onOpenCreate }: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <div className="flex min-h-[380px] flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center animate-in fade-in-50">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ArrowDownCircle className="size-8" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">Belum ada transaksi</h3>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          Catatan uang masuk &amp; keluar masih kosong. Pencatatan pembayaran tagihan akan muncul otomatis
          di sini setelah tagihan disetujui, atau catat pengeluaran manual seperti perbaikan &amp; gaji penjaga.
        </p>
        <Button onClick={onOpenCreate} className="mt-5">
          <Plus className="mr-1.5 size-4" />
          Tambah Transaksi
        </Button>
      </div>
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
                <TableHead>Jumlah</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead>Properti</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => {
                const cat = TX_CATEGORIES[t.category];
                const isIncome = t.type === "income";
                const TypeIcon = isIncome ? ArrowDownCircle : ArrowUpCircle;
                return (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap text-sm">{formatDate(t.txn_date)}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          isIncome
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }
                      >
                        <TypeIcon className="mr-1 size-3.5" />
                        {TX_TYPES[t.type].label}
                      </Badge>
                      <p className="mt-1 text-xs text-muted-foreground">{cat?.label ?? t.category}</p>
                    </TableCell>
                    <TableCell
                      className={`whitespace-nowrap font-medium ${
                        isIncome ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {isIncome ? "+" : "-"}
                      {formatIDR(t.amount)}
                    </TableCell>
                    <TableCell className="max-w-64">
                      <p className="truncate text-sm" title={t.description ?? undefined}>
                        {t.description ?? "-"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Building2 className="size-3.5 shrink-0 text-slate-400" />
                        {t.properties?.name ?? "-"}
                      </p>
                    </TableCell>
                    <TableCell>
                      {t.invoice_id ? (
                        <Badge variant="outline" className="text-xs">
                          <FileText className="mr-1 size-3" />
                          {t.invoices?.period_label ?? "Tagihan"}
                          {t.invoices?.status ? ` · ${INVOICE_STATUS[t.invoices.status].label}` : ""}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {/* Edit/hapus hanya utk transaksi manual; transaksi invoice dilindungi (LANGKAH 8) */}
                      {t.invoice_id ? (
                        <span className="text-xs text-muted-foreground" title="Transaksi dari tagihan — dikelola lewat modul Tagihan">
                          Otomatis
                        </span>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(t)}
                            title="Edit transaksi"
                            className="h-8 px-2 text-xs"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(t)}
                            title="Hapus transaksi"
                            className="h-8 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
