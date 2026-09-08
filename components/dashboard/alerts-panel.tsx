"use client";

import Link from "next/link";
import { AlertTriangle, CalendarClock, FileSignature, Wrench } from "lucide-react";
import type { DashboardAlert } from "@/lib/queries/dashboard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const KIND_META = {
  payment_overdue: { icon: AlertTriangle, badge: "bg-red-100 text-red-700", label: "Tunggakan" },
  contract_expiring: { icon: CalendarClock, badge: "bg-amber-100 text-amber-700", label: "Kontrak" },
  new_ticket: { icon: Wrench, badge: "bg-blue-100 text-blue-700", label: "Komplain" }
} as const;

export function AlertsPanel({ alerts }: { alerts: DashboardAlert[] }) {
  return (
    <Card className="self-start">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSignature className="size-4 text-muted-foreground" />
          Notifikasi
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Tidak ada notifikasi. Semua aman 🎉
          </div>
        ) : (
          <ul className="space-y-2">
            {alerts.slice(0, 8).map((alert) => {
              const meta = KIND_META[alert.kind];
              const Icon = meta.icon;
              return (
                <li key={alert.id}>
                  <Link
                    href={alert.href}
                    className={cn(
                      "block rounded-lg border p-3 transition-colors hover:bg-muted/50",
                      alert.severity === "high" ? "border-red-200 bg-red-50/60" : "border-border"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <p className="min-w-0 flex-1 truncate text-sm font-medium">{alert.title}</p>
                      <Badge className={meta.badge}>{meta.label}</Badge>
                    </div>
                    <p className="mt-1 pl-6 text-xs text-muted-foreground">{alert.body}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
