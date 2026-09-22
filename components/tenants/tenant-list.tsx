"use client";

import * as React from "react";
import { BadgeCheck, Mail, MapPin, Pencil, Phone, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { DocumentActions } from "@/components/documents/document-actions";
import {
  deleteTenantIdCardAction,
  getTenantIdCardSignedUrlAction,
  uploadTenantIdCardAction
} from "@/app/(dashboard)/tenants/actions";
import type { TenantWithStats } from "@/lib/types";

interface TenantListProps {
  tenants: TenantWithStats[];
  onEdit: (tenant: TenantWithStats) => void;
  onDelete: (tenant: TenantWithStats) => void;
  onOpenCreate: () => void;
}

export function TenantList({ tenants, onEdit, onDelete, onOpenCreate }: TenantListProps) {
  if (tenants.length === 0) {
    return (
      <div className="flex min-h-[380px] flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center animate-in fade-in-50">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Users className="size-8" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">Belum ada penyewa</h3>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          Database profil penyewa Anda masih kosong. Tambahkan penyewa sebelum membuat kontrak sewa.
        </p>
        <Button onClick={onOpenCreate} className="mt-5">
          + Tambah Penyewa
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
                <TableHead>Penyewa</TableHead>
                <TableHead>Kontak</TableHead>
                <TableHead>Alamat</TableHead>
                <TableHead>Kontrak</TableHead>
                <TableHead>Status Akun</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Users className="size-4" />
                      </div>
                      <div className="min-w-0 leading-tight">
                        <p className="truncate font-medium">{t.full_name}</p>
                        {t.notes && (
                          <p className="max-w-52 truncate text-xs text-muted-foreground" title={t.notes}>
                            {t.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5 text-sm">
                      {t.phone && (
                        <p className="flex items-center gap-1.5 text-muted-foreground">
                          <Phone className="size-3.5 shrink-0 text-slate-400" />
                          {t.phone}
                        </p>
                      )}
                      {t.email && (
                        <p className="flex items-center gap-1.5 text-muted-foreground">
                          <Mail className="size-3.5 shrink-0 text-slate-400" />
                          {t.email}
                        </p>
                      )}
                      {!t.phone && !t.email && <span className="text-xs text-muted-foreground">-</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {t.address ? (
                      <p className="flex max-w-52 items-start gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
                        <span className="line-clamp-2">{t.address}</span>
                      </p>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge className="bg-secondary text-secondary-foreground">
                        {t.contract_count} kontrak
                      </Badge>
                      {t.active_contract_count > 0 && (
                        <Badge className="bg-emerald-100 text-emerald-700">
                          {t.active_contract_count} aktif
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {t.user_id ? (
                      <Badge className="bg-blue-100 text-blue-700">
                        <BadgeCheck className="mr-1 size-3.5" />
                        Terhubung
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Tanpa Akun
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-2">
                      <DocumentActions
                        label={`ktp-${t.id}`}
                        filePath={t.id_card_url}
                        uploadLabel="KTP"
                        onUpload={async (file) => uploadTenantIdCardAction(t.id, file)}
                        onDelete={async () => deleteTenantIdCardAction(t.id)}
                        onView={async () => {
                          const res = await getTenantIdCardSignedUrlAction(t.id);
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
                          onClick={() => onEdit(t)}
                          title="Edit penyewa"
                          className="h-8 px-2 text-xs"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(t)}
                          title="Hapus penyewa"
                          className="h-8 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
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
