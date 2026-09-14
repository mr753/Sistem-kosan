"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = React.useState<"tenant" | "landlord">("tenant");
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      const form = new FormData(e.currentTarget);
      const supabase = createClient();

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: String(form.get("email")),
        password: String(form.get("password")),
        options: {
          data: {
            full_name: String(form.get("full_name")),
            phone: String(form.get("phone")),
            role
          }
        }
      });

      if (signUpError) throw signUpError;

      if (data.session) {
        // Jika auto-confirm aktif atau user langsung login
        router.push(role === "tenant" ? "/portal" : "/dashboard");
        router.refresh();
      } else {
        // Jika perlu konfirmasi email
        setInfo("Pendaftaran berhasil! Silakan cek email Anda untuk verifikasi, lalu masuk.");
      }
    } catch (err: unknown) {
      console.error("Registration error:", err);
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat mendaftar. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  const roleOptions: { value: "tenant" | "landlord"; title: string; desc: string }[] = [
    { value: "tenant", title: "Penyewa", desc: "Lihat tagihan, kontrak & kirim komplain" },
    { value: "landlord", title: "Pemilik Kos", desc: "Kelola properti, kamar, dan keuangan" }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daftar Akun</CardTitle>
        <CardDescription>Pilih peran Anda lalu lengkapi data diri.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label className="mb-2 block">Saya mendaftar sebagai</Label>
            <div className="grid grid-cols-2 gap-2">
              {roleOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    role === opt.value
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "hover:bg-accent"
                  )}
                >
                  <p className="text-sm font-semibold">{opt.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="full_name">Nama Lengkap</Label>
            <Input id="full_name" name="full_name" required placeholder="cth: Andi Saputra" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">No. HP</Label>
            <Input id="phone" name="phone" type="tel" placeholder="08xx-xxxx-xxxx" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required placeholder="nama@email.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Kata Sandi</Label>
            <Input id="password" name="password" type="password" required minLength={6} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {info && <p className="text-sm text-emerald-600">{info}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Memproses..." : "Daftar"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Sudah punya akun?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Masuk
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
