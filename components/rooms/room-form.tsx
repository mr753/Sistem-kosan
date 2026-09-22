"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Room, Property } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ROOM_STATUS, ROOM_STATUS_KEYS, type RoomStatus } from "@/lib/constants";

interface RoomFormProps {
  initialData?: Room;
  properties: Property[];
  onSubmit: (data: RoomFormData) => Promise<{ ok: boolean; error?: string }>;
  onCancel: () => void;
}

/** Bentuk data yang dikirim form ke client handler. */
export interface RoomFormData {
  property_id: string;
  room_number: string;
  floor: string;
  room_type: string;
  facilities: string[];
  price_monthly: number;
  price_daily: number;
  price_yearly: number;
  status: RoomStatus;
  notes: string;
}

export function RoomForm({ initialData, properties, onSubmit, onCancel }: RoomFormProps) {
  const [formData, setFormData] = React.useState<RoomFormData>({
    property_id: initialData?.property_id || properties[0]?.id || "",
    room_number: initialData?.room_number || "",
    floor: initialData?.floor || "",
    room_type: initialData?.room_type || "Standar",
    facilities: initialData?.facilities || [],
    price_monthly: Number(initialData?.price_monthly ?? 0),
    price_daily: Number(initialData?.price_daily ?? 0),
    price_yearly: Number(initialData?.price_yearly ?? 0),
    status: initialData?.status || "vacant",
    notes: initialData?.notes || ""
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function update<K extends keyof RoomFormData>(key: K, value: RoomFormData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!formData.property_id) {
      setError("Properti wajib dipilih.");
      return;
    }
    const roomNumber = formData.room_number.trim();
    if (!roomNumber) {
      setError("Nomor kamar wajib diisi.");
      return;
    }
    for (const [field, label] of [
      ["price_monthly", "Harga bulanan"],
      ["price_daily", "Harga harian"],
      ["price_yearly", "Harga tahunan"]
    ] as const) {
      if (!Number.isFinite(Number(formData[field])) || Number(formData[field]) < 0) {
        setError(`${label} tidak boleh negatif.`);
        return;
      }
    }

    setSubmitting(true);
    const res = await onSubmit({ ...formData, room_number: roomNumber });
    setSubmitting(false);

    if (!res.ok && res.error) {
      setError(res.error);
    }
  }

  const busy = submitting || properties.length === 0;

  if (properties.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Belum ada properti. Tambahkan properti terlebih dahulu sebelum menambah kamar.
        </div>
        <div className="flex justify-end pt-2 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>
            Tutup
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="room-property">
            Properti <span className="text-red-500">*</span>
          </Label>
          <Select
            id="room-property"
            value={formData.property_id}
            onChange={(e) => update("property_id", e.target.value)}
            disabled={busy}
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="room-number">
            Nomor Kamar <span className="text-red-500">*</span>
          </Label>
          <Input
            id="room-number"
            placeholder="cth: K01"
            value={formData.room_number}
            onChange={(e) => update("room_number", e.target.value)}
            disabled={busy}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="room-floor">Lantai</Label>
          <Input
            id="room-floor"
            placeholder="cth: 1"
            value={formData.floor}
            onChange={(e) => update("floor", e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="room-type">Tipe Kamar</Label>
          <Input
            id="room-type"
            placeholder="cth: Standar, Deluxe"
            value={formData.room_type}
            onChange={(e) => update("room_type", e.target.value)}
            disabled={busy}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="room-price-monthly">Harga Bulanan (Rp)</Label>
          <Input
            id="room-price-monthly"
            type="number"
            min={0}
            step={1}
            value={formData.price_monthly}
            onChange={(e) => update("price_monthly", Number(e.target.value))}
            disabled={busy}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="room-price-daily">Harga Harian (Rp)</Label>
          <Input
            id="room-price-daily"
            type="number"
            min={0}
            step={1}
            value={formData.price_daily}
            onChange={(e) => update("price_daily", Number(e.target.value))}
            disabled={busy}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="room-price-yearly">Harga Tahunan (Rp)</Label>
          <Input
            id="room-price-yearly"
            type="number"
            min={0}
            step={1}
            value={formData.price_yearly}
            onChange={(e) => update("price_yearly", Number(e.target.value))}
            disabled={busy}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="room-status">Status</Label>
          <Select
            id="room-status"
            value={formData.status}
            onChange={(e) => update("status", e.target.value as RoomStatus)}
            disabled={busy}
          >
            {ROOM_STATUS_KEYS.map((s) => (
              <option key={s} value={s}>
                {ROOM_STATUS[s].label}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">
            Status otomatis mengikuti kontrak aktif; pilih Pemeliharaan untuk kamar yang sedang diperbaiki.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="room-notes">Catatan</Label>
          <Input
            id="room-notes"
            placeholder="Catatan tambahan..."
            value={formData.notes}
            onChange={(e) => update("notes", e.target.value)}
            disabled={busy}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Batal
        </Button>
        <Button type="submit" disabled={busy}>
          {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
          {initialData ? "Simpan Perubahan" : "Tambah Kamar"}
        </Button>
      </div>
    </form>
  );
}
