"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus, Search, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PropertyList } from "@/components/properties/property-list";
import { PropertyForm } from "@/components/properties/property-form";
import { DeletePropertyModal } from "@/components/properties/delete-property-modal";
import {
  createPropertyAction,
  updatePropertyAction,
  deletePropertyAction,
  togglePropertyStatusAction,
  type PropertyInput
} from "@/lib/actions/properties";
import type { PropertyWithStats } from "@/lib/types";

interface PropertiesClientProps {
  initialProperties: PropertyWithStats[];
}

export function PropertiesClient({ initialProperties }: PropertiesClientProps) {
  const router = useRouter();
  const [properties, setProperties] = React.useState<PropertyWithStats[]>(initialProperties);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "inactive">("all");

  const [isFormModalOpen, setIsFormModalOpen] = React.useState(false);
  const [editingProperty, setEditingProperty] = React.useState<PropertyWithStats | null>(null);

  const [deletingProperty, setDeletingProperty] = React.useState<PropertyWithStats | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);

  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  // Sync state if initialProperties changes from server
  React.useEffect(() => {
    setProperties(initialProperties);
  }, [initialProperties]);

  // Auto-dismiss feedback after 4 seconds
  React.useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const filteredProperties = properties.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    const matchQuery =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.city && p.city.toLowerCase().includes(q)) ||
      (p.address && p.address.toLowerCase().includes(q));

    if (!matchQuery) return false;

    if (statusFilter === "active") return p.is_active;
    if (statusFilter === "inactive") return !p.is_active;
    return true;
  });

  function handleOpenCreate() {
    setEditingProperty(null);
    setIsFormModalOpen(true);
  }

  function handleOpenEdit(property: PropertyWithStats) {
    setEditingProperty(property);
    setIsFormModalOpen(true);
  }

  function handleOpenDelete(property: PropertyWithStats) {
    setDeletingProperty(property);
    setIsDeleteModalOpen(true);
  }

  async function handleFormSubmit(data: PropertyInput) {
    if (editingProperty) {
      const res = await updatePropertyAction(editingProperty.id, data);
      if (res.ok) {
        setFeedback({ type: "success", message: `Properti "${data.name}" berhasil diperbarui.` });
        setIsFormModalOpen(false);
        setEditingProperty(null);
        router.refresh();
        return { ok: true };
      }
      return res;
    } else {
      const res = await createPropertyAction(data);
      if (res.ok) {
        setFeedback({ type: "success", message: `Properti "${data.name}" berhasil ditambahkan.` });
        setIsFormModalOpen(false);
        router.refresh();
        return { ok: true };
      }
      return res;
    }
  }

  async function handleToggleStatus(property: PropertyWithStats) {
    const newStatus = !property.is_active;
    const res = await togglePropertyStatusAction(property.id, newStatus);
    if (res.ok) {
      setProperties((prev) =>
        prev.map((p) => (p.id === property.id ? { ...p, is_active: newStatus } : p))
      );
      setFeedback({
        type: "success",
        message: `Properti "${property.name}" kini ${newStatus ? "aktif" : "nonaktif"}.`
      });
      router.refresh();
    } else {
      setFeedback({ type: "error", message: res.error });
    }
  }

  async function handleConfirmDelete(id: string) {
    const res = await deletePropertyAction(id);
    if (res.ok) {
      setProperties((prev) => prev.filter((p) => p.id !== id));
      setFeedback({ type: "success", message: "Properti berhasil dihapus." });
      router.refresh();
    }
    return res;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Properti</h1>
          <p className="text-sm text-muted-foreground">
            Kelola beberapa gedung kos dalam satu akun.
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="w-full sm:w-auto">
          <Plus className="mr-1.5 size-4" />
          Tambah Properti
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

      {/* Controls: Search and Filter Tabs */}
      {properties.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari gedung / kota / alamat..."
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                statusFilter === "all"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Semua ({properties.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                statusFilter === "active"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Aktif ({properties.filter((p) => p.is_active).length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("inactive")}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                statusFilter === "inactive"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Nonaktif ({properties.filter((p) => !p.is_active).length})
            </button>
          </div>
        </div>
      )}

      {/* Property Cards Grid */}
      <PropertyList
        properties={filteredProperties}
        onEdit={handleOpenEdit}
        onToggleStatus={handleToggleStatus}
        onDelete={handleOpenDelete}
        onOpenCreate={handleOpenCreate}
      />

      {/* Add / Edit Modal */}
      <Modal
        open={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingProperty(null);
        }}
        title={editingProperty ? "Edit Properti" : "Tambah Properti Baru"}
        description={
          editingProperty
            ? `Perbarui informasi gedung kos "${editingProperty.name}".`
            : "Tambahkan gedung kos baru untuk mengelola kamar dan penyewa."
        }
      >
        <PropertyForm
          initialData={editingProperty}
          onSubmit={handleFormSubmit}
          onCancel={() => {
            setIsFormModalOpen(false);
            setEditingProperty(null);
          }}
        />
      </Modal>

      {/* Delete Safety Confirmation Modal */}
      <DeletePropertyModal
        open={isDeleteModalOpen}
        property={deletingProperty}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingProperty(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
