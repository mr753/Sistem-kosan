// Helper server: kumpulkan kamar kosong per properti utk fitur Broadcast ke Agen.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { VacancyGroup } from "@/lib/agents/broadcast";
import type { Room } from "@/lib/types";

export async function buildVacancyGroups(
  supabase: SupabaseClient,
  propertyIds: string[]
): Promise<VacancyGroup[]> {
  const { data: props } = await supabase
    .from("properties")
    .select("id,name,city,address")
    .in("id", propertyIds);

  const { data: roomsRaw } = await supabase
    .from("rooms")
    .select("id,property_id,room_number,floor,room_type,facilities,price_monthly,price_daily,price_yearly,notes")
    .in("property_id", propertyIds)
    .eq("status", "vacant")
    .order("room_number", { ascending: true });

  const rooms = (roomsRaw ?? []) as unknown as Room[];

  return (props ?? [])
    .map((p) => ({
      property_id: p.id,
      property_name: p.name,
      city: p.city,
      address: p.address,
      rooms: rooms.filter((r) => r.property_id === p.id)
    }))
    .filter((g) => g.rooms.length > 0);
}
