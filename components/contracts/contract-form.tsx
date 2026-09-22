"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { BILLING_CYCLE, CONTRACT_STATUS } from "@/lib/constants";
import { formatIDR } from "@/lib/utils";
import type { BillingCycle, ContractStatus } from "@/lib/constants";
import type { ContractFormData, ContractInput } from "@/app/(dashboard)/contracts/actions";
import type { ContractWithDetails } from "@/lib/types";

interface ContractFormProps {
  initialData?: ContractWithDetails | null;
  formData: ContractFormData;
  onSubmit: (data: ContractInput) => Promise<{ ok: boolean; error?: string }>;
  onCancel: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ContractForm({ initialData, formData, onSubmit, onCancel }: ContractFormProps) {
  const [tenantId, setTenantId] = React.useState(initialData?.tenant_id || formData.tenants[0]?.id || "");
  const [propertyId, setPropertyId] = React.useState(initialData?.property_id || formData.properties[0]?.id || "");
  const [roomId, setRoomId] = React.useState(initialData?.room_id || "");
  const [startDate, setStartDate] = React.useState(initialData?.start_date || todayIso());
  const [endDate, setEndDate] = React.useState(initialData?.end_date ?? "");
  const [dueDay, setDueDay] = React.useState(String(initialData?.due_day ?? 1));
  const [billingCycle, setBillingCycle] = React.useState<BillingCycle>(initialData?.billing_cycle ?? "monthly");
  const [rentAmount, setRentAmount] = React.useState(String(initialData?.rent_amount ?? ""));
  const [depositAmount, setDepositAmount] = React.useState(String(initialData?.deposit_amount ?? ""));
  const [status, setStatus] = React.useState<ContractStatus>(initialData?.status ?? "active");
  const [notes, setNotes] = React.useState(initialData?.notes || "");

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Kamar difilter sesuai properti yang dipilih (UX); validasi ulang tetap di server.
  const roomsOfProperty = React.useMemo(
    () => formData.rooms.filter((r) => r.property_id === propertyId),
    [formData.rooms, propertyId]
  );

  // Kamar dgn kontrak aktif lain tidak boleh jadi pilihan utk kontrak ACTIVE
  // (kontrak yang sedang diedit dikecualikan dari daftar "terpakai").
  const activeRoomIds = React.useMemo(() => {
    const used = new Set(formData.activeContractRoomIds);
    if (initialData && status === "active") used.delete(initialData.room_id);
    return used;
  }, [formData.activeContractRoomIds, initialData, status]);

  const roomBlockedByActive =
    status === "active" && roomId !== "" && roomId !== initialData?.room_id && activeRoomIds.has(roomId);

  function handlePropertyChange(nextPropertyId: string) {
    setPropertyId(nextPropertyId);
    // Reset kamar bila kamar saat ini tidak termasuk properti baru
    const stillValid = formData.rooms.some((r) => r.id === roomId && r.property_id === nextPropertyId);
    if (!stillValid) setRoomId("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!tenantId) {
      setError("Penyewa wajib dipilih.");
      return;
    }
    if (!propertyId) {
      setError("Properti wajib dipilih.");
      return;
    }
    if (!roomId) {
      setError("Kamar wajib dipilih.");
      return;
    }
    if (roomBlockedByActive) {
      setError("Kamar ini sudah memiliki kontrak aktif. Pilih kamar lain atau ubah status kontrak.");
      return;
    }

    const due = Number(dueDay);
    if (!Number.isInteger(due) || due < 1 || due > 28) {
      setError("Tanggal jatuh tempo harus angka 1 sampai 28.");
      return;
    }
    if (Number(rentAmount) < 0 || Number(depositAmount) < 0) {
      setError("Harga sewa dan deposit tidak boleh negatif.");
      return;
    }
    if (endDate && endDate < startDate) {
      setError("Tanggal berakhir tidak boleh sebelum tanggal mulai.");
      return;
    }

    setSubmitting(true);
    const res = await onSubmit({
      tenant_id: tenantId,
      property_id: propertyId,
      room_id: roomId,
      start_date: startDate,
      end_date: endDate || null,
      due_day: due,
      billing_cycle: billingCycle,
      rent_amount: Number(rentAmount) || 0,
      deposit_amount: Number(depositAmount) || 0,
      status,
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
        <Label htmlFor="contract-tenant">
          Penyewa <span className="text-red-500">*</span>
        </Label>
        <Select
          id="contract-tenant"
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          disabled={busy}
          required
        >
          <option value="" disabled>
            Pilih penyewa
          </option>
          {formData.tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.full_name}
            </option>
          ))}
        </Select>
        {formData.tenants.length === 0 && (
          <p className="text-xs text-amber-600">
            Belum ada penyewa. Tambahkan penyewa terlebih dahulu di menu Penyewa.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="contract-property">
            Properti <span className="text-red-500">*</span>
          </Label>
          <Select
            id="contract-property"
            value={propertyId}
            onChange={(e) => handlePropertyChange(e.target.value)}
            disabled={busy}
            required
          >
            <option value="" disabled>
              Pilih properti
            </option>
            {formData.properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contract-room">
            Kamar <span className="text-red-500">*</span>
          </Label>
          <Select
            id="contract-room"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            disabled={busy || !propertyId}
            required
          >
            <option value="" disabled>
              {propertyId ? "Pilih kamar" : "Pilih properti dahulu"}
            </option>
            {roomsOfProperty.map((r) => {
              const blocked = activeRoomIds.has(r.id) && r.id !== initialData?.room_id;
              return (
                <option key={r.id} value={r.id} disabled={status === "active" && blocked}>
                  {r.room_number}
                  {blocked ? " — sudah ada kontrak aktif" : ""}
                </option>
              );
            })}
          </Select>
          {propertyId && roomsOfProperty.length === 0 && (
            <p className="text-xs text-amber-600">Belum ada kamar pada properti ini.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="contract-start">
            Mulai Kontrak <span className="text-red-500">*</span>
          </Label>
          <Input
            id="contract-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={busy}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contract-end">Berakhir</Label>
          <Input
            id="contract-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={busy}
            min={startDate}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="contract-cycle">Siklus Pembayaran</Label>
          <Select
            id="contract-cycle"
            value={billingCycle}
            onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
            disabled={busy}
          >
            {(Object.keys(BILLING_CYCLE) as BillingCycle[]).map((c) => (
              <option key={c} value={c}>
                {BILLING_CYCLE[c].label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contract-due">Jatuh Tempo (tanggal 1–28)</Label>
          <Input
            id="contract-due"
            type="number"
            min={1}
            max={28}
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
            disabled={busy}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="contract-rent">
            Harga Sewa <span className="text-red-500">*</span>
          </Label>
          <Input
            id="contract-rent"
            type="number"
            min={0}
            step={1000}
            placeholder="contoh: 1500000"
            value={rentAmount}
            onChange={(e) => setRentAmount(e.target.value)}
            disabled={busy}
            required
          />
          {rentAmount !== "" && (
            <p className="text-xs text-muted-foreground">{formatIDR(Number(rentAmount))} / siklus</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contract-deposit">Deposit</Label>
          <Input
            id="contract-deposit"
            type="number"
            min={0}
            step={1000}
            placeholder="contoh: 1500000"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            disabled={busy}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="contract-status">Status</Label>
          <Select
            id="contract-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ContractStatus)}
            disabled={busy}
          >
            {(Object.keys(CONTRACT_STATUS) as ContractStatus[]).map((s) => (
              <option key={s} value={s}>
                {CONTRACT_STATUS[s].label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contract-notes">Catatan</Label>
          <Input
            id="contract-notes"
            placeholder="Catatan kontrak (opsional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={busy}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Batal
        </Button>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
          {initialData ? "Simpan Perubahan" : "Tambah Kontrak"}
        </Button>
      </div>
    </form>
  );
}
