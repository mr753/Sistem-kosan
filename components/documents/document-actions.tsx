"use client";

import * as React from "react";
import { FileText, Loader2, UploadCloud, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DocumentActionProps {
  label: string;
  filePath: string | null;
  uploadLabel?: string;
  onUpload: (file: File) => Promise<{ ok: boolean; error?: string }>;
  onDelete: () => Promise<{ ok: boolean; error?: string }>;
  onView?: () => Promise<{ ok: boolean; url?: string | null; error?: string }>;
}

export function DocumentActions({
  label,
  filePath,
  uploadLabel = "Unggah",
  onUpload,
  onDelete,
  onView
}: DocumentActionProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [viewUrl, setViewUrl] = React.useState<string | null>(null);

  function handleDeleteClick() {
    if (!window.confirm("Yakin ingin menghapus dokumen ini? Tindakan ini tidak dapat dibatalkan.")) return;
    void handleDelete();
  }

  async function handleSelect(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const res = await onUpload(file);
      if (!res.ok) {
        setError(res.error ?? "Gagal memproses dokumen.");
        return;
      }
      setViewUrl(null);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleView() {
    if (!onView) return;
    setBusy(true);
    setError(null);
    try {
      const res = await onView();
      if (!res.ok) {
        setError(res.error ?? "Dokumen tidak tersedia.");
        return;
      }
      if (res.url) {
        setViewUrl(res.url);
        window.open(res.url, "_blank", "noopener,noreferrer");
      } else {
        setError("Dokumen belum tersedia.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await onDelete();
      if (!res.ok) {
        setError(res.error ?? "Gagal menghapus dokumen.");
        return;
      }
      setViewUrl(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
          <FileText className="size-3" />
          {filePath ? "Ada" : "Belum ada"}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => handleSelect(e.target.files?.[0])}
          id={`${label}-doc-input`}
        />

        {filePath ? (
          <>
            <Button type="button" variant="outline" size="sm" onClick={handleView} disabled={busy}>
              {busy ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Eye className="mr-1 size-3" />}
              Lihat
            </Button>
            <label htmlFor={`${label}-doc-input`} className="cursor-pointer">
              <Button type="button" variant="secondary" size="sm" className="pointer-events-none" disabled={busy}>
                <UploadCloud className="mr-1 size-3" />
                Ganti
              </Button>
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDeleteClick}
              disabled={busy}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="mr-1 size-3" />
              Hapus
            </Button>
          </>
        ) : (
          <label htmlFor={`${label}-doc-input`} className="cursor-pointer">
            <Button type="button" variant="outline" size="sm" className="pointer-events-none" disabled={busy}>
              {busy ? <Loader2 className="mr-1 size-3 animate-spin" /> : <UploadCloud className="mr-1 size-3" />}
              {uploadLabel}
            </Button>
          </label>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {viewUrl && <span className="text-[10px] text-muted-foreground">Preview siap dibuka.</span>}
    </div>
  );
}
