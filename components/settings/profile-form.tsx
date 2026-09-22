"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { updateProfile } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLES } from "@/lib/constants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Menyimpan..." : "Simpan Perubahan"}
    </Button>
  );
}

function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}

function FieldSuccess() {
  return <p className="text-sm text-green-600">Profil berhasil diperbarui.</p>;
}

export function ProfileForm({
  initialData,
  role,
}: {
  initialData: { full_name: string | null; phone: string | null; email: string | null };
  role: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function action(formData: FormData) {
    setError(null);
    setSuccess(false);

    const fullName = (formData.get("full_name") as string | null)?.trim() ?? null;
    const phone = (formData.get("phone") as string | null)?.trim() ?? null;

    const result = await updateProfile({
      full_name: fullName,
      phone,
    });

    if (result.ok) {
      setSuccess(true);
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="bg-muted/40">
        <CardHeader>
          <CardTitle className="text-base">Informasi Akun</CardTitle>
          <CardDescription>
            Email terdaftar dan peran tidak dapat diubah lewat halaman ini.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            <Label htmlFor="account-email">Email</Label>
            <Input
              id="account-email"
              type="email"
              value={initialData.email || ""}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="account-role">Peran</Label>
            <Input
              id="account-role"
              value={ROLES[role as keyof typeof ROLES]?.label ?? role}
              disabled
              className="bg-muted"
            />
          </div>
        </CardContent>
      </Card>

      <form action={action} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profil</CardTitle>
            <CardDescription>
              Perbarui nama panggilan dan nomor telepon Anda.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="full_name">Nama Lengkap</Label>
              <Input
                id="full_name"
                name="full_name"
                defaultValue={initialData.full_name ?? ""}
                required
                minLength={1}
                maxLength={255}
                autoComplete="name"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Nomor Telepon</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={initialData.phone ?? ""}
                maxLength={50}
                autoComplete="tel"
              />
            </div>

            <FieldError message={error} />
            {success && <FieldSuccess />}

            <div className="flex justify-end">
              <SubmitButton />
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
