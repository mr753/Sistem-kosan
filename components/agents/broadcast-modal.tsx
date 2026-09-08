"use client";

import * as React from "react";
import { Check, Copy, Mail, MessageCircle, Send } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AGENT_CHANNELS, COMMISSION_TYPES } from "@/lib/constants";
import { formatIDR } from "@/lib/utils";
import {
  buildAvailabilityMessage, emailAgentLink, whatsappAgentLink,
  whatsappShareLink, type VacancyGroup
} from "@/lib/agents/broadcast";
import type { Agent } from "@/lib/types";

interface BroadcastModalProps {
  open: boolean;
  onClose: () => void;
  groups: VacancyGroup[];
  agents: Agent[];
}

const WA_SUBJECT = "Ketersediaan Kamar Kosong";

export function BroadcastModal({ open, onClose, groups, agents }: BroadcastModalProps) {
  const [scope, setScope] = React.useState<"all" | string>("all");
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setScope("all");
      setCopied(false);
    }
  }, [open]);

  const message = React.useMemo(
    () => buildAvailabilityMessage(groups, scope),
    [groups, scope]
  );

  const totalVacant = groups.reduce((n, g) => n + g.rooms.length, 0);
  // Agen yang relevan: khusus properti terpilih atau umum (semua properti)
  const targetAgents = agents.filter((a) => a.is_active && (scope === "all" || !a.property_id || a.property_id === scope));

  async function copyText() {
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      // fallback utk browser lama
      const ta = document.createElement("textarea");
      ta.value = message;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const waShare = whatsappShareLink(message);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Broadcast ke Agen Sewa"
      description={`${totalVacant} kamar kosong siap dipasarkan. Salin teks, lalu kirim via WhatsApp/Email agen — tanpa API berbayar.`}
      className="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Cakupan Properti</label>
          <Select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="all">Semua properti ({totalVacant} kamar kosong)</option>
            {groups.map((g) => (
              <option key={g.property_id} value={g.property_id}>
                {g.property_name} ({g.rooms.length} kamar kosong)
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Teks Siap Salin</label>
            <Button type="button" size="sm" variant="outline" onClick={copyText}>
              {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
              {copied ? "Tersalin!" : "Salin Teks"}
            </Button>
          </div>
          <Textarea readOnly value={message} className="min-h-52 font-mono text-xs leading-relaxed" />
        </div>

        <a
          href={waShare}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <Send className="size-4" /> Bagikan ke WhatsApp
        </a>

        <div className="space-y-2">
          <p className="text-sm font-medium">Kirim langsung ke agen ({targetAgents.length})</p>
          {targetAgents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Tidak ada agen aktif untuk cakupan ini. Tambahkan agen lebih dulu.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {targetAgents.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {a.name}
                      {a.agency_name && <span className="text-muted-foreground"> · {a.agency_name}</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.contact}
                      {a.commission_type === "percent"
                        ? ` · komisi ${a.commission_value}%`
                        : ` · komisi ${formatIDR(a.commission_value)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {a.channel === "email" ? (
                      <a
                        href={emailAgentLink(a.contact, WA_SUBJECT, message)}
                        className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
                      >
                        <Mail className="size-3.5" /> Email
                      </a>
                    ) : (
                      <a
                        href={whatsappAgentLink(a.contact, message)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                      >
                        <MessageCircle className="size-3.5" /> WhatsApp
                      </a>
                    )}
                    <Badge className="bg-muted text-muted-foreground">
                      {AGENT_CHANNELS[a.channel].label}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Tip: untuk beberapa agen, salin teks lalu paste satu per satu agar pesan terlihat personal.
        </p>
      </div>
    </Modal>
  );
}
