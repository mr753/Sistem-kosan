"use client";

import { DoorOpen } from "lucide-react";
import { Room } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ROOM_STATUS } from "@/lib/constants";
import { formatIDR } from "@/lib/utils";

interface RoomGridProps {
  rooms: Room[];
  onEdit: (room: Room) => void;
  onDelete: (room: Room) => void;
}

export function RoomGrid({ rooms, onEdit, onDelete }: RoomGridProps) {
  if (rooms.length === 0) {
    return (
      <div className="flex min-h-[380px] flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center animate-in fade-in-50">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <DoorOpen className="size-8" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">Belum ada kamar</h3>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          Tambahkan kamar ke properti Anda agar bisa diikat ke kontrak sewa dan ditagih.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {rooms.map((room) => {
        const statusConfig = ROOM_STATUS[room.status] ?? {
          label: room.status,
          badge: "bg-slate-100 text-slate-700"
        };
        return (
          <Card key={room.id} className="relative">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between">
                <span>{room.room_number}</span>
                <Badge className={statusConfig.badge}>{statusConfig.label}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{room.room_type || "Standar"}</p>
              <p className="font-semibold">{formatIDR(room.price_monthly)}/bln</p>
              {room.floor && (
                <p className="mt-1 text-xs text-muted-foreground">Lantai {room.floor}</p>
              )}
              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onEdit(room)}>
                  Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => onDelete(room)}>
                  Hapus
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
