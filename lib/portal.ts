// ============================================================================
// Query portal penyewa (server-only). Semua nama kolom mengikuti migration.
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Contract, Invoice, InvoiceItem, Room, Tenant } from "@/lib/types";

export interface PortalContract extends Contract {
  rooms?: Room | null;
  properties?: { id: string; name: string; address: string | null; city: string | null } | null;
}

export interface PortalInvoice extends Invoice {
  rooms?: { id: string; room_number: string } | null;
}

export interface PortalData {
  tenant: Tenant | null;
  contracts: PortalContract[];
  invoices: PortalInvoice[];
  itemsByInvoice: Record<string, InvoiceItem[]>;
}

export async function getMyPortalData(
  supabase: SupabaseClient,
  userId: string
): Promise<PortalData> {
  const empty: PortalData = { tenant: null, contracts: [], invoices: [], itemsByInvoice: {} };

  const { data: tenant } = await supabase
    .from("tenants")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!tenant) return empty;

  const [contractsRes, invoicesRes] = await Promise.all([
    supabase
      .from("contracts")
      .select("*, rooms(*), properties(id,name,address,city)")
      .eq("tenant_id", tenant.id)
      .order("start_date", { ascending: false }),
    supabase
      .from("invoices")
      .select("*, rooms(id,room_number)")
      .eq("tenant_id", tenant.id)
      .order("period_start", { ascending: false })
  ]);

  const contracts = (contractsRes.data ?? []) as unknown as PortalContract[];
  const invoices = (invoicesRes.data ?? []) as unknown as PortalInvoice[];
  const itemsByInvoice: Record<string, InvoiceItem[]> = {};

  if (invoices.length) {
    const { data: items } = await supabase
      .from("invoice_items")
      .select("*")
      .in("invoice_id", invoices.map((i) => i.id));
    for (const it of (items ?? []) as InvoiceItem[]) {
      (itemsByInvoice[it.invoice_id] ??= []).push(it);
    }
  }

  return { tenant: tenant as Tenant, contracts, invoices, itemsByInvoice };
}

/** Kontrak aktif pertama milik penyewa (untuk konteks komplain baru). */
export function activeContract(data: PortalData): PortalContract | undefined {
  return data.contracts.find((c) => c.status === "active");
}
