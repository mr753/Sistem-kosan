"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { ROOM_STATUS, type RoomStatus } from "@/lib/constants";
import type { Room } from "@/lib/types";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export interface RoomInput {
  property_id: string;
  room_number: string;
  floor?: string | null;
  room_type: string;
  facilities: string[];
  price_monthly: number;
  price_daily: number;
  price_yearly: number;
  status: RoomStatus;
  notes?: string | null;
}

const ROOM_STATUSES = Object.keys(ROOM_STATUS) as RoomStatus[];

/**
 * Validasi sesi user dan role pemilik kos / super admin.
 * (Pola sama dengan requirePropertyOwner / requireTenantManager.)
 */
async function requireRoomManager() {
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
    return { ok: false as const, error: "Anda tidak memiliki izin untuk mengelola kamar." };
  }

  return { ok: true as const, supabase, user, role: profile.role };
}

/** Validasi input kamar (server-side). Return pesan error (Indonesia) atau null. */
function validateRoomInput(input: RoomInput): string | null {
  if (!input.property_id) return "Properti wajib dipilih.";

  const roomNumber = (input.room_number || "").trim();
  if (!roomNumber || roomNumber.length < 1) {
    return "Nomor kamar wajib diisi.";
  }
  if (roomNumber.length > 20) {
    return "Nomor kamar maksimal 20 karakter.";
  }

  if (!ROOM_STATUSES.includes(input.status)) {
    return "Status kamar tidak valid.";
  }

  for (const [field, label] of [
    ["price_monthly", "Harga bulanan"],
    ["price_daily", "Harga harian"],
    ["price_yearly", "Harga tahunan"]
  ] as const) {
    const value = Number(input[field]);
    if (!Number.isFinite(value) || value < 0) {
      return `${label} tidak boleh negatif.`;
    }
  }

  return null;
}

/** Bentuk payload bersih dari input (trim + null utk kolom opsional). */
function cleanPayload(input: RoomInput) {
  return {
    property_id: input.property_id,
    room_number: (input.room_number || "").trim(),
    floor: (input.floor || "").trim() || null,
    room_type: (input.room_type || "").trim() || "Standar",
    facilities: Array.isArray(input.facilities) ? input.facilities : [],
    price_monthly: Number(input.price_monthly) || 0,
    price_daily: Number(input.price_daily) || 0,
    price_yearly: Number(input.price_yearly) || 0,
    status: input.status,
    notes: (input.notes || "").trim() || null
  };
}

/** Pesan ramah utk pelanggaran constraint DB yang diketahui. */
function friendlyError(message: string, fallback: string): string {
  if (message.includes("rooms_property_id_room_number_key") || message.includes("unique")) {
    return "Nomor kamar sudah dipakai di properti ini. Gunakan nomor lain.";
  }
  if (message.includes("rooms_room_status_check") || message.includes("check constraint")) {
    return "Status kamar tidak valid.";
  }
  return `${fallback}: ${message}`;
}

/**
 * Ambil daftar kamar dalam scope RLS + nama propertinya.
 * RLS (rooms_select_owner via owns_property) menegakkan scope.
 */
export async function getRooms(propertyId?: string): Promise<Room[]> {
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

  let query = supabase.from("rooms").select("*, properties(name)");
  if (propertyId) {
    query = query.eq("property_id", propertyId);
  }

  const { data, error } = await query.order("room_number", { ascending: true });
  if (error || !data) return [];

  return data as Room[];
}

/**
 * Sinkronisasi status kamar (semantik sama dgn syncRoomStatus modul Kontrak):
 * - Ada kontrak aktif  -> occupied
 * - Tidak ada kontrak  -> vacant (kecuali sedang maintenance: dipertahankan)
 */
