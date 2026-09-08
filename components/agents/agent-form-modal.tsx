"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AGENT_CHANNELS, COMMISSION_TYPES } from "@/lib/constants";
import {
  createAgentAction,
  updateAgentAction
} from "@/app/(dashboard)/agents/actions";
import type { Agent } from "@/lib/types";

interface AgentFormModalProps {
  open: boolean;
  onClose: () => void;
  /** null = mode tambah */
  agent: Agent | null;
  properties: { id: string; name: string }[];
}

const CHANNEL_KEYS = Object.keys(AGENT_CHANNELS) as (keyof typeof AGENT_CHANNELS)[];
const COMMISSION_KEYS = Object.keys(COMMISSION_TYPES) as (keyof typeof COMMISSION_TYPES)[];

export function AgentFormModal({ open, onClose, agent, properties }: AgentFormModalProps) {
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const isEdit = Boolean(agent);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const formData = new FormData(e.currentTarget);

    const res = agent
      ? await updateAgentAction(agent.id, formData)
      : await createAgentAction(formData);

    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onClose();
  }

  // key unik => form di-remount tiap modal dibuka, nilai default selalu segar
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Agen Sewa" : "Tambah Agen Sewa"}
      description="Simpan kontak agen pihak ketiga (Mamikos, Infokost, agen lokal, dll)."
    >
      <form key={`${agent?.id ?? "new"}-${String(open)}`} onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Nama Kontak *</Label>
            <Input id="name" name="name" required defaultValue={agent?.name ?? ""} placeholder="cth: Pak Rudi" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agency_name">Nama Agen</Label>
            <Input id="agency_name" name="agency_name" defaultValue={agent?.agency_name ?? ""} placeholder="Mamikos / Infokost / Lokal" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="channel">Saluran Kontak</Label>
            <Select id="channel" name="channel" defaultValue={agent?.channel ?? "whatsapp"}>
              {CHANNEL_KEYS.map((k) => (
                <option key={k} value={k}>{AGENT_CHANNELS[k].label}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact">Kontak (WA/Email/HP) *</Label>
            <Input id="contact" name="contact" required defaultValue={agent?.contact ?? ""} placeholder="08xx-xxxx-xxxx atau email" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="property_id">Properti Terkait</Label>
          <Select id="property_id" name="property_id" defaultValue={agent?.property_id ?? ""}>
            <option value="">Semua properti (umum)</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="commission_type">Jenis Komisi</Label>
            <Select id="commission_type" name="commission_type" defaultValue={agent?.commission_type ?? "percent"}>
              {COMMISSION_KEYS.map((k) => (
                <option key={k} value={k}>{COMMISSION_TYPES[k].label}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="commission_value">Nilai Komisi</Label>
            <Input id="commission_value" name="commission_value" type="number" min="0" step="0.01"
              defaultValue={agent?.commission_value ?? 0} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Catatan</Label>
          <Textarea id="notes" name="notes" defaultValue={agent?.notes ?? ""}
            placeholder="cth: komisi 5% per penyewa berhasil. Kirim update tiap kamar kosong." />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_active" defaultChecked={agent ? agent.is_active : true} className="size-4 rounded border-input" />
          Agen aktif
        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "Simpan Perubahan" : "Tambah Agen"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
