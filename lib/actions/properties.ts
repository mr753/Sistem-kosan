"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Property, PropertyWithStats, Room } from "@/lib/types";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export interface PropertyInput {
  name: string;
  address?: string | null;
  city?: string | null;
  description?: string | null;
  image_url?: string | null;
  is_active?: boolean;
}

/**
 * Validasi sesi user dan role pemilik kos / super admin.
 */
async function requirePropertyOwner() {
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
    return { ok: false as const, error: "Anda tidak memiliki izin untuk mengelola properti." };
  }

  return { ok: true as const, supabase, user, role: profile.role };
}

/**
 * Mengambil seluruh properti milik user beserta ringkasan statistik okupansi kamar.
 */
export async function getPropertiesWithStats(): Promise<PropertyWithStats[]> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return [];

  // Ambil profil untuk cek role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  let propQuery = supabase
    .from("properties")
    .select("*")
    .order("created_at", { ascending: false });

  if (profile?.role !== "super_admin") {
    propQuery = propQuery.eq("owner_id", user.id);
  }

  const { data: properties, error: propError } = await propQuery;
  if (propError || !properties || properties.length === 0) {
    return [];
  }

  const propertyIds = properties.map((p) => p.id);

  // Kueri efisien ke tabel rooms untuk agregasi statistik
  const { data: rooms, error: roomError } = await supabase
    .from("rooms")
    .select("id, property_id, status")
    .in("property_id", propertyIds);

  const roomsByProperty: Record<
    string,
    { total: number; occupied: number; vacant: number; maintenance: number }
  > = {};

  for (const id of propertyIds) {
    roomsByProperty[id] = { total: 0, occupied: 0, vacant: 0, maintenance: 0 };
  }

  if (!roomError && rooms) {
    for (const r of rooms) {
      const stats = roomsByProperty[r.property_id];
      if (stats) {
        stats.total += 1;
        if (r.status === "occupied") stats.occupied += 1;
        else if (r.status === "vacant") stats.vacant += 1;
        else if (r.status === "maintenance") stats.maintenance += 1;
      }
    }
  }

  return properties.map((prop) => {
    const stats = roomsByProperty[prop.id] || { total: 0, occupied: 0, vacant: 0, maintenance: 0 };
    return {
      ...prop,
      total_rooms: stats.total,
      occupied_rooms: stats.occupied,
      vacant_rooms: stats.vacant,
      maintenance_rooms: stats.maintenance
    };
  });
}

/**
 * Kompatibilitas mundur: mengambil list properti murni.
 */
export async function getProperties(): Promise<Property[]> {
  return getPropertiesWithStats();
}

/**
 * Mengambil satu properti beserta detail kamar-kamarnya.
 */
export async function getPropertyDetail(
  propertyId: string
): Promise<{ property: PropertyWithStats; rooms: Room[] } | null> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: property, error: propError } = await supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .single();

  if (propError || !property) return null;

  // Ambil daftar kamar milik properti
  const { data: rooms, error: roomsError } = await supabase
    .from("rooms")
    .select("*")
    .eq("property_id", propertyId)
    .order("room_number", { ascending: true });

  const roomList = (roomsError || !rooms ? [] : rooms) as Room[];

  let occupied = 0;
  let vacant = 0;
  let maintenance = 0;

  for (const r of roomList) {
    if (r.status === "occupied") occupied += 1;
    else if (r.status === "vacant") vacant += 1;
    else if (r.status === "maintenance") maintenance += 1;
  }

  const propWithStats: PropertyWithStats = {
    ...property,
    total_rooms: roomList.length,
    occupied_rooms: occupied,
    vacant_rooms: vacant,
    maintenance_rooms: maintenance
  };

  return { property: propWithStats, rooms: roomList };
}

/**
 * Membuat properti baru.
 * owner_id DIJAMIN selalu diambil dari auth.uid() sesi aktif, bukan dari form input.
 */
