"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  DoorOpen,
  MapPin,
  Pencil,
  Plus,
  Power,
  Trash2,
  XCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { PropertyForm } from "@/components/properties/property-form";
import { DeletePropertyModal } from "@/components/properties/delete-property-modal";
import {
  updatePropertyAction,
  deletePropertyAction,
  togglePropertyStatusAction,
  type PropertyInput
} from "@/lib/actions/properties";
import { ROOM_STATUS } from "@/lib/constants";
import { formatIDR } from "@/lib/utils";
import type { PropertyWithStats, Room } from "@/lib/types";

interface PropertyDetailClientProps {
  initialProperty: PropertyWithStats;
  initialRooms: Room[];
}

export function PropertyDetailClient({
  initialProperty,
  initialRooms
}: PropertyDetailClientProps) {
  const router = useRouter();
  const [property, setProperty] = React.useState<PropertyWithStats>(initialProperty);
  const [rooms] = React.useState<Room[]>(initialRooms);

  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  React.useEffect(() => {
    setProperty(initialProperty);
  }, [initialProperty]);

  React.useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  async function handleUpdate(data: PropertyInput) {
    const res = await updatePropertyAction(property.id, data);
    if (res.ok) {
      setFeedback({ type: "success", message: "Data properti berhasil diperbarui." });
      setIsEditModalOpen(false);
      router.refresh();
      return { ok: true };
    }
    return res;
  }

  async function handleToggleStatus() {
    const newStatus = !property.is_active;
    const res = await togglePropertyStatusAction(property.id, newStatus);
    if (res.ok) {
      setProperty((prev) => ({ ...prev, is_active: newStatus }));
      setFeedback({
        type: "success",
        message: `Properti kini ${newStatus ? "aktif" : "nonaktif"}.`
      });
      router.refresh();
    } else {
      setFeedback({ type: "error", message: res.error });
    }
  }

  async function handleDelete(id: string) {
    const res = await deletePropertyAction(id);
    if (res.ok) {
      router.push("/properties");
    }
    return res;
  }

  const total = property.total_rooms ?? rooms.length;
  const occupied = property.occupied_rooms ?? rooms.filter((r) => r.status === "occupied").length;
  const vacant = property.vacant_rooms ?? rooms.filter((r) => r.status === "vacant").length;
  const maintenance = property.maintenance_rooms ?? rooms.filter((r) => r.status === "maintenance").length;

  return (
    <div className="space-y-6">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/properties"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-1.5 size-4" />
          Kembali ke Daftar Properti
        </Link>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleStatus}
            className={property.is_active ? "text-amber-700 hover:text-amber-800" : "text-emerald-700 hover:text-emerald-800"}
          >
            <Power className="mr-1.5 size-4" />
            {property.is_active ? "Nonaktifkan" : "Aktifkan"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditModalOpen(true)}
          >
            <Pencil className="mr-1.5 size-4" />
            Edit
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => setIsDeleteModalOpen(true)}
          >
            <Trash2 className="mr-1.5 size-4" />
            Hapus
          </Button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-lg p-3 text-sm transition-all ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          ) : (
            <XCircle className="size-4 shrink-0 text-red-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Main Info Card */}
      <Card className="overflow-hidden border-border/80">
        <div className="grid grid-cols-1 md:grid-cols-3">
          {/* Photo banner */}
          <div className="relative h-64 md:h-auto min-h-[220px] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
            {property.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={property.image_url}
                alt={property.name}
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full flex-col items-center justify-center text-muted-foreground/60 p-6 text-center">
                <Building2 className="size-16 stroke-[1.25]" />
                <span className="mt-2 text-xs font-medium">Foto belum diunggah</span>
              </div>
            )}
            <div className="absolute left-3 top-3">
              {property.is_active ? (
                <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">
                  Aktif
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-background/90 text-slate-500">
                  Nonaktif
                </Badge>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="col-span-2 p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {property.name}
                </h1>
                <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="size-4 text-slate-400 shrink-0" />
                  <span>
                    {property.city ? property.city : "Kota belum diatur"}
                    {property.address ? ` • ${property.address}` : ""}
                  </span>
                </div>
              </div>

              {property.description && (
                <div className="text-sm text-muted-foreground leading-relaxed pt-1">
                  {property.description}
                </div>
              )}
            </div>

            <div className="text-xs text-muted-foreground pt-2 border-t">
              Dibuat pada: {new Date(property.created_at).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric"
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Occupancy Stats Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Total Kamar</span>
              <DoorOpen className="size-4 text-slate-400" />
            </div>
            <div className="mt-2 text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Terisi</span>
              <span className="size-2 rounded-full bg-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {occupied}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-sky-700 dark:text-sky-400">Kosong</span>
              <span className="size-2 rounded-full bg-sky-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-sky-700 dark:text-sky-400">
              {vacant}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Perbaikan</span>
              <span className="size-2 rounded-full bg-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-700 dark:text-amber-400">
              {maintenance}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Room List of this property */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-lg">Daftar Kamar ({rooms.length})</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Kamar-kamar yang terdaftar di gedung kos ini.
            </p>
          </div>
          <Link href="/rooms" className={buttonVariants({ size: "sm" })}>
            <Plus className="mr-1.5 size-4" />
            Kelola Kamar
          </Link>
        </CardHeader>
        <CardContent>
          {rooms.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <DoorOpen className="mx-auto size-8 text-muted-foreground/60" />
              <p className="mt-2 text-sm font-medium">Belum ada kamar di properti ini</p>
              <p className="text-xs text-muted-foreground mt-1">
                Tambahkan kamar ke properti ini di menu Kamar.
              </p>
              <Link
                href="/rooms"
                className={buttonVariants({ size: "sm", variant: "outline", className: "mt-4" })}
              >
                + Tambah Kamar
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="pb-3 font-medium">Nomor Kamar</th>
                    <th className="pb-3 font-medium">Lantai</th>
                    <th className="pb-3 font-medium">Tipe</th>
                    <th className="pb-3 font-medium">Harga Bulanan</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rooms.map((room) => {
                    const statusConfig = ROOM_STATUS[room.status] ?? {
                      label: room.status,
                      badge: "bg-slate-100 text-slate-700"
                    };

                    return (
                      <tr key={room.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3 font-semibold text-foreground">
                          {room.room_number}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {room.floor || "-"}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {room.room_type || "Standar"}
                        </td>
                        <td className="py-3 font-medium">
                          {formatIDR(room.price_monthly)}
                        </td>
                        <td className="py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig.badge}`}
                          >
                            {statusConfig.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Modal
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Properti"
        description={`Perbarui informasi gedung kos "${property.name}".`}
      >
        <PropertyForm
          initialData={property}
          onSubmit={handleUpdate}
          onCancel={() => setIsEditModalOpen(false)}
        />
      </Modal>

      {/* Delete Safety Confirmation Modal */}
      <DeletePropertyModal
        open={isDeleteModalOpen}
        property={property}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
