import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format angka ke Rupiah, mis. Rp 1.500.000 */
export function formatIDR(value: number | string | null | undefined, opts?: { compact?: boolean }) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
    notation: opts?.compact ? "compact" : "standard"
  }).format(n);
}

/** Format tanggal ISO -> "5 Sep 2026" */
export function formatDate(iso: string | null | undefined) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

/** Format tanggal + jam ISO -> "5 Sep 2026, 09.30" */
export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/** Nama bulan pendek, mis. "Sep" */
export function monthShort(date: Date) {
  return date.toLocaleDateString("id-ID", { month: "short" });
}

export function getInitials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}
