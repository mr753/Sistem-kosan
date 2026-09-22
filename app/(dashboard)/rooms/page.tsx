import { requireUser } from "@/lib/auth";
import { getRooms } from "@/lib/actions/rooms";
import { getProperties } from "@/lib/actions/properties";
import { RoomsClient } from "./rooms-client";

export const metadata = { title: "Kamar" };

export default async function RoomsPage() {
  // Wajib login sebelum mengakses halaman kamar (pola properties/page.tsx)
  await requireUser();

  const [rooms, properties] = await Promise.all([getRooms(), getProperties()]);

  return <RoomsClient initialRooms={rooms} properties={properties} />;
}
