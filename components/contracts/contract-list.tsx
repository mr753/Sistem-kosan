"use client";

import * as React from "react";
import { Building2, DoorOpen, FileSignature, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { DocumentActions } from "@/components/documents/document-actions";
import {
  deleteContractDocumentAction,
  getContractDocumentSignedUrlAction,
  uploadContractDocumentAction
} from "@/app/(dashboard)/contracts/actions";
import { BILLING_CYCLE, CONTRACT_STATUS } from "@/lib/constants";
import { formatDate, formatIDR } from "@/lib/utils";
import type { ContractWithDetails } from "@/lib/types";

interface ContractListProps {
  contracts: ContractWithDetails[];
  onEdit: (contract: ContractWithDetails) => void;
  onDelete: (contract: ContractWithDetails) => void;
  onOpenCreate: () => void;
}

export function ContractList({ contracts, onEdit, onDelete, onOpenCreate }: ContractListProps) {
  if (contracts.length === 0) {
    return (
      <div className="flex min-h-[380px] flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center animate-in fade-in-50">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <FileSignature className="size-8" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">Belum ada kontrak</h3>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          Kontrak menghubungkan penyewa dengan kamar dan menjadi dasar pembuatan tagihan bulanan.
        </p>
        <Button onClick={onOpenCreate} className="mt-5">
          + Tambah Kontrak
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
                <TableHead>Penyewa / Kamar</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead>Harga Sewa</TableHead>
                <TableHead>Deposit</TableHead>
                <TableHead>Jatuh Tempo</TableHead>
                <TableHead>Siklus</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((c) => {
                const st = CONTRACT_STATUS[c.status];
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <p className="font-medium">{c.tenants?.full_name ?? "Penyewa"}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="size-3 shrink-0" />
                        {c.properties?.name ?? "-"}
                        <DoorOpen className="ml-1 size-3 shrink-0" />
                        Kamar {c.rooms?.room_number ?? "-"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{formatDate(c.start_date)}</p>
                      <p className="text-xs text-muted-foreground">
                        s/d {c.end_date ? formatDate(c.end_date) : "terbuka"}
                      </p>
                    </TableCell>
                    <TableCell className="font-medium">{formatIDR(c.rent_amount)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatIDR(c.deposit_amount)}</TableCell>
                    <TableCell className="text-sm">Tanggal {c.due_day}</TableCell>
                    <TableCell className="text-sm">{BILLING_CYCLE[c.billing_cycle].label}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge className={st.badge}>{st.label}</Badge>
                        {(c.invoice_count ?? 0) > 0 && (
                          <Badge className="bg-secondary text-secondary-foreground">
                            {c.invoice_count} tagihan
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-2">
                        <DocumentActions
                          label={`contract-${c.id}`}
                          filePath={c.contract_doc_url}
                          uploadLabel="Dokumen"
                          onUpload={async (file) => uploadContractDocumentAction(c.id, file)}
                          onDelete={async () => deleteContractDocumentAction(c.id)}
                          onView={async () => {
                            const res = await getContractDocumentSignedUrlAction(c.id);
                            return {
                              ok: res.ok,
                              url: res.ok ? res.data?.url ?? null : null,
                              error: res.ok ? undefined : res.error
                            };
                          }}
                        />
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(c)}
                            title="Edit kontrak"
                            className="h-8 px-2 text-xs"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(c)}
                            title="Hapus kontrak"
                            className="h-8 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
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