export async function createPropertyAction(input: PropertyInput): Promise<ActionResult<{ id: string }>> {
  const auth = await requirePropertyOwner();
  if (!auth.ok) return auth;

  const name = (input.name || "").trim();
  if (!name || name.length < 2) {
    return { ok: false, error: "Nama properti wajib diisi (minimal 2 karakter)." };
  }

  const payload = {
    owner_id: auth.user.id, // Selalu dari sesi terpercaya
    name,
    address: (input.address || "").trim() || null,
    city: (input.city || "").trim() || null,
    description: (input.description || "").trim() || null,
    image_url: (input.image_url || "").trim() || null,
    is_active: input.is_active ?? true
  };

  const { data, error } = await auth.supabase
    .from("properties")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: `Gagal menyimpan properti: ${error.message}` };
  }

  revalidatePath("/properties");
  revalidatePath("/dashboard");
  revalidatePath("/rooms");
  return { ok: true, data: { id: data.id } };
}

/**
 * Memperbarui data properti.
 */
export async function updatePropertyAction(
  id: string,
  input: PropertyInput
): Promise<ActionResult> {
  const auth = await requirePropertyOwner();
  if (!auth.ok) return auth;

  const name = (input.name || "").trim();
  if (!name || name.length < 2) {
    return { ok: false, error: "Nama properti wajib diisi (minimal 2 karakter)." };
  }

  const payload = {
    name,
    address: (input.address || "").trim() || null,
    city: (input.city || "").trim() || null,
    description: (input.description || "").trim() || null,
    image_url: input.image_url !== undefined ? (input.image_url || "").trim() || null : undefined,
    is_active: input.is_active ?? true
  };

  let query = auth.supabase.from("properties").update(payload).eq("id", id);
  if (auth.role !== "super_admin") {
    query = query.eq("owner_id", auth.user.id);
  }

  const { error } = await query;
  if (error) {
    return { ok: false, error: `Gagal memperbarui properti: ${error.message}` };
  }

  revalidatePath("/properties");
  revalidatePath(`/properties/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/rooms");
  return { ok: true };
}

/**
 * Toggle status aktif / nonaktif properti.
 */
export async function togglePropertyStatusAction(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  const auth = await requirePropertyOwner();
  if (!auth.ok) return auth;

  let query = auth.supabase
    .from("properties")
    .update({ is_active: isActive })
    .eq("id", id);

  if (auth.role !== "super_admin") {
    query = query.eq("owner_id", auth.user.id);
  }

  const { error } = await query;
  if (error) {
    return { ok: false, error: `Gagal mengubah status properti: ${error.message}` };
  }

  revalidatePath("/properties");
  revalidatePath(`/properties/${id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Menghapus properti dengan DELETE SAFETY.
 * Sebelum delete: cek apakah properti masih memiliki kamar.
 * Jika masih ada kamar, tolak penghapusan.
 */
export async function deletePropertyAction(id: string): Promise<ActionResult> {
  const auth = await requirePropertyOwner();
  if (!auth.ok) return auth;

  // 1. Cek apakah properti ini milik user (atau admin)
  let checkQuery = auth.supabase
    .from("properties")
    .select("id, name")
    .eq("id", id);

  if (auth.role !== "super_admin") {
    checkQuery = checkQuery.eq("owner_id", auth.user.id);
  }

  const { data: prop, error: checkError } = await checkQuery.single();
  if (checkError || !prop) {
    return { ok: false, error: "Properti tidak ditemukan atau Anda tidak memiliki akses." };
  }

  // 2. DELETE SAFETY: Cek apakah masih memiliki kamar di tabel rooms
  const { count: roomCount, error: countError } = await auth.supabase
    .from("rooms")
    .select("id", { count: "exact", head: true })
    .eq("property_id", id);

  if (countError) {
    return { ok: false, error: `Gagal memeriksa kamar: ${countError.message}` };
  }

  if (roomCount && roomCount > 0) {
    return {
      ok: false,
      error: `Properti tidak dapat dihapus karena masih memiliki ${roomCount} kamar. Hapus atau pindahkan kamar terlebih dahulu.`
    };
  }

  // 3. Eksekusi hapus properti
  const { error: deleteError } = await auth.supabase
    .from("properties")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return { ok: false, error: `Gagal menghapus properti: ${deleteError.message}` };
  }

  revalidatePath("/properties");
  revalidatePath("/dashboard");
  revalidatePath("/rooms");
  return { ok: true };
}
