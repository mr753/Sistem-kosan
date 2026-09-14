import { Room } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ROOM_STATUS } from "@/lib/constants";

interface RoomGridProps {
  rooms: Room[];
  onEdit: (room: Room) => void;
  onDelete: (id: string) => void;
}

export function RoomGrid({ rooms, onEdit, onDelete }: RoomGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {rooms.map((room) => {
        const statusConfig = ROOM_STATUS[room.status];
        return (
          <Card key={room.id} className="relative">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between">
                <span>{room.room_number}</span>
                <Badge className={statusConfig.badge}>{statusConfig.label}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{room.room_type}</p>
              <p className="font-semibold">Rp {room.price_monthly.toLocaleString()}</p>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onEdit(room)}>Edit</Button>
                <Button variant="destructive" size="sm" onClick={() => onDelete(room.id)}>Delete</Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
