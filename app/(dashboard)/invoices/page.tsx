import { ReceiptText } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { invoiceTotals, type InvoiceWithExtras } from "@/lib/invoicing";
import type { InvoiceItem } from "@/lib/types";
import { signPaths } from "@/lib/media";
import { INVOICE_STATUS } from "@/lib/constants";
import { formatDate, formatIDR } from "@/lib/utils";
import {
  approveInvoiceAction,
  generateInvoicesAction,
  openWhatsAppReminderAction,
  rejectInvoiceAction,
  revertInvoiceAction
} from "@/app/(dashboard)/invoices/actions";
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

export const metadata = { title: "Tagihan" };

export default async function InvoicesPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();

  let q = supabase.from("invoices").select("*, tenants(full_name), rooms(room_number)");
  if (profile.role !== "super_admin") {
    const { data: props } = await supabase.from("properties").select("id").eq("owner_id", profile.id);
    const ids = (props ?? []).map((p) => p.id);
    if (!ids.length) {
      return (
        <EmptyNotice title="Belum ada properti" desc="Tambahkan properti terlebih dahulu agar bisa membuat tagihan." />
      );
    }
    q = q.in("property_id", ids);
  }
  const { data: raw } = await q.order("period_start", { ascending: false }).order("due_date", { ascending: true });
  const invoices = (raw ?? []) as unknown as InvoiceWithExtras[];

  const itemRows = invoices.length
    ? await supabase.from("invoice_items").select("*").in("invoice_id", invoices.map((i) => i.id))
    : { data: [] };
  const totals = invoiceTotals(invoices, (itemRows.data ?? []) as unknown as InvoiceItem[]);

  const pending = invoices.filter((i) => i.status === "pending_confirmation");
  const proofUrls = Object.fromEntries(
    (await signPaths(
      "payment-proofs",
      invoices.map((i) => (i.status === "pending_confirmation" ? i.proof_url : null))
    )).map((url, idx) => [invoices[idx].id, url])
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tagihan & Pembayaran</h1>
          <p className="text-sm text-muted-foreground">
            {pending.length} tagihan menunggu verifikasi bukti transfer dari penyewa.
          </p>
        </div>
        {profile.role === "landlord" && (
          <ActionButton label="Generate Tagihan Bulan Ini" run={() => generateInvoicesAction()} />
        )}
      </div>

      {invoices.length === 0 ? (
        <EmptyNotice title="Belum ada tagihan" desc="Klik Generate Tagihan Bulan Ini untuk membuat invoice kontrak aktif secara otomatis." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Periode</TableHead>
                    <TableHead>Penyewa / Kamar</TableHead>
                    <TableHead>Jatuh Tempo</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Bukti</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => {
                    const st = INVOICE_STATUS[inv.status];
                    const tenant = inv.tenants as unknown as { full_name: string | null } | null;
                    const room = inv.rooms as unknown as { room_number: string | null } | null;
                    return (
                      <TableRow key={inv.id}>
                        <TableCell>
                          <p className="font-medium">{inv.period_label}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(inv.created_at)}</p>
                        </TableCell>
                        <TableCell>
                          {tenant?.full_name ?? "Penyewa"}
                          <p className="text-xs text-muted-foreground">Kamar {room?.room_number ?? "-"}</p>
                        </TableCell>
                        <TableCell>{formatDate(inv.due_date)}</TableCell>
                        <TableCell className="font-medium">{formatIDR(totals[inv.id] ?? 0)}</TableCell>
                        <TableCell>
                          <Badge className={st.badge}>{st.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {inv.status === "pending_confirmation" && inv.proof_url ? (
                            proofUrls[inv.id] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={proofUrls[inv.id]!}
                                alt="Bukti transfer"
                                className="h-14 w-14 rounded-lg border object-cover"
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">ada</span>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {(inv.status === "unpaid" || inv.status === "pending_confirmation") && (
                              <ActionButton
                                label="Buka WhatsApp"
                                variant="outline"
                                size="sm"
                                run={() => openWhatsAppReminderAction(inv.id)}
                              />
                            )}
                            {inv.status === "pending_confirmation" && (
                              <>
                                <ActionButton label="Terima" variant="success" size="sm" run={() => approveInvoiceAction(inv.id)} />
                                <ActionButton label="Tolak" variant="outline" size="sm" run={() => rejectInvoiceAction(inv.id)} />
                              </>
                            )}
                            {inv.status === "unpaid" && (
                              <ActionButton label="Tandai Lunas" variant="success" size="sm" run={() => approveInvoiceAction(inv.id)} />
                            )}
                            {inv.status === "paid" && (
                              <ActionButton
                                label="Batalkan Lunas"
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground"
                                confirm={`Batalkan status Lunas untuk tagihan ${inv.period_label}? Transaksi pemasukan otomatis yang menyertai tagihan ini juga akan dihapus.`}
                                run={() => revertInvoiceAction(inv.id)}
                              />
                            )}
                          </div>
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

function EmptyNotice({ title, desc }: { title: string; desc: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <ReceiptText className="size-5" />
        </div>
        <p className="font-semibold">{title}</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}
