"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus, Search, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ContractForm } from "@/components/contracts/contract-form";
import { ContractList } from "@/components/contracts/contract-list";
import { DeleteContractModal } from "@/components/contracts/delete-contract-modal";
import {
  createContractAction,
  updateContractAction,
  deleteContractAction,
  type ContractFormData,
  type ContractInput
} from "@/app/(dashboard)/contracts/actions";
import { CONTRACT_STATUS } from "@/lib/constants";
import type { ContractStatus } from "@/lib/constants";
import type { ContractWithDetails } from "@/lib/types";

interface ContractsClientProps {
  initialContracts: ContractWithDetails[];
  formData: ContractFormData;
}

type StatusFilter = "all" | ContractStatus;

export function ContractsClient({ initialContracts, formData }: ContractsClientProps) {
  const router = useRouter();
  const [contracts, setContracts] = React.useState<ContractWithDetails[]>(initialContracts);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");

  const [isFormModalOpen, setIsFormModalOpen] = React.useState(false);
  const [editingContract, setEditingContract] = React.useState<ContractWithDetails | null>(null);

  const [deletingContract, setDeletingContract] = React.useState<ContractWithDetails | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);

  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  React.useEffect(() => {
    setContracts(initialContracts);
  }, [initialContracts]);

  React.useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const filteredContracts = contracts.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    const matchQuery =
      !q ||
      (c.tenants?.full_name ?? "").toLowerCase().includes(q) ||
      (c.properties?.name ?? "").toLowerCase().includes(q) ||
      (c.rooms?.room_number ?? "").toLowerCase().includes(q);

    if (!matchQuery) return false;

    if (statusFilter === "all") return true;
    return c.status === statusFilter;
  });

  function handleOpenCreate() {
    setEditingContract(null);
    setIsFormModalOpen(true);
  }

  function handleOpenEdit(contract: ContractWithDetails) {
    setEditingContract(contract);
    setIsFormModalOpen(true);
  }

  function handleOpenDelete(contract: ContractWithDetails) {
    setDeletingContract(contract);
    setIsDeleteModalOpen(true);
  }

  async function handleFormSubmit(data: ContractInput) {
    if (editingContract) {
      const res = await updateContractAction(editingContract.id, data);
      if (res.ok) {
        setFeedback({ type: "success", message: "Kontrak berhasil diperbarui." });
        setIsFormModalOpen(false);
        setEditingContract(null);
        router.refresh();
        return { ok: true };
      }
      return res;
    }

    const res = await createContractAction(data);
    if (res.ok) {
      setFeedback({ type: "success", message: "Kontrak berhasil ditambahkan." });
      setIsFormModalOpen(false);
      router.refresh();
      return { ok: true };
    }
    return res;
  }

  async function handleConfirmDelete(id: string) {
    const res = await deleteContractAction(id);
    if (res.ok) {
      setContracts((prev) => prev.filter((c) => c.id !== id));
      setFeedback({ type: "success", message: "Kontrak berhasil dihapus." });
      router.refresh();
    }
    return res;
  }

  const statusCounts = React.useMemo(() => {
    const counts: Record<StatusFilter, number> = { all: contracts.length, active: 0, expired: 0, terminated: 0 };
    for (const c of contracts) counts[c.status] += 1;
    return counts;
  }, [contracts]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kontrak Sewa</h1>
          <p className="text-sm text-muted-foreground">
            Kontrak digital penyewa &amp; kamar — dasar pembuatan tagihan bulanan.
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="w-full sm:w-auto">
          <Plus className="mr-1.5 size-4" />
          Tambah Kontrak
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

      {/* Controls: Search + Filter status */}
      {contracts.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari penyewa / properti / kamar..."
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1 text-xs">
            {(["all", "active", "expired", "terminated"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                  statusFilter === s
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "all" ? "Semua" : CONTRACT_STATUS[s].label} ({statusCounts[s]})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Contract Table */}
      <ContractList
        contracts={filteredContracts}
        onEdit={handleOpenEdit}
        onDelete={handleOpenDelete}
        onOpenCreate={handleOpenCreate}
      />

      {/* Add / Edit Modal */}
      <Modal
        open={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingContract(null);
        }}
        title={editingContract ? "Edit Kontrak" : "Tambah Kontrak"}
        description={
          editingContract
            ? `Perbarui kontrak ${editingContract.tenants?.full_name ?? ""} — Kamar ${editingContract.rooms?.room_number ?? ""}.`
            : "Hubungkan penyewa dengan kamar untuk mulai penagihan."
        }
        className="max-w-2xl"
      >
        <ContractForm
          initialData={editingContract}
          formData={formData}
          onSubmit={handleFormSubmit}
          onCancel={() => {
            setIsFormModalOpen(false);
            setEditingContract(null);
          }}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <DeleteContractModal
        open={isDeleteModalOpen}
        contract={deletingContract}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingContract(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
