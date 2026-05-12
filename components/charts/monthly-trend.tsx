"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/format";

type Datum = { label: string; income: number; expenses: number };

export function MonthlyTrend({ data }: { data: Datum[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" />
        <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
        <Tooltip formatter={(v) => formatMoney(Number(v) || 0)} />
        <Legend />
        <Area
          type="monotone"
          dataKey="income"
          stroke="#1cc88a"
          fill="#1cc88a"
          fillOpacity={0.2}
          name="Income"
        />
        <Area
          type="monotone"
          dataKey="expenses"
          stroke="#e74a3b"
          fill="#e74a3b"
          fillOpacity={0.2}
          name="Expenses"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
