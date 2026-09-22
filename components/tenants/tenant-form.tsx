"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { Tenant } from "@/lib/types";
import type { TenantInput } from "@/app/(dashboard)/tenants/actions";

interface TenantFormProps {
  initialData?: Tenant | null;
  onSubmit: (data: TenantInput) => Promise<{ ok: boolean; error?: string }>;
  onCancel: () => void;
}

export function TenantForm({ initialData, onSubmit, onCancel }: TenantFormProps) {
  const [fullName, setFullName] = React.useState(initialData?.full_name || "");
  const [phone, setPhone] = React.useState(initialData?.phone || "");
  const [email, setEmail] = React.useState(initialData?.email || "");
  const [address, setAddress] = React.useState(initialData?.address || "");
  const [ecName, setEcName] = React.useState(initialData?.emergency_contact_name || "");
  const [ecPhone, setEcPhone] = React.useState(initialData?.emergency_contact_phone || "");
  const [notes, setNotes] = React.useState(initialData?.notes || "");

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setError("Nama lengkap wajib diisi (minimal 2 karakter).");
      return;
    }

    setSubmitting(true);
    const res = await onSubmit({
      full_name: trimmedName,
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      emergency_contact_name: ecName.trim() || null,
      emergency_contact_phone: ecPhone.trim() || null,
      notes: notes.trim() || null
    });
    setSubmitting(false);

    if (!res.ok && res.error) {
      setError(res.error);
    }
  }

  const busy = submitting;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="tenant-name">
          Nama Lengkap <span className="text-red-500">*</span>
        </Label>
        <Input
          id="tenant-name"
          placeholder="contoh: Andi Saputra"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={busy}
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="tenant-phone">Nomor Telepon</Label>
          <Input
            id="tenant-phone"
            type="tel"
            placeholder="08xx-xxxx-xxxx"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tenant-email">Email</Label>
          <Input
            id="tenant-email"
            type="email"
            placeholder="nama@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tenant-address">Alamat</Label>
        <Input
          id="tenant-address"
          placeholder="contoh: Jl. Kenanga No. 3, Yogyakarta"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          disabled={busy}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="tenant-ec-name">Nama Kontak Darurat</Label>
          <Input
            id="tenant-ec-name"
            placeholder="cth: Ibu Sari (ibu kandung)"
            value={ecName}
            onChange={(e) => setEcName(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tenant-ec-phone">Telepon Kontak Darurat</Label>
          <Input
            id="tenant-ec-phone"
            type="tel"
            placeholder="08xx-xxxx-xxxx"
            value={ecPhone}
            onChange={(e) => setEcPhone(e.target.value)}
            disabled={busy}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tenant-notes">Catatan</Label>
        <Textarea
          id="tenant-notes"
          placeholder="Catatan tambahan tentang penyewa..."
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={busy}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Batal
        </Button>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
          {initialData ? "Simpan Perubahan" : "Tambah Penyewa"}
        </Button>
      </div>
    </form>
  );
}
