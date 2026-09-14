"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Room } from "@/lib/types";

export async function getRooms(propertyId?: string) {
  const supabase = await createClient();
  let query = supabase.from("rooms").select("*, properties(name)");
  
  if (propertyId) {
    query = query.eq("property_id", propertyId);
  }
  
  const { data, error } = await query.order("room_number");

  if (error) throw error;
  return data as Room[];
}

export async function createRoom(data: Omit<Room, "id" | "created_at" | "updated_at">) {
  const supabase = await createClient();
  
  const { error } = await supabase.from("rooms").insert(data);

  if (error) throw error;
  revalidatePath("/rooms");
}

export async function updateRoom(id: string, data: Partial<Omit<Room, "id" | "created_at" | "updated_at">>) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from("rooms")
    .update(data)
    .eq("id", id);

  if (error) throw error;
  revalidatePath("/rooms");
}

export async function deleteRoom(id: string) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from("rooms")
    .delete()
    .eq("id", id);

  if (error) throw error;
  revalidatePath("/rooms");
}
