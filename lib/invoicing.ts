// Helper keuangan bersama (server). Base rent = sewa pokok; invoice_items
// hanya berisi biaya tambahan (listrik/air/denda), konsisten dgn migration.

import type { Invoice, InvoiceItem, Tenant } from "@/lib/types";

export function invoiceTotal(
  inv: Pick<Invoice, "id" | "base_rent">,
  items: Pick<InvoiceItem, "invoice_id" | "amount">[]
): number {
  return Number(inv.base_rent) + items.filter((x) => x.invoice_id === inv.id).reduce((s, x) => s + Number(x.amount), 0);
}

/** Bungkus map id invoice -> total agar mudah dipakai di tabel. */
export function invoiceTotals(
  invoices: Invoice[],
  items: Pick<InvoiceItem, "invoice_id" | "amount">[]
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const inv of invoices) map[inv.id] = invoiceTotal(inv, items);
  return map;
}

export interface InvoiceWithExtras extends Invoice {
  tenants?: Pick<Tenant, "id" | "full_name" | "phone"> | null;
  rooms?: { id: string; room_number: string; property_id: string } | null;
}
