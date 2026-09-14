"use client";

import { useState } from "react";
import { Room, Property } from "@/lib/types";
import { RoomGrid } from "@/components/rooms/room-grid";
import { RoomForm } from "@/components/rooms/room-form";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { createRoom, updateRoom, deleteRoom } from "@/lib/actions/rooms";

export function RoomsClient({ initialRooms, properties }: { initialRooms: Room[], properties: Property[] }) {
  const [rooms] = useState<Room[]>(initialRooms);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  const handleOpenModal = (room?: Room) => {
    setEditingRoom(room || null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRoom(null);
  };

  const handleSubmit = async (data: Omit<Room, "id" | "created_at" | "updated_at">) => {
    if (editingRoom) {
      await updateRoom(editingRoom.id, data);
    } else {
      await createRoom(data);
    }
    handleCloseModal();
    window.location.reload();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Yakin ingin menghapus kamar ini?")) {
      await deleteRoom(id);
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Kamar</h1>
        <Button onClick={() => handleOpenModal()}>Tambah Kamar</Button>
      </div>

      <RoomGrid rooms={rooms} onEdit={handleOpenModal} onDelete={handleDelete} />

      <Modal open={isModalOpen} onClose={handleCloseModal} title={editingRoom ? "Edit Kamar" : "Tambah Kamar"}>
        <RoomForm initialData={editingRoom || undefined} properties={properties} onSubmit={handleSubmit} onCancel={handleCloseModal} />
      </Modal>
    </div>
  );
}
