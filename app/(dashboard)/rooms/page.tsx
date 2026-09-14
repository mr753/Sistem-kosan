import { getRooms } from "@/lib/actions/rooms";
import { getProperties } from "@/lib/actions/properties";
import { RoomsClient } from "./rooms-client";

export const metadata = { title: "Kamar" };

export default async function RoomsPage() {
  const [rooms, properties] = await Promise.all([getRooms(), getProperties()]);

  return <RoomsClient initialRooms={rooms} properties={properties} />;
}
