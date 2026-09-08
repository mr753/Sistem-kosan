import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMyPortalData, activeContract } from "@/lib/portal";
import { signPaths } from "@/lib/media";
import {
  TICKET_PRIORITY, TICKET_STATUS, type TicketPriority, type TicketStatus
} from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TicketForm } from "@/components/portal/ticket-form";

export const metadata = { title: "Komplain Saya" };

export default async function PortalTicketsPage() {
  const { user } = await requireUser("tenant");
  const supabase = await createClient();
  const data = await getMyPortalData(supabase, user.id);

  const canSend = Boolean(data.tenant && activeContract(data));

  const { data: ticketsRaw } = await supabase
    .from("tickets")
    .select("*")
    .eq("tenant_id", data.tenant?.id ?? "")
    .order("created_at", { ascending: false });

  interface TicketRow {
    id: string;
    subject: string;
    description: string | null;
    status: TicketStatus;
    priority: TicketPriority;
    created_at: string;
    photos: string[] | null;
  }
  const tickets = ((ticketsRaw ?? []) as TicketRow[]).map((t) => ({ ...t, photos: t.photos ?? [] }));
  const photoUrlsByTicket = Object.fromEntries(
    await Promise.all(
      tickets.map(async (t) => {
        const urls = await signPaths("ticket-photos", t.photos);
        return [t.id, urls] as const;
      })
    )
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Komplain Saya</h1>
        <p className="text-sm text-muted-foreground">
          Laporan kerusakan / perbaikan akan langsung muncul di dashboard pengelola.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kirim Komplain Baru</CardTitle>
        </CardHeader>
        <CardContent>
          <TicketForm enabled={canSend} />
        </CardContent>
      </Card>

      {tickets.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Belum ada komplain.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tickets.map((t) => (
            <Card key={t.id}>
              <CardContent className="space-y-3 pt-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{t.subject}</p>
                  <Badge className={TICKET_STATUS[t.status].badge}>{TICKET_STATUS[t.status].label}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{t.description || "-"}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge className="bg-secondary text-secondary-foreground">
                    Prioritas {TICKET_PRIORITY[t.priority].label}
                  </Badge>
                  <span>{formatDateTime(t.created_at)}</span>
                </div>
                {t.photos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {photoUrlsByTicket[t.id]
                      ?.filter(Boolean)
                      .map((url, idx) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={idx} src={url!} alt={`foto ${idx + 1}`} className="h-20 w-20 rounded-lg border object-cover" />
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
