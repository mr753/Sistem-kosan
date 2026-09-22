"use client";

import * as React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import type { ContractWithDetails } from "@/lib/types";

interface DeleteContractModalProps {
  open: boolean;
  contract: ContractWithDetails | null;
  onClose: () => void;
  onConfirm: (id: string) => Promise<{ ok: boolean; error?: string }>;
}

export function DeleteContractModal({
  open,
  contract,
  onClose,
  onConfirm
}: DeleteContractModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setError(null);
      setLoading(false);
    }
  }, [open]);

  if (!contract) return null;

  const hasInvoices = (contract.invoice_count ?? 0) > 0;
  const isActive = contract.status === "active";

  async function handleDelete() {
    if (!contract) return;
    setLoading(true);
    setError(null);

    const res = await onConfirm(contract.id);
    setLoading(false);

    if (!res.ok && res.error) {
      setError(res.error);
    } else {
      onClose();
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Hapus Kontrak">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-900">
          <AlertTriangle className="size-5 shrink-0 text-red-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">
              Hapus kontrak <strong>{contract.tenants?.full_name ?? "Penyewa"}</strong> — Kamar{" "}
              <strong>{contract.rooms?.room_number ?? "-"}</strong>?
            </p>
            {hasInvoices ? (
              <p className="mt-1 text-red-700">
                Kontrak ini sudah memiliki <strong>{contract.invoice_count} tagihan</strong>. Penghapusan ditolak
                agar riwayat tagihan &amp; pembayaran tetap utuh. Gunakan <strong>Edit</strong> untuk mengubah
                status menjadi &ldquo;Dihentikan&rdquo; atau &ldquo;Berakhir&rdquo;.
              </p>
            ) : isActive ? (
              <p className="mt-1 text-red-700">
                Kontrak ini masih <strong>Aktif</strong>. Menghapusnya akan mengembalikan status kamar menjadi
                Kosong. Tindakan ini tidak dapat dibatalkan.
              </p>
            ) : (
              <p className="mt-1 text-red-700">Tindakan ini tidak dapat dibatalkan.</p>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-100 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={loading || hasInvoices}
            title={hasInvoices ? "Kontrak dengan tagihan tidak dapat dihapus" : undefined}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Menghapus...
              </>
            ) : (
              "Hapus Kontrak"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
