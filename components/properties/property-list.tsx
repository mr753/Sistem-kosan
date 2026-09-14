"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  DoorOpen,
  Eye,
  MapPin,
  Pencil,
  Power,
  Trash2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { PropertyWithStats } from "@/lib/types";

interface PropertyListProps {
  properties: PropertyWithStats[];
  onEdit: (property: PropertyWithStats) => void;
  onToggleStatus: (property: PropertyWithStats) => void;
  onDelete: (property: PropertyWithStats) => void;
  onOpenCreate: () => void;
}

export function PropertyList({
  properties,
  onEdit,
  onToggleStatus,
  onDelete,
  onOpenCreate
}: PropertyListProps) {
  if (properties.length === 0) {
    return (
      <div className="flex min-h-[380px] flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center animate-in fade-in-50">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Building2 className="size-8" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">Belum ada properti</h3>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          Kelola beberapa gedung kos dalam satu akun. Mulai dengan menambahkan gedung kos pertama Anda.
        </p>
        <Button onClick={onOpenCreate} className="mt-5">
          + Tambah Properti
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {properties.map((property) => {
        const total = property.total_rooms ?? 0;
        const occupied = property.occupied_rooms ?? 0;
        const vacant = property.vacant_rooms ?? 0;
        const maintenance = property.maintenance_rooms ?? 0;
        const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

        return (
          <Card
            key={property.id}
            className="group flex flex-col overflow-hidden transition-all hover:shadow-md border-border/80"
          >
            {/* Image / Fallback Banner */}
            <div className="relative h-44 w-full overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
              {property.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={property.image_url}
                  alt={property.name}
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex size-full flex-col items-center justify-center text-muted-foreground/60">
                  <Building2 className="size-12 stroke-[1.25]" />
                  <span className="mt-1 text-xs font-medium">Foto belum diunggah</span>
                </div>
              )}

              {/* Status Badge */}
              <div className="absolute left-3 top-3">
                {property.is_active ? (
                  <Badge className="bg-emerald-500/90 text-white backdrop-blur-sm hover:bg-emerald-600">
                    Aktif
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-background/90 text-slate-500 backdrop-blur-sm">
                    Nonaktif
                  </Badge>
                )}
              </div>

              {/* Occupancy Pill */}
              {total > 0 && (
                <div className="absolute right-3 top-3">
                  <span className="inline-flex items-center rounded-full bg-black/60 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
                    Okupansi {occupancyRate}%
                  </span>
                </div>
              )}
            </div>

            {/* Card Content */}
            <CardContent className="flex flex-1 flex-col justify-between p-5 space-y-4">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/properties/${property.id}`}
                    className="hover:underline focus:outline-none"
                  >
                    <h3 className="font-semibold text-lg leading-tight line-clamp-1 group-hover:text-primary">
                      {property.name}
                    </h3>
                  </Link>
                </div>

                {/* Location */}
                <div className="flex items-center text-xs text-muted-foreground gap-1.5 line-clamp-1">
                  <MapPin className="size-3.5 shrink-0 text-slate-400" />
                  <span>
                    {property.city ? `${property.city}` : "Kota belum diatur"}
                    {property.address ? ` • ${property.address}` : ""}
                  </span>
                </div>

                {/* Description snippet */}
                {property.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 pt-1">
                    {property.description}
                  </p>
                )}
              </div>

              {/* Occupancy Summary Box */}
              <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    <DoorOpen className="size-3.5 text-slate-500" />
                    Total {total} Kamar
                  </span>
                  <span className="text-[11px] text-muted-foreground">Status</span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                  <div className="rounded bg-emerald-50 dark:bg-emerald-950/40 p-1.5 text-emerald-700 dark:text-emerald-400">
                    <div className="font-bold text-sm leading-tight">{occupied}</div>
                    <div className="text-[10px]">Terisi</div>
                  </div>
                  <div className="rounded bg-sky-50 dark:bg-sky-950/40 p-1.5 text-sky-700 dark:text-sky-400">
                    <div className="font-bold text-sm leading-tight">{vacant}</div>
                    <div className="text-[10px]">Kosong</div>
                  </div>
                  <div className="rounded bg-amber-50 dark:bg-amber-950/40 p-1.5 text-amber-700 dark:text-amber-400">
                    <div className="font-bold text-sm leading-tight">{maintenance}</div>
                    <div className="text-[10px]">Perbaikan</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-1 pt-1 border-t">
                <Link
                  href={`/properties/${property.id}`}
                  className={buttonVariants({ variant: "ghost", size: "sm", className: "h-8 px-2.5 text-xs" })}
                >
                  <Eye className="mr-1.5 size-3.5" />
                  Detail
                </Link>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onToggleStatus(property)}
                    title={property.is_active ? "Nonaktifkan properti" : "Aktifkan properti"}
                    className={`h-8 px-2 text-xs ${
                      property.is_active
                        ? "text-slate-600 hover:text-amber-600"
                        : "text-emerald-600 hover:text-emerald-700"
                    }`}
                  >
                    <Power className="size-3.5" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(property)}
                    title="Edit properti"
                    className="h-8 px-2 text-xs"
                  >
                    <Pencil className="size-3.5" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(property)}
                    title="Hapus properti"
                    className="h-8 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
