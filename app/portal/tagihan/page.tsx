import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMyPortalData } from "@/lib/portal";
import { invoiceTotal } from "@/lib/invoicing";
import { INVOICE_ITEM_KINDS, INVOICE_STATUS } from "@/lib/constants";
import { formatDate, formatIDR } from "@/lib/utils";
import { signPath } from "@/lib/media";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PayButton } from "@/components/portal/pay-button";

export const metadata = { title: "Tagihan Saya" };

export default async function PortalInvoicesPage() {
  const { user } = await requireUser("tenant");
  const supabase = await createClient();
  const data = await getMyPortalData(supabase, user.id);

  if (!data.tenant) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Akun belum terhubung ke profil penyewa. Hubungi pengelola kos Anda.
        </CardContent>
      </Card>
    );
  }

  const openTotal = data.invoices
    .filter((i) => i.status !== "paid")
    .reduce((sum, i) => sum + invoiceTotal(i, data.itemsByInvoice[i.id] ?? []), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Tagihan Saya</h1>
          <p className="text-sm text-muted-foreground">
            {openTotal > 0 ? (
              <>
                Total belum dibayar: <b className="text-red-600">{formatIDR(openTotal)}</b>
              </>
            ) : (
              "Semua tagihan lunas. Terima kasih!"
            )}
          </p>
        </div>
        <Link href="/portal/komplain" className="text-sm text-primary hover:underline">
          Ada masalah pembayaran? Hubungi pengelola via komplain
        </Link>
      </div>

      {data.invoices.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Belum ada tagihan untuk kontrak Anda.
          </CardContent>
        </Card>
      )}

      {data.invoices.map((inv) => {
        const items = data.itemsByInvoice[inv.id] ?? [];
        const total = invoiceTotal(inv, items);
        const st = INVOICE_STATUS[inv.status];
        return (
          <Card key={inv.id}>
            <CardContent className="space-y-3 pt-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold">{inv.period_label}</p>
                    <Badge className={st.badge}>{st.label}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Kamar {inv.rooms?.room_number} · jatuh tempo {formatDate(inv.due_date)}
                  </p>
                </div>
                <p className="text-xl font-bold">{formatIDR(total)}</p>
              </div>

              {items.length > 0 && (
                <ul className="space-y-1 rounded-lg bg-muted/50 p-3 text-sm">
                  <li className="flex justify-between text-muted-foreground">
                    <span>Sewa pokok</span>
                    <b className="text-foreground">{formatIDR(inv.base_rent)}</b>
                  </li>
                  {items.map((it) => (
                    <li key={it.id} className="flex justify-between text-muted-foreground">
                      <span>
                        {it.label}{" "}
                        <Badge className="bg-secondary text-secondary-foreground">
                          {INVOICE_ITEM_KINDS[it.kind]?.label ?? it.kind}
                        </Badge>
                      </span>
                      <b className="text-foreground">{formatIDR(it.amount)}</b>
                    </li>
                  ))}
                </ul>
              )}

              {inv.proof_url && inv.status !== "paid" && (
                <ProofPreview path={inv.proof_url} />
              )}

              {(inv.status === "unpaid" || inv.status === "pending_confirmation") && (
                <PayButton invoiceId={inv.id} total={formatIDR(total)} period={inv.period_label} />
              )}
              {inv.status === "pending_confirmation" && (
                <p className="text-xs text-muted-foreground">
                  Bukti sudah terkirim — menunggu verifikasi pengelola. Status akan berubah menjadi Lunas setelah diverifikasi.
                </p>
              )}
              {inv.status === "paid" && inv.paid_at && (
                <p className="text-xs text-muted-foreground">Dibayar &amp; diverifikasi pada {formatDate(inv.paid_at)}.</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

async function ProofPreview({ path }: { path: string }) {
  const url = await signPath("payment-proofs", path);
  if (!url) return <p className="text-xs text-muted-foreground">Bukti: tidak tersedia.</p>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="Bukti transfer" className="max-h-48 rounded-lg border" />;
}
