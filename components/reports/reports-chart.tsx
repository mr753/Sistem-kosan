"use client";

import { useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatIDR } from "@/lib/utils";
import type { MonthlyPoint } from "@/lib/queries/reports";

const TOOLTIP_STYLE = {
  borderRadius: 8,
  border: "1px solid hsl(var(--border))",
  fontSize: 12
};

/**
 * Chart Pemasukan vs Pengeluaran per bulan.
 * Data identik dengan summary & tabel laporan (MonthlyPoint dari query yang sama).
 */
export function ReportsChart({ data }: { data: MonthlyPoint[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const hasData = data.some((d) => d.income > 0 || d.expense > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pemasukan vs Pengeluaran</CardTitle>
        <CardDescription>
          Per bulan dari catatan transaksi aktual pada periode &amp; properti terpilih.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!mounted ? (
          <div className="h-72 w-full animate-pulse rounded bg-muted" />
        ) : !hasData ? (
          <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
            Belum ada transaksi pada periode ini.
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tickFormatter={(v: number) => formatIDR(v, { compact: true })}
                  width={70}
                />
                <Tooltip
                  formatter={(value) => formatIDR(Number(value))}
                  cursor={{ fill: "hsl(var(--muted))" }}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="income" name="Pemasukan" fill="hsl(142.1 76.2% 36.3%)" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Bar dataKey="expense" name="Pengeluaran" fill="hsl(0 84.2% 60.2%)" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
