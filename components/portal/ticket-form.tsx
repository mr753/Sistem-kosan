"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, X } from "lucide-react";
import { uploadUserFiles } from "@/lib/upload-client";
import { STORAGE_BUCKETS } from "@/lib/constants";
import { createTicketAction } from "@/app/portal/komplain/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function TicketForm({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [picked, setPicked] = React.useState<File[]>([]);

  if (!enabled) {
    return (
      <p className="text-sm text-muted-foreground">
        Belum ada kontrak aktif — komplain belum dapat dikirim. Hubungi pengelola jika ini keliru.
      </p>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(false);
    const fd = new FormData(e.currentTarget);
    try {
      let photos: string[] = [];
      if (picked.length) {
        const up = await uploadUserFiles(STORAGE_BUCKETS.ticketPhotos, "ticket", picked);
        if (up.error) {
          setError(up.error);
          setBusy(false);
          return;
        }
        photos = up.paths;
      }
      const res = await createTicketAction({
        subject: String(fd.get("subject") ?? ""),
        description: String(fd.get("description") ?? ""),
        priority: (fd.get("priority") as "low" | "medium" | "high") ?? "medium",
        photos
      });
      if (!res.ok) {
        setError(res.error);
        setBusy(false);
        return;
      }
      setSuccess(true);
      (e.target as HTMLFormElement).reset();
      setPicked([]);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="subject">Subjek *</Label>
        <Input id="subject" name="subject" required maxLength={200} placeholder="cth: Lampu kamar mati" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Deskripsi</Label>
        <Textarea id="description" name="description" placeholder="Ceritakan detail kerusakan / kebutuhan perbaikan..." />
      </div>
      <div className="space-y-2">
        <Label htmlFor="priority">Prioritas</Label>
        <Select id="priority" name="priority" defaultValue="medium">
          <option value="low">Rendah</option>
          <option value="medium">Sedang</option>
          <option value="high">Tinggi</option>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Foto (opsional, maks 3 × 1,5 MB)</Label>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => setPicked(Array.from(e.target.files ?? []).slice(0, 3))}
          />
          {picked.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setPicked([]);
                setError(null);
              }}
            >
              <X className="size-4" /> Bersihkan ({picked.length})
            </Button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">Komplain terkirim ke pengelola.</p>}

      <Button type="submit" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        Kirim Komplain
      </Button>
    </form>
  );
}
