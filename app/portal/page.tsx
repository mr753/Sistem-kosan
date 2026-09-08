import { CalendarRange, DoorOpen, ReceiptText } from "lucide-react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMyPortalData } from "@/lib/portal";
import { INVOICE_STATUS, ROOM_STATUS, BILLING_CYCLE } from "@/lib/constants";
import { formatDate, formatIDR } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Beranda" };

export default async function PortalHomePage() {
  const { user, profile } = await requireUser("tenant");
  const supabase = await createClient();
  const data = await getMyPortalData(supabase, user.id);

  if (!data.tenant) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-lg font-semibold">Akun belum terhubung ke profil penyewa</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Hubungi pengelola kos Anda untuk menautkan akun email ini ke data penyewa
            (tabel <code>tenants.user_id</code>). Setelah itu seluruh tagihan &amp; komplain akan muncul di sini.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Login sebagai: <b>{profile.full_name ?? profile.email}</b>
          </p>
        </CardContent>
      </Card>
    );
  }

  const actives = data.contracts.filter((c) => c.status === "active");
  const latest = data.invoices[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Halo, {data.tenant.full_name.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {latest && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 pt-5">
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <ReceiptText className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tagihan terakhir</p>
                <p className="truncate text-sm font-semibold">{latest.period_label}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-5">
              <div className="flex size-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <CalendarRange className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Jatuh tempo</p>
                <p className="truncate text-sm font-semibold">{formatDate(latest.due_date)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-5">
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <DoorOpen className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</p>
                <Badge className={INVOICE_STATUS[latest.status].badge}>
                  {INVOICE_STATUS[latest.status].label}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {actives.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Anda belum memiliki kontrak sewa aktif.
          </CardContent>
        </Card>
      ) : (
        actives.map((c) => {
          const room = c.rooms;
          const prop = c.properties;
          return (
            <Card key={c.id}>
              <CardContent className="space-y-4 pt-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold">{prop?.name ?? "Kos"}</p>
                    <p className="text-sm text-muted-foreground">
                      Kamar <b>{room?.room_number}</b> · {room?.room_type} · {prop?.city}
                    </p>
                  </div>
                  <Badge className={ROOM_STATUS[room?.status ?? "occupied"].badge}>
                    {BILLING_CYCLE[c.billing_cycle].label} — {formatIDR(c.rent_amount)}
                  </Badge>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Mulai sewa</p>
                    <p className="text-sm font-semibold">{formatDate(c.start_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Berakhir</p>
                    <p className="text-sm font-semibold">{c.end_date ? formatDate(c.end_date) : "Terbuka"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Jatuh tempo tagihan</p>
                    <p className="text-sm font-semibold">Tiap tanggal {c.due_day}</p>
                  </div>
                </div>

                {room && room.facilities.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {room.facilities.map((f) => (
                      <span key={f} className="rounded-full bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                        {f}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Link href="/portal/tagihan" className={buttonVariants({ size: "sm" })}>
                    Lihat Tagihan
                  </Link>
                  <Link
                    href="/portal/komplain"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Kirim Komplain
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
