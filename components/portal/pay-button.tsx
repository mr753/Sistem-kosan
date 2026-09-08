"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, UploadCloud } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadUserFile } from "@/lib/upload-client";
import { STORAGE_BUCKETS } from "@/lib/constants";
import { Button } from "@/components/ui/button";

/**
 * Upload bukti transfer (manual) ke bucket privat payment-proofs, lalu memanggil
 * RPC confirm_payment (security definer) — penyewa TIDAK bisa ubah status sendiri.
 */
export function PayButton({ invoiceId, total, period }: { invoiceId: string; total: string; period: string }) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const up = await uploadUserFile(STORAGE_BUCKETS.paymentProofs, `inv-${invoiceId}`, file);
      if (!up.path) {
        setMsg(up.error ?? "Gagal mengunggah bukti.");
        return;
      }
      const supabase = createClient();
      const { data: ok, error } = await supabase.rpc("confirm_payment", {
        p_invoice_id: invoiceId,
        p_proof_path: up.path
      });
      if (error) {
        setMsg(`Gagal mengirim bukti: ${error.message}`);
        return;
      }
      if (!ok) {
        setMsg("Bukti tidak dapat diproses. Pastikan status tagihan masih Belum Dibayar.");
        return;
      }
      setMsg("Bukti terkirim — status menjadi Menunggu Konfirmasi.");
      router.refresh();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
        id={`pay-${invoiceId}`}
      />
      <label htmlFor={`pay-${invoiceId}`} className="cursor-pointer">
        <Button type="button" disabled={busy} className="pointer-events-none">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
          {busy ? "Mengunggah..." : "Upload Bukti Transfer"}
        </Button>
      </label>
      <p className="text-xs text-muted-foreground">
        Transfer <b>{total}</b> untuk {period}, lalu unggah buktinya (JPG/PNG, maks 1,5 MB).
      </p>
      {msg && (
        <p className={msg.includes("terkirim") ? "flex items-center gap-1 text-sm text-emerald-600" : "text-sm text-red-600"}>
          {msg.includes("terkirim") && <CheckCircle2 className="size-4" />}
          {msg}
        </p>
      )}
    </div>
  );
}
