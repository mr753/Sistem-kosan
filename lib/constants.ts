// ============================================================================
// Enum & label UI — harus konsisten dengan supabase/migrations/0001_init.sql
// ============================================================================

export const ROLES = {
  super_admin: { label: "Super Admin", badge: "bg-purple-100 text-purple-700" },
  landlord: { label: "Pemilik Kos", badge: "bg-blue-100 text-blue-700" },
  tenant: { label: "Penyewa", badge: "bg-emerald-100 text-emerald-700" }
} as const;
export type Role = keyof typeof ROLES;

export const ROOM_STATUS = {
  vacant: { label: "Kosong", badge: "bg-sky-100 text-sky-700", dot: "bg-sky-500" },
  occupied: { label: "Terisi", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  maintenance: { label: "Pemeliharaan", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" }
} as const;
export type RoomStatus = keyof typeof ROOM_STATUS;
export const ROOM_STATUS_KEYS = Object.keys(ROOM_STATUS) as RoomStatus[];

export const INVOICE_STATUS = {
  unpaid: { label: "Belum Dibayar", badge: "bg-red-100 text-red-700" },
  pending_confirmation: { label: "Menunggu Konfirmasi", badge: "bg-amber-100 text-amber-700" },
  paid: { label: "Lunas", badge: "bg-emerald-100 text-emerald-700" }
} as const;
export type InvoiceStatus = keyof typeof INVOICE_STATUS;

export const BILLING_CYCLE = {
  daily: { label: "Harian" },
  monthly: { label: "Bulanan" },
  yearly: { label: "Tahunan" }
} as const;
export type BillingCycle = keyof typeof BILLING_CYCLE;

export const CONTRACT_STATUS = {
  active: { label: "Aktif", badge: "bg-emerald-100 text-emerald-700" },
  expired: { label: "Berakhir", badge: "bg-slate-200 text-slate-600" },
  terminated: { label: "Dihentikan", badge: "bg-red-100 text-red-700" }
} as const;
export type ContractStatus = keyof typeof CONTRACT_STATUS;

export const TICKET_STATUS = {
  open: { label: "Baru", badge: "bg-red-100 text-red-700" },
  in_progress: { label: "Dikerjakan", badge: "bg-blue-100 text-blue-700" },
  resolved: { label: "Selesai", badge: "bg-emerald-100 text-emerald-700" },
  closed: { label: "Ditutup", badge: "bg-slate-200 text-slate-600" }
} as const;
export type TicketStatus = keyof typeof TICKET_STATUS;

export const TICKET_PRIORITY = {
  low: { label: "Rendah", badge: "bg-slate-100 text-slate-600" },
  medium: { label: "Sedang", badge: "bg-amber-100 text-amber-700" },
  high: { label: "Tinggi", badge: "bg-red-100 text-red-700" }
} as const;
export type TicketPriority = keyof typeof TICKET_PRIORITY;

export const TX_TYPES = {
  income: { label: "Uang Masuk" },
  expense: { label: "Uang Keluar" }
} as const;
export type TxType = keyof typeof TX_TYPES;

export const TX_CATEGORIES = {
  rent: { label: "Sewa", type: "income" },
  electricity: { label: "Listrik", type: "income" },
  water: { label: "Air", type: "income" },
  deposit: { label: "Deposit", type: "income" },
  maintenance: { label: "Perbaikan", type: "expense" },
  salary: { label: "Gaji Penjaga", type: "expense" },
  electricity_token: { label: "Token Listrik", type: "expense" },
  other: { label: "Lainnya", type: "expense" }
} as const;
export type TxCategory = keyof typeof TX_CATEGORIES;

export const AGENT_CHANNELS = {
  whatsapp: { label: "WhatsApp" },
  email: { label: "Email" },
  phone: { label: "Telepon" },
  other: { label: "Lainnya" }
} as const;
export type AgentChannel = keyof typeof AGENT_CHANNELS;

export const COMMISSION_TYPES = {
  percent: { label: "Persen (%)" },
  flat: { label: "Nominal (Rp)" }
} as const;
export type CommissionType = keyof typeof COMMISSION_TYPES;

export const INVOICE_ITEM_KINDS = {
  rent: { label: "Sewa" },
  electricity: { label: "Listrik" },
  water: { label: "Air" },
  penalty: { label: "Denda" },
  other: { label: "Lainnya" }
} as const;
export type InvoiceItemKind = keyof typeof INVOICE_ITEM_KINDS;

export const NOTIF_TYPES = {
  system: { label: "Sistem" },
  payment_overdue: { label: "Pembayaran Tertunggak" },
  contract_expiring: { label: "Kontrak Hampir Habis" },
  new_ticket: { label: "Komplain Baru" },
  ticket_update: { label: "Update Tiket" },
  invoice_created: { label: "Invoice Dibuat" },
  payment_confirmed: { label: "Pembayaran Dikonfirmasi" }
} as const;
export type NotifType = keyof typeof NOTIF_TYPES;

/** Daftar fasilitas untuk multi-select */
export const FACILITY_OPTIONS = [
  "AC",
  "Kipas Angin",
  "Kamar Mandi Dalam",
  "Kamar Mandi Luar",
  "Wifi",
  "Kasur",
  "Lemari",
  "Meja & Kursi",
  "TV",
  "Air PDAM",
  "Dapur Bersama",
  "Parkir Motor",
  "Laundry",
  "Kulkas Bersama"
] as const;

export const STORAGE_BUCKETS = {
  propertyImages: "property-images",
  paymentProofs: "payment-proofs",
  ticketPhotos: "ticket-photos"
} as const;
