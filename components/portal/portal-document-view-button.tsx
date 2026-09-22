"use client";

import * as React from "react";
import { Eye, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Tombol "Lihat" view-only untuk portal penyewa: meminta signed URL dari
 * server action (server mengotorisasi sebelum menandatangani) lalu membukanya
 * di tab baru. Tidak ada upload/delete — dokumen dikelola pengelola kos.
 */
export function PortalDocumentViewButton({
  label,
  hasDocument,
  onView
}: {
  label: string;
  hasDocument: boolean;
  onView: () => Promise<{ ok: boolean; url?: string | null; error?: string }>;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleView() {
    setBusy(true);
    setError(null);
    try {
      const res = await onView();
      if (!res.ok) {
        setError(res.error ?? "Dokumen tidak tersedia.");
        return;
      }
      if (res.url) {
        window.open(res.url, "_blank", "noopener,noreferrer");
      } else {
        setError("Dokumen belum tersedia.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleView}
          disabled={busy || !hasDocument}
        >
          {busy ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Eye className="mr-1 size-3" />}
          {label}
        </Button>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
          <FileText className="size-3" />
          {hasDocument ? "Tersedia" : "Belum ada"}
        </span>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
