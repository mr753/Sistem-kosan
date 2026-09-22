"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus, Search, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { TenantForm } from "@/components/tenants/tenant-form";
import { TenantList } from "@/components/tenants/tenant-list";
import { DeleteTenantModal } from "@/components/tenants/delete-tenant-modal";
import {
  createTenantAction,
  updateTenantAction,
  deleteTenantAction,
  type TenantInput
} from "@/app/(dashboard)/tenants/actions";
import type { TenantWithStats } from "@/lib/types";

interface TenantsClientProps {
  initialTenants: TenantWithStats[];
}

export function TenantsClient({ initialTenants }: TenantsClientProps) {
  const router = useRouter();
  const [tenants, setTenants] = React.useState<TenantWithStats[]>(initialTenants);
  const [searchQuery, setSearchQuery] = React.useState("");

  const [isFormModalOpen, setIsFormModalOpen] = React.useState(false);
  const [editingTenant, setEditingTenant] = React.useState<TenantWithStats | null>(null);

  const [deletingTenant, setDeletingTenant] = React.useState<TenantWithStats | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);

  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  // Sync state if initialTenants changes from server
  React.useEffect(() => {
    setTenants(initialTenants);
  }, [initialTenants]);

  // Auto-dismiss feedback after 4 seconds
  React.useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const filteredTenants = tenants.filter((t) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      t.full_name.toLowerCase().includes(q) ||
      (t.phone ?? "").toLowerCase().includes(q) ||
      (t.email ?? "").toLowerCase().includes(q) ||
      (t.address ?? "").toLowerCase().includes(q)
    );
  });

  function handleOpenCreate() {
    setEditingTenant(null);
    setIsFormModalOpen(true);
  }

  function handleOpenEdit(tenant: TenantWithStats) {
    setEditingTenant(tenant);
    setIsFormModalOpen(true);
  }

  function handleOpenDelete(tenant: TenantWithStats) {
    setDeletingTenant(tenant);
    setIsDeleteModalOpen(true);
  }

  async function handleFormSubmit(data: TenantInput) {
    if (editingTenant) {
      const res = await updateTenantAction(editingTenant.id, data);
      if (res.ok) {
        setFeedback({ type: "success", message: `Penyewa "${data.full_name}" berhasil diperbarui.` });
        setIsFormModalOpen(false);
        setEditingTenant(null);
        router.refresh();
        return { ok: true };
      }
      return res;
    }

    const res = await createTenantAction(data);
    if (res.ok) {
      setFeedback({ type: "success", message: `Penyewa "${data.full_name}" berhasil ditambahkan.` });
      setIsFormModalOpen(false);
      router.refresh();
      return { ok: true };
    }
    return res;
  }

  async function handleConfirmDelete(id: string) {
    const res = await deleteTenantAction(id);
    if (res.ok) {
      setTenants((prev) => prev.filter((t) => t.id !== id));
      setFeedback({ type: "success", message: "Penyewa berhasil dihapus." });
      router.refresh();
    }
    return res;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Penyewa</h1>
          <p className="text-sm text-muted-foreground">
            Database profil penyewa lengkap — kontak, alamat, dan status akun portal.
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="w-full sm:w-auto">
          <Plus className="mr-1.5 size-4" />
          Tambah Penyewa
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

      {/* Search */}
      {tenants.length > 0 && (
        <div className="w-full sm:max-w-xs">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama / telepon / email..."
              className="pl-9"
            />
          </div>
        </div>
      )}

      {/* Tenant Table */}
      <TenantList
        tenants={filteredTenants}
        onEdit={handleOpenEdit}
        onDelete={handleOpenDelete}
        onOpenCreate={handleOpenCreate}
      />

      {/* Add / Edit Modal */}
      <Modal
        open={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingTenant(null);
        }}
        title={editingTenant ? "Edit Penyewa" : "Tambah Penyewa"}
        description={
          editingTenant
            ? `Perbarui data penyewa "${editingTenant.full_name}".`
            : "Tambahkan profil penyewa baru ke database kos Anda."
        }
      >
        <TenantForm
          initialData={editingTenant}
          onSubmit={handleFormSubmit}
          onCancel={() => {
            setIsFormModalOpen(false);
            setEditingTenant(null);
          }}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <DeleteTenantModal
        open={isDeleteModalOpen}
        tenant={deletingTenant}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingTenant(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
