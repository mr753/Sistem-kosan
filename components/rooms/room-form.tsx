import { useState } from "react";
import { Room, Property } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ROOM_STATUS_KEYS, type RoomStatus } from "@/lib/constants";

interface RoomFormProps {
  initialData?: Room;
  properties: Property[];
  onSubmit: (data: Omit<Room, "id" | "created_at" | "updated_at">) => void;
  onCancel: () => void;
}

export function RoomForm({ initialData, properties, onSubmit, onCancel }: RoomFormProps) {
  const [formData, setFormData] = useState({
    property_id: initialData?.property_id || properties[0]?.id || "",
    room_number: initialData?.room_number || "",
    floor: initialData?.floor || "",
    room_type: initialData?.room_type || "Standar",
    facilities: initialData?.facilities || [],
    price_monthly: initialData?.price_monthly || 0,
    price_daily: initialData?.price_daily || 0,
    price_yearly: initialData?.price_yearly || 0,
    status: initialData?.status || "vacant",
    notes: initialData?.notes || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="property_id">Properti</Label>
        <Select value={formData.property_id} onChange={(e) => setFormData({...formData, property_id: e.target.value})}>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="room_number">Nomor Kamar</Label>
          <Input id="room_number" value={formData.room_number} onChange={(e) => setFormData({...formData, room_number: e.target.value})} required />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value as RoomStatus})}>
            {ROOM_STATUS_KEYS.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="price_monthly">Harga Bulanan</Label>
        <Input id="price_monthly" type="number" value={formData.price_monthly} onChange={(e) => setFormData({...formData, price_monthly: Number(e.target.value)})} />
      </div>
      <div className="flex gap-2">
        <Button type="submit">Simpan</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Batal</Button>
      </div>
    </form>
  );
}
