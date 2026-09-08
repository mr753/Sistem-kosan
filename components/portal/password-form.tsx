"use client";

import * as React from "react";
import { Loader2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordForm() {
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const p1 = String(fd.get("p1") ?? "");
    const p2 = String(fd.get("p2") ?? "");
    if (p1.length < 6) {
      setErr("Kata sandi minimal 6 karakter.");
      setBusy(false);
      return;
    }
    if (p1 !== p2) {
      setErr("Konfirmasi kata sandi tidak sama.");
      setBusy(false);
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: p1 });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    (e.target as HTMLFormElement).reset();
    setMsg("Kata sandi berhasil diganti.");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="p1">Kata sandi baru</Label>
        <Input id="p1" name="p1" type="password" required minLength={6} autoComplete="new-password" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="p2">Ulangi kata sandi</Label>
        <Input id="p2" name="p2" type="password" required minLength={6} autoComplete="new-password" />
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {msg && <p className="text-sm text-emerald-600">{msg}</p>}
      <Button type="submit" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Ganti Kata Sandi
      </Button>
    </form>
  );
}
