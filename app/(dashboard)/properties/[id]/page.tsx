import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPropertyDetail } from "@/lib/actions/properties";
import { PropertyDetailClient } from "./property-detail-client";

export async function generateMetadata({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getPropertyDetail(id);
  return {
    title: detail ? `${detail.property.name} — Detail Properti` : "Detail Properti"
  };
}

export default async function PropertyDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const detail = await getPropertyDetail(id);
  if (!detail) {
    notFound();
  }

  return (
    <PropertyDetailClient
      initialProperty={detail.property}
      initialRooms={detail.rooms}
    />
  );
}
