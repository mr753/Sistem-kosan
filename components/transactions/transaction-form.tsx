"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { TX_TYPES, TX_CATEGORIES } from "@/lib/constants";
import type { TxType, TxCategory } from "@/lib/constants";
import type { Transaction } from "@/lib/types";
import type { TransactionInput, TransactionFormData } from "@/app/(dashboard)/transactions/actions";

interface TransactionFormProps {
  initialData?: Transaction | null;
  formData: TransactionFormData;
  onSubmit: (data: TransactionInput) => Promise<{ ok: boolean; error?: string }>;
  onCancel: () => void;
}

/** Kategori yang valid per tipe — sesuai enum DB (kategori income vs expense terpisah). */
const CATEGORIES_BY_TYPE: Record<TxType, TxCategory[]> = {
  income: ["rent", "electricity", "water", "deposit"],
  expense: ["maintenance", "salary", "electricity_token", "other"]
};

export function TransactionForm({ initialData, formData, onSubmit, onCancel }: TransactionFormProps) {
  const [propertyId, setPropertyId] = React.useState(initialData?.property_id || "");
  const [type, setType] = React.useState<TxType>(initialData?.type ?? "income");
  const [category, setCategory] = React.useState<TxCategory>(initialData?.category ?? "rent");
  const [amount, setAmount] = React.useState(initialData ? String(Number(initialData.amount)) : "");
  const [txnDate, setTxnDate] = React.useState(
    initialData?.txn_date ? initialData.txn_date.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [description, setDescription] = React.useState(initialData?.description || "");

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Jika tipe berubah dan kategori tak lagi valid, reset ke kategori pertama yang valid
  function handleTypeChange(next: TxType) {
    setType(next);
    if (!CATEGORIES_BY_TYPE[next].includes(category)) {
      setCategory(CATEGORIES_BY_TYPE[next][0]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amt = Number(amount);
    if (!propertyId) {
      setError("Properti wajib dipilih.");
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Jumlah harus berupa angka lebih besar dari 0.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(txnDate)) {
      setError("Tanggal transaksi tidak valid.");
      return;
    }

    setSubmitting(true);
    const res = await onSubmit({
      property_id: propertyId,
      type,
      category,
      amount: amt,
      txn_date: txnDate,
      description: description.trim() || null
    });
    setSubmitting(false);

    if (!res.ok && res.error) {
      setError(res.error);
    }
  }

  const busy = submitting;
  const availableCategories = CATEGORIES_BY_TYPE[type];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="tx-property">
          Properti <span className="text-red-500">*</span>
        </Label>
        {formData.properties.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada properti. Tambahkan properti terlebih dahulu.</p>
        ) : (
          <Select
            id="tx-property"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            disabled={busy}
            required
          >
            <option value="" disabled>
              Pilih properti...
            </option>
            {formData.properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>
          Tipe Transaksi <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(TX_TYPES) as TxType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => handleTypeChange(t)}
              disabled={busy}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                type === t
                  ? t === "income"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                  : "border-input text-muted-foreground hover:bg-accent"
              }`}
            >
              {TX_TYPES[t].label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="tx-category">
            Kategori <span className="text-red-500">*</span>
          </Label>
          <Select
            id="tx-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as TxCategory)}
            disabled={busy}
          >
            {availableCategories.map((c) => (
              <option key={c} value={c}>
                {TX_CATEGORIES[c].label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tx-amount">
            Jumlah (Rp) <span className="text-red-500">*</span>
          </Label>
          <Input
            id="tx-amount"
            type="number"
            min={1}
            step={1}
            placeholder="cth: 750000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={busy}
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tx-date">
          Tanggal <span className="text-red-500">*</span>
        </Label>
        <Input
          id="tx-date"
          type="date"
          value={txnDate}
          onChange={(e) => setTxnDate(e.target.value)}
          disabled={busy}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tx-description">Keterangan</Label>
        <Textarea
          id="tx-description"
          placeholder="cth: Perbaikan keran air kamar K03"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={busy}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Batal
        </Button>
        <Button type="submit" disabled={busy || formData.properties.length === 0}>
          {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
          {initialData ? "Simpan Perubahan" : "Tambah Transaksi"}
        </Button>
      </div>
    </form>
  );
}
