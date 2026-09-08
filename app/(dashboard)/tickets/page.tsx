import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TICKET_PRIORITY, TICKET_STATUS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { updateTicketStatusAction } from "@/app/(dashboard)/tickets/actions";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/action-button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

export const metadata = { title: "Komplain" };

interface TicketRow {
  id: string;
  subject: string;
  status: keyof typeof TICKET_STATUS;
  priority: keyof typeof TICKET_PRIORITY;
  created_at: string;
  photos: string[];
  tenants?: { full_name: string | null } | null;
  rooms?: { room_number: string | null } | null;
}

const NEXT_STEP: Record<string, string> = {
  open: "in_progress",
  in_progress: "resolved",
  resolved: "closed"
};

export default async function TicketsPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();

  let q = supabase.from("tickets").select("*, tenants(full_name), rooms(room_number)");
  if (profile.role !== "super_admin") {
    const { data: props } = await supabase.from("properties").select("id").eq("owner_id", profile.id);
    const ids = (props ?? []).map((p) => p.id);
    if (!ids.length) {
      return (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">Belum ada properti.</CardContent>
        </Card>
      );
    }
    q = q.in("property_id", ids);
  }
  const { data: raw } = await q.order("created_at", { ascending: false });
  const tickets = (raw ?? []) as unknown as TicketRow[];

  const openCount = tickets.filter((t) => t.status === "open").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Komplain & Perbaikan</h1>
        <p className="text-sm text-muted-foreground">
          {openCount > 0 ? `${openCount} komplain baru menunggu ditindaklanjuti.` : "Tidak ada komplain baru."}
        </p>
      </div>

      {tickets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Belum ada komplain dari penyewa. Komplain baru akan muncul otomatis di sini dan di Dashboard.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subjek</TableHead>
                    <TableHead>Dari</TableHead>
                    <TableHead>Prioritas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Dibuat</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((t) => {
                    const next = NEXT_STEP[t.status];
                    const tenant = t.tenants as unknown as { full_name: string | null } | null;
                    const room = t.rooms as unknown as { room_number: string | null } | null;
                    return (
                      <TableRow key={t.id}>
                        <TableCell>
                          <p className="font-medium">{t.subject}</p>
                          {t.photos.length > 0 && (
                            <p className="text-xs text-muted-foreground">{t.photos.length} foto terlampir</p>
                          )}
                        </TableCell>
                        <TableCell>
                          {tenant?.full_name ?? "Penyewa"}
                          <p className="text-xs text-muted-foreground">Kamar {room?.room_number ?? "-"}</p>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-secondary text-secondary-foreground">
                            {TICKET_PRIORITY[t.priority].label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={TICKET_STATUS[t.status].badge}>{TICKET_STATUS[t.status].label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDateTime(t.created_at)}</TableCell>
                        <TableCell className="text-right">
                          {next ? (
                            <ActionButton
                              label={`Tandai: ${TICKET_STATUS[next as keyof typeof TICKET_STATUS].label}`}
                              variant="outline"
                              size="sm"
                              run={() =>
                                updateTicketStatusAction(
                                  t.id,
                                  next as Parameters<typeof updateTicketStatusAction>[1]
                                )
                              }
                            />
                          ) : t.status !== "closed" ? (
                            <ActionButton
                              label="Tutup"
                              variant="ghost"
                              size="sm"
                              run={() => updateTicketStatusAction(t.id, "closed")}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">Selesai</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