async function syncRoomStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  roomIds: string[]
) {
  const uniqueIds = [...new Set(roomIds)].filter(Boolean);
  if (uniqueIds.length === 0) return;

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, status")
    .in("id", uniqueIds);

  const { data: activeContracts } = await supabase
    .from("contracts")
    .select("room_id")
    .in("room_id", uniqueIds)
    .eq("status", "active");

  const roomsWithActiveContract = new Set((activeContracts ?? []).map((c) => c.room_id));

  for (const room of rooms ?? []) {
    const hasActive = roomsWithActiveContract.has(room.id);
    if (hasActive && room.status !== "occupied") {
      await supabase.from("rooms").update({ status: "occupied" }).eq("id", room.id);
    } else if (!hasActive && room.status === "occupied") {
      // Kamar occupied tanpa kontrak aktif -> kembali kosong.
      // Status 'maintenance' tidak pernah diubah otomatis (dipertahankan).
      await supabase.from("rooms").update({ status: "vacant" }).eq("id", room.id);
    }
  }
}

/** Membuat kamar baru pada properti dalam scope user. */
export async function createRoom(data: RoomInput): Promise<ActionResult<{ id: string }>> {
  const auth = await requireRoomManager();
  if (!auth.ok) return auth;

  const validationError = validateRoomInput(data);
  if (validationError) return { ok: false, error: validationError };

  // Properti harus ada & dalam scope (RLS menegakkan via rooms_insert/owns_property)
  const { data: property, error: propError } = await auth.supabase
    .from("properties")
    .select("id")
    .eq("id", data.property_id)
    .single();
  if (propError || !property) {
    return { ok: false, error: "Properti tidak ditemukan atau Anda tidak memiliki akses." };
  }

  const payload = cleanPayload(data);

  // Duplicate (property_id, room_number) ditolak unique index DB — deteksi dulu
  // agar pesan error ramah dan tidak melempar exception mentah.
  const { data: duplicate } = await auth.supabase
    .from("rooms")
    .select("id")
    .eq("property_id", payload.property_id)
    .eq("room_number", payload.room_number)
    .maybeSingle();
  if (duplicate) {
    return { ok: false, error: `Nomor kamar "${payload.room_number}" sudah dipakai di properti ini.` };
  }

  const { data: created, error } = await auth.supabase
    .from("rooms")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: friendlyError(error.message, "Gagal menyimpan kamar") };
  }

  await logActivity(
    {
      action: "create",
      entityType: "room",
      entityId: created.id,
      propertyId: payload.property_id,
      description: `Membuat kamar ${payload.room_number}`,
      metadata: { room_number: payload.room_number, room_type: payload.room_type }
    },
    auth.supabase
  );

  revalidatePath("/rooms");
  revalidatePath(`/properties/${payload.property_id}`);
  revalidatePath("/dashboard");
  return { ok: true, data: { id: created.id } };
}

