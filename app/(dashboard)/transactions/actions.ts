"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TxType, TxCategory } from "@/lib/constants";
import type { TransactionWithDetails } from "@/lib/types";
import { logActivity } from "@/lib/activity";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export interface TransactionInput {
  property_id: string;
  type: TxType;
  category: TxCategory;
  amount: number;
  txn_date: string;
  description?: string | null;
}

const TX_TYPES: TxType[] = ["income", "expense"];
const INCOME_CATEGORIES: TxCategory[] = ["rent", "electricity", "water", "deposit"];
const EXPENSE_CATEGORIES: TxCategory[] = ["maintenance", "salary", "electricity_token", "other"];
const TX_CATEGORIES_ALL: TxCategory[] = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];

/**
 * Validasi sesi user dan role pemilik kos / super admin.
 * (Pola sama dengan requireTenantManager / requireContractManager.)
 */
async function requireFinanceManager() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false as const, error: "Sesi telah berakhir. Silakan login kembali." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAllowed = profile?.role === "landlord" || profile?.role === "super_admin";
  if (!isAllowed) {
    return { ok: false as const, error: "Anda tidak memiliki izin untuk mengelola keuangan." };
  }

  return { ok: true as const, supabase, user, role: profile.role };
}

/** Validasi input transaksi manual (server-side). Return pesan error (Indonesia) atau null. */
function validateTransactionInput(input: TransactionInput): string | null {
  if (!input.property_id) return "Properti wajib dipilih.";

  if (!TX_TYPES.includes(input.type)) return "Tipe transaksi tidak valid.";

  if (!TX_CATEGORIES_ALL.includes(input.category)) return "Kategori transaksi tidak valid.";

  // Kategori harus konsisten dengan tipe (enum DB memisahkan kategori income vs expense)
  if (input.type === "income" && !INCOME_CATEGORIES.includes(input.category)) {
    return "Kategori tersebut bukan kategori pemasukan.";
  }
  if (input.type === "expense" && !EXPENSE_CATEGORIES.includes(input.category)) {
    return "Kategori tersebut bukan kategori pengeluaran.";
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return "Jumlah harus berupa angka lebih besar dari 0.";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.txn_date)) {
    return "Tanggal transaksi tidak valid.";
  }

  return null;
}

/** Bentuk payload bersih dari input (trim + null utk kolom opsional). */
function cleanPayload(input: TransactionInput, userId: string) {
  return {
    property_id: input.property_id,
    type: input.type,
    category: input.category,
    amount: Number(input.amount),
    description: (input.description || "").trim() || null,
    txn_date: input.txn_date,
    created_by: userId
  };
}

/**
 * Ambil daftar transaksi (dalam scope RLS) + nama properti + info invoice terkait.
 * RLS (policy tx_select via owns_property) menegakkan scope: landlord hanya melihat
 * transaksi propertinya, super admin melihat semua — tidak ada filter owner di level aplikasi
 * (konsisten dgn pola getTenantsWithStats / getContractsWithDetails).
 */
export async function getTransactionsWithDetails(): Promise<TransactionWithDetails[]> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "landlord" && profile?.role !== "super_admin") return [];

  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("*, properties(id, name), invoices(period_label, status)")
    .order("txn_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error || !transactions) return [];

  return transactions as TransactionWithDetails[];
}

/** Data dropdown form transaksi: daftar properti dalam scope user (RLS menegakkan). */
export interface TransactionFormData {
  properties: { id: string; name: string }[];
}

export async function getTransactionFormData(): Promise<TransactionFormData> {
  const supabase = await createClient();
  const empty: TransactionFormData = { properties: [] };

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "landlord" && profile?.role !== "super_admin") return empty;

  const { data: properties } = await supabase
    .from("properties")
    .select("id, name")
    .order("name", { ascending: true });

  return { properties: (properties ?? []) as { id: string; name: string }[] };
}

/**
 * Tambah transaksi MANUAL (tanpa invoice_id — transaksi invoice dibuat otomatis
 * oleh approveInvoiceAction di modul Invoice dan TIDAK boleh diduplikasi dari sini).
 */
