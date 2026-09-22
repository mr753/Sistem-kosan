"use client";

import * as React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import type { Room } from "@/lib/types";

interface DeleteRoomModalProps {
  open: boolean;
  room: Room | null;
  onClose: () => void;
  onConfirm: (room: Room) => Promise<{ ok: boolean; error?: string }>;
}

export function DeleteRoomModal({ open, room, onClose, onConfirm }: DeleteRoomModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setError(null);
      setLoading(false);
    }
  }, [open]);

  if (!room) return null;

  async function handleDelete() {
    if (!room) return;
    setLoading(true);
    setError(null);

    const res = await onConfirm(room);
    setLoading(false);

    if (!res.ok && res.error) {
      setError(res.error);
    } else {
      onClose();
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Hapus Kamar">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-900">
          <AlertTriangle className="size-5 shrink-0 text-red-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">
              Apakah Anda yakin ingin menghapus kamar{" "}
              <strong>&ldquo;{room.room_number}&rdquo;</strong>?
            </p>
            <p className="mt-1 text-red-700">
              Kamar yang masih memiliki kontrak (aktif maupun riwayat) tidak dapat dihapus.
              Tindakan ini tidak dapat dibatalkan.
            </p>
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
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Menghapus...
              </>
            ) : (
              "Hapus Kamar"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
