"use client";

import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import type { MonthlyFinance } from "@/lib/queries/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatIDR } from "@/lib/utils";

const TOOLTIP_STYLE = {
  borderRadius: 8,
  border: "1px solid hsl(var(--border))",
  fontSize: 12
};

export function RevenueChart({ finance }: { finance: MonthlyFinance[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pendapatan vs Pengeluaran</CardTitle>
        <CardDescription>6 bulan terakhir dari catatan transaksi (uang masuk vs keluar)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={finance} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
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
              <Bar dataKey="income" name="Pendapatan" fill="hsl(142.1 76.2% 36.3%)" radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Bar dataKey="expense" name="Pengeluaran" fill="hsl(0 84.2% 60.2%)" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
