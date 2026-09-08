"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Handshake, Mail, MessageCircle, Pencil, Plus, Search, Send, Trash2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { AgentFormModal } from "@/components/agents/agent-form-modal";
import { BroadcastModal } from "@/components/agents/broadcast-modal";
import { deleteAgentAction } from "@/app/(dashboard)/agents/actions";
import { whatsappAgentLink, type VacancyGroup } from "@/lib/agents/broadcast";
import { AGENT_CHANNELS, COMMISSION_TYPES } from "@/lib/constants";
import { cn, formatIDR } from "@/lib/utils";
import type { Agent } from "@/lib/types";

interface AgentDirectoryProps {
  initialAgents: Agent[];
  properties: { id: string; name: string }[];
  vacancyGroups: VacancyGroup[];
  canManage: boolean;
}

export function AgentDirectory({
  initialAgents,
  properties,
  vacancyGroups,
  canManage
}: AgentDirectoryProps) {
  const router = useRouter();
  const [agents, setAgents] = React.useState<Agent[]>(initialAgents);
  const [q, setQ] = React.useState("");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Agent | null>(null);
  const [broadcastOpen, setBroadcastOpen] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const filtered = agents.filter((a) => {
    const s = q.toLowerCase();
    return (
      !s ||
      a.name.toLowerCase().includes(s) ||
      (a.agency_name ?? "").toLowerCase().includes(s) ||
      a.contact.toLowerCase().includes(s) ||
      (a.notes ?? "").toLowerCase().includes(s)
    );
  });

  const totalVacant = vacancyGroups.reduce((n, g) => n + g.rooms.length, 0);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(agent: Agent) {
    setEditing(agent);
    setFormOpen(true);
  }

  async function handleDelete(agent: Agent) {
    if (!window.confirm(`Hapus agen "${agent.name}"?`)) return;
    setBusyId(agent.id);
    setActionError(null);
    const res = await deleteAgentAction(agent.id);
    setBusyId(null);
    if (!res.ok) {
      setActionError(res.error);
      return;
    }
    setAgents((prev) => prev.filter((a) => a.id !== agent.id));
    router.refresh();
  }

  function contactHref(a: Agent): string | null {
    if (a.channel === "whatsapp") return whatsappAgentLink(a.contact);
    if (a.channel === "email") return `mailto:${a.contact}`;
    if (a.channel === "phone") return `tel:${a.contact.replace(/\s/g, "")}`;
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari agen / agensi / catatan..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {canManage && (
            <Button variant="outline" onClick={openCreate}>
              <Plus className="size-4" /> Tambah Agen
            </Button>
          )}
          <Button
            onClick={() => setBroadcastOpen(true)}
            disabled={totalVacant === 0}
            title={totalVacant === 0 ? "Belum ada kamar kosong untuk di-broadcast" : undefined}
          >
            <Send className="size-4" /> Broadcast Kamar Kosong
            {totalVacant > 0 && <span className="rounded-full bg-white/20 px-1.5 text-xs">{totalVacant}</span>}
          </Button>
        </div>
      </div>

      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agen</TableHead>
                  <TableHead>Kontak</TableHead>
                  <TableHead>Properti</TableHead>
                  <TableHead>Komisi</TableHead>
                  <TableHead>Catatan</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 7 : 6} className="h-24 text-center text-muted-foreground">
                      {agents.length === 0
                        ? "Belum ada agen. Klik “Tambah Agen” untuk menyimpan kontak agen sewa."
                        : "Tidak ada hasil untuk pencarian ini."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((a) => {
                    const href = contactHref(a);
                    const wa = a.channel === "whatsapp";
                    return (
                      <TableRow key={a.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                              wa ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground")}>
                              <Handshake className="size-4" />
                            </div>
                            <div className="leading-tight">
                              <p className="font-medium">{a.name}</p>
                              {a.agency_name && (
                                <p className="text-xs text-muted-foreground">{a.agency_name}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {href ? (
                            <a
                              href={href}
                              target={wa ? "_blank" : undefined}
                              rel={wa ? "noopener noreferrer" : undefined}
                              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                            >
                              {wa ? <MessageCircle className="size-3.5" /> : a.channel === "email" ? <Mail className="size-3.5" /> : null}
                              {a.contact}
                            </a>
                          ) : (
                            <span className="text-sm">{a.contact}</span>
                          )}
                          <p className="text-xs text-muted-foreground">{AGENT_CHANNELS[a.channel].label}</p>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {a.properties?.name ?? (a.property_id ? "Properti tertentu" : "Semua properti")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">
                            {a.commission_type === "percent"
                              ? `${a.commission_value}%`
                              : formatIDR(a.commission_value)}
                          </span>
                          <p className="text-xs text-muted-foreground">{COMMISSION_TYPES[a.commission_type].label}</p>
                        </TableCell>
                        <TableCell>
                          <p className="max-w-52 truncate text-sm text-muted-foreground" title={a.notes ?? ""}>
                            {a.notes || "-"}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge className={a.is_active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}>
                            {a.is_active ? "Aktif" : "Nonaktif"}
                          </Badge>
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(a)} aria-label="Edit agen">
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(a)}
                                disabled={busyId === a.id}
                                aria-label="Hapus agen"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {canManage && (
        <AgentFormModal
          open={formOpen}
          onClose={() => setFormOpen(false)}
          agent={editing}
          properties={properties}
        />
      )}

      <BroadcastModal
        open={broadcastOpen}
        onClose={() => setBroadcastOpen(false)}
        groups={vacancyGroups}
        agents={agents}
      />
    </div>
  );
}