/** Memperbarui kamar. Scope dijaga; pindah properti divalidasi; duplicate nomor ditolak. */
export async function updateRoom(id: string, data: Partial<RoomInput>): Promise<ActionResult> {
  const auth = await requireRoomManager();
  if (!auth.ok) return auth;

  // Pastikan kamar ada & dalam scope sebelum memproses
  const { data: existing, error: existingError } = await auth.supabase
    .from("rooms")
    .select("id, property_id, room_number, status")
    .eq("id", id)
    .single();
  if (existingError || !existing) {
    return { ok: false, error: "Kamar tidak ditemukan atau Anda tidak memiliki akses." };
  }

  // Gabungkan dgn nilai existing utk validasi field wajib (update parsial)
  const merged: RoomInput = {
    property_id: data.property_id ?? existing.property_id,
    room_number: data.room_number ?? existing.room_number,
    floor: data.floor ?? null,
    room_type: data.room_type ?? "Standar",
    facilities: data.facilities ?? [],
    price_monthly: data.price_monthly ?? 0,
    price_daily: data.price_daily ?? 0,
    price_yearly: data.price_yearly ?? 0,
    status: data.status ?? existing.status
  };
  const validationError = validateRoomInput(merged);
  if (validationError) return { ok: false, error: validationError };

  // Pindah properti harus ke properti yang valid & dalam scope
  if (data.property_id && data.property_id !== existing.property_id) {
    const { data: property, error: propError } = await auth.supabase
      .from("properties")
      .select("id")
      .eq("id", data.property_id)
      .single();
    if (propError || !property) {
      return { ok: false, error: "Properti tujuan tidak ditemukan atau Anda tidak memiliki akses." };
    }

    const { data: duplicate } = await auth.supabase
      .from("rooms")
      .select("id")
      .eq("property_id", data.property_id)
      .eq("room_number", merged.room_number)
      .neq("id", id)
      .maybeSingle();
    if (duplicate) {
      return { ok: false, error: `Nomor kamar "${merged.room_number}" sudah dipakai di properti tujuan.` };
    }
  } else if (data.room_number && data.room_number !== existing.room_number) {
    const { data: duplicate } = await auth.supabase
      .from("rooms")
      .select("id")
      .eq("property_id", existing.property_id)
      .eq("room_number", merged.room_number)
      .neq("id", id)
      .maybeSingle();
    if (duplicate) {
      return { ok: false, error: `Nomor kamar "${merged.room_number}" sudah dipakai di properti ini.` };
    }
  }

  const payload = cleanPayload(merged);
  const { error } = await auth.supabase
    .from("rooms")
    .update(payload)
    .eq("id", id);

  if (error) {
    return { ok: false, error: friendlyError(error.message, "Gagal memperbarui kamar") };
  }

  await logActivity(
    {
      action: "update",
      entityType: "room",
      entityId: id,
      propertyId: payload.property_id,
      description: `Memperbarui kamar ${merged.room_number}`,
      metadata: { room_number: merged.room_number, status: merged.status }
    },
    auth.supabase
  );

  // Sinkronkan status bila kamar pindah properti (kontrak aktif tidak boleh hilang scope)
  if (data.property_id && data.property_id !== existing.property_id) {
    await syncRoomStatus(auth.supabase, [existing.property_id, data.property_id]);
  }

  revalidatePath("/rooms");
  revalidatePath(`/properties/${payload.property_id}`);
  revalidatePath(`/properties/${existing.property_id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Menghapus kamar dengan DELETE SAFETY:
 * - Kamar dengan kontrak (aktif maupun riwayat) TIDAK boleh dihapus —
 *   FK contracts.room_id memakai ON DELETE RESTRICT dan invoice terikat kontrak.
 * - Kamar tanpa kontrak boleh dihapus (belum ada relasi keuangan yang menempel).
 */
export async function deleteRoom(id: string): Promise<ActionResult> {
  const auth = await requireRoomManager();
  if (!auth.ok) return auth;

  // 1. Pastikan kamar ada & dalam scope
  const { data: room, error: roomError } = await auth.supabase
    .from("rooms")
    .select("id, room_number, property_id")
    .eq("id", id)
    .single();
  if (roomError || !room) {
    return { ok: false, error: "Kamar tidak ditemukan atau Anda tidak memiliki akses." };
  }

  // 2. DELETE SAFETY: tolak bila masih memiliki kontrak apa pun (aktif/riwayat)
  const { count: contractCount, error: countError } = await auth.supabase
    .from("contracts")
    .select("id", { count: "exact", head: true })
    .eq("room_id", id);

  if (countError) {
    return { ok: false, error: `Gagal memeriksa kontrak: ${countError.message}` };
  }

  if (contractCount && contractCount > 0) {
    return {
      ok: false,
      error: `Kamar tidak dapat dihapus karena masih memiliki ${contractCount} kontrak. Hapus kontrak terlebih dahulu (lihat modul Kontrak).`
    };
  }

  // 3. Eksekusi hapus
  const { error: deleteError } = await auth.supabase
    .from("rooms")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return { ok: false, error: friendlyError(deleteError.message, "Gagal menghapus kamar") };
  }

  await logActivity(
    {
      action: "delete",
      entityType: "room",
      entityId: id,
      propertyId: room.property_id,
      description: `Menghapus kamar ${room.room_number}`,
      metadata: { room_number: room.room_number }
    },
    auth.supabase
  );

  revalidatePath("/rooms");
  revalidatePath("/dashboard");
  return { ok: true };
}
