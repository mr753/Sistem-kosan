"use client";

import { BedDouble, DoorOpen, Home, ReceiptText, Users } from "lucide-react";
import type { DashboardSummary } from "@/lib/queries/dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { formatIDR } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface CardSpec {
  key: keyof Pick<
    DashboardSummary,
    "totalRooms" | "occupiedRooms" | "vacantRooms" | "activeTenants" | "dueCountThisMonth"
  >;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string; // class utk lingkaran ikon
  value: (s: DashboardSummary) => string;
  hint: (s: DashboardSummary) => string;
}

const CARDS: CardSpec[] = [
  {
    key: "totalRooms",
    label: "Total Kamar",
    icon: BedDouble,
    accent: "bg-blue-100 text-blue-700",
    value: (s) => String(s.totalRooms),
    hint: () => "seluruh properti"
  },
  {
    key: "occupiedRooms",
    label: "Kamar Terisi",
    icon: Home,
    accent: "bg-emerald-100 text-emerald-700",
    value: (s) => String(s.occupiedRooms),
    hint: (s) => (s.totalRooms ? `${Math.round((s.occupiedRooms / s.totalRooms) * 100)}% okupansi` : "-")
  },
  {
    key: "vacantRooms",
    label: "Kamar Kosong",
    icon: DoorOpen,
    accent: "bg-sky-100 text-sky-700",
    value: (s) => String(s.vacantRooms),
    hint: (s) => (s.maintenanceRooms ? `${s.maintenanceRooms} dalam pemeliharaan` : "siap disewakan")
  },
  {
    key: "activeTenants",
    label: "Penyewa Aktif",
    icon: Users,
    accent: "bg-violet-100 text-violet-700",
    value: (s) => String(s.activeTenants),
    hint: () => "kontrak berjalan"
  },
  {
    key: "dueCountThisMonth",
    label: "Tagihan Bulan Ini",
    icon: ReceiptText,
    accent: "bg-amber-100 text-amber-700",
    value: (s) => String(s.dueCountThisMonth),
    hint: (s) => formatIDR(s.dueAmountThisMonth)
  }
];

export function SummaryCards({ summary }: { summary: DashboardSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {CARDS.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.key}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {c.label}
                  </p>
                  <p className="mt-1.5 text-2xl font-bold">{c.value(summary)}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.hint(summary)}</p>
                </div>
                <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", c.accent)}>
                  <Icon className="size-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
