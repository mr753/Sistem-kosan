"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus, XCircle } from "lucide-react";
import { Room, Property } from "@/lib/types";
import { RoomGrid } from "@/components/rooms/room-grid";
import { RoomForm, type RoomFormData } from "@/components/rooms/room-form";
import { DeleteRoomModal } from "@/components/rooms/delete-room-modal";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { createRoom, updateRoom, deleteRoom, type RoomInput } from "@/lib/actions/rooms";

interface RoomsClientProps {
  initialRooms: Room[];
  properties: Property[];
}

export function RoomsClient({ initialRooms, properties }: RoomsClientProps) {
  const router = useRouter();
  const [rooms, setRooms] = React.useState<Room[]>(initialRooms);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingRoom, setEditingRoom] = React.useState<Room | null>(null);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  React.useEffect(() => {
    setRooms(initialRooms);
  }, [initialRooms]);

  React.useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const handleOpenModal = (room?: Room) => {
    setEditingRoom(room || null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRoom(null);
  };

  const handleSubmit = async (data: RoomFormData): Promise<{ ok: boolean; error?: string }> => {
    const input: RoomInput = {
      property_id: data.property_id,
      room_number: data.room_number,
      floor: data.floor,
      room_type: data.room_type,
      facilities: data.facilities,
      price_monthly: data.price_monthly,
      price_daily: data.price_daily,
      price_yearly: data.price_yearly,
      status: data.status,
      notes: data.notes
    };

    const res = editingRoom
      ? await updateRoom(editingRoom.id, input)
      : await createRoom(input);

    if (res.ok) {
      setFeedback({
        type: "success",
        message: editingRoom ? `Kamar "${data.room_number}" berhasil diperbarui.` : `Kamar "${data.room_number}" berhasil ditambahkan.`
      });
      handleCloseModal();
      router.refresh();
      return { ok: true };
    }
    return res;
  };

  const [deletingRoom, setDeletingRoom] = React.useState<Room | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);

  const handleOpenDelete = (room: Room) => {
    setDeletingRoom(room);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async (room: Room): Promise<{ ok: boolean; error?: string }> => {
    const res = await deleteRoom(room.id);
    if (res.ok) {
      setRooms((prev) => prev.filter((r) => r.id !== room.id));
      setFeedback({ type: "success", message: `Kamar "${room.room_number}" berhasil dihapus.` });
      router.refresh();
      return { ok: true };
    }
    return res;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kamar</h1>
          <p className="text-sm text-muted-foreground">
            Daftar kamar per properti beserta status okupansinya.
          </p>
        </div>
        <Button onClick={() => handleOpenModal()} className="w-full sm:w-auto">
          <Plus className="mr-1.5 size-4" />
          Tambah Kamar
        </Button>
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

      {/* Room Grid */}
      <RoomGrid rooms={rooms} onEdit={handleOpenModal} onDelete={handleOpenDelete} />

      {/* Add / Edit Modal */}
      <Modal
        open={isModalOpen}
        onClose={handleCloseModal}
        title={editingRoom ? "Edit Kamar" : "Tambah Kamar"}
        description={
          editingRoom
            ? `Perbarui kamar "${editingRoom.room_number}".`
            : "Tambahkan kamar baru ke salah satu properti Anda."
        }
      >
        <RoomForm
          initialData={editingRoom ?? undefined}
          properties={properties}
          onSubmit={handleSubmit}
          onCancel={handleCloseModal}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <DeleteRoomModal
        open={isDeleteModalOpen}
        room={deletingRoom}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingRoom(null);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