export async function createTransactionAction(
  input: TransactionInput
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireFinanceManager();
  if (!auth.ok) return auth;

  const validationError = validateTransactionInput(input);
  if (validationError) return { ok: false, error: validationError };

  // Properti harus ada & dalam scope (RLS menegakkan via tx_insert/owns_property)
  const { data: property, error: propError } = await auth.supabase
    .from("properties")
    .select("id")
    .eq("id", input.property_id)
    .single();
  if (propError || !property) {
    return { ok: false, error: "Properti tidak ditemukan atau Anda tidak memiliki akses." };
  }

  const { data, error } = await auth.supabase
    .from("transactions")
    .insert(cleanPayload(input, auth.user.id))
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: `Gagal menyimpan transaksi: ${error.message}` };
  }

  await logActivity(
    {
      action: "create",
      entityType: "transaction",
      entityId: data.id,
      propertyId: input.property_id,
      description: "Mencatat transaksi manual",
      metadata: { type: input.type, category: input.category, amount: Number(input.amount) }
    },
    auth.supabase
  );

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { ok: true, data: { id: data.id } };
}

/**
 * Edit transaksi MANUAL saja.
 * DELETE SAFETY: transaksi yang punya invoice_id berasal dari pembayaran invoice
 * (dibuat otomatis oleh approveInvoiceAction) — editnya diblokir agar histori
 * pembayaran tidak rusak. Koreksi harus lewat modul Invoice (revertInvoiceAction).
 */
export async function updateTransactionAction(
  id: string,
  input: TransactionInput
): Promise<ActionResult> {
  const auth = await requireFinanceManager();
  if (!auth.ok) return auth;

  const validationError = validateTransactionInput(input);
  if (validationError) return { ok: false, error: validationError };

  const { data: existing, error: existingError } = await auth.supabase
    .from("transactions")
    .select("id, property_id, invoice_id")
    .eq("id", id)
    .single();

  if (existingError || !existing) {
    return { ok: false, error: "Transaksi tidak ditemukan atau Anda tidak memiliki akses." };
  }

  if (existing.invoice_id) {
    return {
      ok: false,
      error:
        "Transaksi ini berasal dari pembayaran tagihan dan tidak dapat diedit. Gunakan modul Tagihan untuk koreksi."
    };
  }

  const { error } = await auth.supabase
    .from("transactions")
    .update({
      property_id: input.property_id,
      type: input.type,
      category: input.category,
      amount: Number(input.amount),
      description: (input.description || "").trim() || null,
      txn_date: input.txn_date
    })
    .eq("id", id);

  if (error) {
    return { ok: false, error: `Gagal memperbarui transaksi: ${error.message}` };
  }

  await logActivity(
    {
      action: "update",
      entityType: "transaction",
      entityId: id,
      propertyId: existing.property_id,
      description: "Memperbarui transaksi",
      metadata: { type: input.type, category: input.category, amount: Number(input.amount) }
    },
    auth.supabase
  );

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Hapus transaksi MANUAL saja.
 * DELETE SAFETY: transaksi ber-invoice_id dilindungi — FK transactions.invoice_id
 * memakai ON DELETE SET NULL, jadi menghapus invoice bisa membuat transaksi yatim
 * yang tak bisa dibedakan lagi; pembatalan pembayaran harus via revertInvoiceAction.
 */
export async function deleteTransactionAction(id: string): Promise<ActionResult> {
  const auth = await requireFinanceManager();
  if (!auth.ok) return auth;

  const { data: existing, error: existingError } = await auth.supabase
    .from("transactions")
    .select("id, invoice_id")
    .eq("id", id)
    .single();

  if (existingError || !existing) {
    return { ok: false, error: "Transaksi tidak ditemukan atau Anda tidak memiliki akses." };
  }

  if (existing.invoice_id) {
    return {
      ok: false,
      error:
        "Transaksi ini berasal dari pembayaran tagihan dan tidak dapat dihapus. Gunakan tombol \"Batalkan Lunas\" di modul Tagihan agar status tagihan ikut dikembalikan."
    };
  }

  const { error } = await auth.supabase
    .from("transactions")
    .delete()
    .eq("id", id);

  if (error) {
    return { ok: false, error: `Gagal menghapus transaksi: ${error.message}` };
  }

  await logActivity(
    {
      action: "delete",
      entityType: "transaction",
      entityId: id,
      description: "Menghapus transaksi"
    },
    auth.supabase
  );

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { ok: true };
}
