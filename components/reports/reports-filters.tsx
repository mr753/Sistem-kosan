"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ReportsFilterState } from "@/lib/queries/reports";

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
] as const;

/** Pilihan bulan: 24 bulan terakhir (bulan berjalan paling atas). */
function monthOptions(): { value: string; label: string }[] {
  const now = new Date();
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ value, label: `${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}` });
  }
  return out;
}

/** Pilihan tahun: 3 tahun terakhir. */
function yearOptions(): { value: string; label: string }[] {
  const y = new Date().getFullYear();
  return [y, y - 1, y - 2].map((v) => ({ value: String(v), label: String(v) }));
}

interface ReportsFiltersProps {
  state: ReportsFilterState;
  properties: { id: string; name: string }[];
  showPropertyFilter: boolean;
}

/**
 * Filter periode (bulanan/tahunan) + properti.
 * Perubahan filter menulis ke URL query (?mode=&month=&year=&property=) sehingga
 * seluruh laporan dihitung ulang server-side dengan filter yang sama.
 */
export function ReportsFilters({ state, properties, showPropertyFilter }: ReportsFiltersProps) {
  const router = useRouter();
  const months = monthOptions();
  const years = yearOptions();

  function update(next: Partial<ReportsFilterState>) {
    const merged: ReportsFilterState = { ...state, ...next };
    const params = new URLSearchParams();
    params.set("mode", merged.mode);
    if (merged.mode === "month") {
      params.set("month", merged.month);
    } else {
      params.set("year", merged.year);
    }
    params.set("property", merged.propertyId);
    router.push(`/reports?${params.toString()}`);
  }

  return (
    <Card>
      <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="reports-mode">Mode Periode</Label>
          <Select
            id="reports-mode"
            value={state.mode}
            onChange={(e) => update({ mode: e.target.value === "year" ? "year" : "month" })}
          >
            <option value="month">Bulanan</option>
            <option value="year">Tahunan</option>
          </Select>
        </div>

        {state.mode === "month" ? (
          <div className="space-y-1.5">
            <Label htmlFor="reports-month">Bulan</Label>
            <Select
              id="reports-month"
              value={state.month}
              onChange={(e) => update({ month: e.target.value })}
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="reports-year">Tahun</Label>
            <Select
              id="reports-year"
              value={state.year}
              onChange={(e) => update({ year: e.target.value })}
            >
              {years.map((y) => (
                <option key={y.value} value={y.value}>
                  {y.label}
                </option>
              ))}
            </Select>
          </div>
        )}

        {showPropertyFilter && (
          <div className="space-y-1.5">
            <Label htmlFor="reports-property">Properti</Label>
            <Select
              id="reports-property"
              value={state.propertyId}
              onChange={(e) => update({ propertyId: e.target.value })}
            >
              <option value="all">Semua Properti</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
