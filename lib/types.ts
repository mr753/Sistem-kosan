// ============================================================================
// Tipe domain — bayangan kolom supabase/migrations/0001_init.sql
// (nama field sengaja identik dgn kolom DB agar query aman & mudah diverifikasi)
// ============================================================================

import type {
  AgentChannel, BillingCycle, CommissionType, ContractStatus,
  InvoiceItemKind, InvoiceStatus, NotifType, Role, RoomStatus,
  TicketPriority, TicketStatus, TxCategory, TxType
} from "@/lib/constants";

export interface Profile {
  id: string;
  role: Role;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  owner_id: string;
  name: string;
  address: string | null;
  city: string | null;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PropertyWithStats extends Property {
  total_rooms: number;
  occupied_rooms: number;
  vacant_rooms: number;
  maintenance_rooms: number;
}

export interface Room {
  id: string;
  property_id: string;
  room_number: string;
  floor: string | null;
  room_type: string;
  facilities: string[];
  price_monthly: number;
  price_daily: number;
  price_yearly: number;
  status: RoomStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // relasi opsional saat query memakai select("..., properties(...)")
  properties?: Pick<Property, "id" | "name" | "city"> | null;
}

export interface Tenant {
  id: string;
  user_id: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  id_card_url: string | null;
  id_card_url_signed?: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Tenant + ringkasan kontrak utk halaman dashboard Penyewa. */
export interface TenantWithStats extends Tenant {
  contract_count: number;
  active_contract_count: number;
}

export interface Contract {
  id: string;
  tenant_id: string;
  room_id: string;
  property_id: string;
  start_date: string;
  end_date: string | null;
  due_day: number;
  billing_cycle: BillingCycle;
  rent_amount: number;
  deposit_amount: number;
  status: ContractStatus;
  contract_doc_url: string | null;
  contract_doc_url_signed?: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Kontrak + relasi ringkas utk halaman dashboard Kontrak. */
export interface ContractWithDetails extends Contract {
  tenants?: Pick<Tenant, "id" | "full_name"> | null;
  rooms?: Pick<Room, "id" | "room_number"> | null;
  properties?: Pick<Property, "id" | "name"> | null;
  invoice_count?: number;
}

export interface Invoice {
  id: string;
  contract_id: string;
  tenant_id: string;
  property_id: string;
  room_id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  due_date: string;
  base_rent: number;
  status: InvoiceStatus;
  proof_url: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  label: string;
  kind: InvoiceItemKind;
  amount: number;
  created_at: string;
}

export interface Transaction {
  id: string;
  property_id: string;
  type: TxType;
  category: TxCategory;
  amount: number;
  description: string | null;
  txn_date: string;
  invoice_id: string | null;
  receipt_url: string | null;
  created_by: string | null;
  created_at: string;
}

/** Transaksi + relasi ringkas utk halaman dashboard Keuangan. */
export interface TransactionWithDetails extends Transaction {
  properties?: Pick<Property, "id" | "name"> | null;
  invoices?: Pick<Invoice, "id" | "period_label" | "status"> | null;
}

export interface Ticket {
  id: string;
  tenant_id: string;
  property_id: string;
  room_id: string | null;
  subject: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  photos: string[];
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface Agent {
  id: string;
  owner_id: string;
  property_id: string | null;
  name: string;
  agency_name: string | null;
  channel: AgentChannel;
  contact: string;
  commission_type: CommissionType;
  commission_value: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  properties?: Pick<Property, "id" | "name"> | null;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotifType;
  title: string;
  body: string | null;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

/** Bentuk data untuk komponen Client (harus serializable antar server-client). */
export interface RoomAvailability {
  property_id: string;
  property_name: string;
  city: string | null;
  vacant: Room[];
}
