// ============================================================================
// Generator teks "Broadcast ke Agen Sewa" — tanpa API berbayar.
// Hasil teks tinggal disalin (paste) ke WhatsApp / Email.
// ============================================================================

import { formatIDR } from "@/lib/utils";
import type { Room } from "@/lib/types";

export interface VacancyGroup {
  property_id: string;
  property_name: string;
  city: string | null;
  address: string | null;
  rooms: Room[];
}

function roomLine(r: Room): string {
  const price = r.price_monthly > 0
    ? `${formatIDR(r.price_monthly)}/bln`
    : r.price_daily > 0
      ? `${formatIDR(r.price_daily)}/hari`
      : "harga hubungi";
  const fasilitas = r.facilities.length ? ` · ${r.facilities.join(", ")}` : "";
  return `• Kamar ${r.room_number} (${r.room_type}) — ${price}${fasilitas}`;
}

/** Bangun teks status ketersediaan utk satu properti (atau semua properti). */
export function buildAvailabilityMessage(
  groups: VacancyGroup[],
  scope: "all" | string, // "all" atau property_id
  asOf: Date = new Date()
): string {
  const selected =
    scope === "all" ? groups : groups.filter((g) => g.property_id === scope);
  const allVacant = selected.reduce((n, g) => n + g.rooms.length, 0);

  const dateLabel = asOf.toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });

  const lines: string[] = [];
  lines.push(`Halo! Update ketersediaan kamar kosong per ${dateLabel}:`);
  lines.push("");

  if (allVacant === 0) {
    lines.push("Saat ini belum ada kamar kosong. Insya Allah segera ada update lagi. 🙏");
    return lines.join("\n");
  }

  for (const g of selected) {
    lines.push(`🏠 ${g.property_name}${g.city ? ` — ${g.city}` : ""}`);
    if (g.address) lines.push(`📍 ${g.address}`);
    for (const r of g.rooms) lines.push(roomLine(r));
    lines.push("");
  }

  lines.push(`Total ${allVacant} kamar tersedia.`);
  lines.push("Tertarik / ada calon penyewa? Silakan balas chat ini ya. Terima kasih!");
  return lines.join("\n");
}

/** Normalisasi nomor HP Indonesia utk link wa.me (08xx -> 62xx). */
export function normalizeWaNumber(contact: string): string {
  const digits = contact.replace(/\D/g, "");
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  return digits;
}

export function whatsappShareLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function whatsappAgentLink(contact: string, text?: string): string {
  const base = `https://wa.me/${normalizeWaNumber(contact)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function emailAgentLink(contact: string, subject: string, body: string): string {
  const params = new URLSearchParams({ subject, body });
  return `mailto:${contact}?${params.toString()}`;
}
