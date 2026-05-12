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
      <AreaChart data={data} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(31,26,20,0.06)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#897C68" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${Math.round(v / 1000)}k`}
          tick={{ fontSize: 11, fill: "#897C68" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(v) => formatMoney(Number(v) || 0)}
          contentStyle={{ borderRadius: 12, border: "1px solid rgba(31,26,20,0.08)", fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
        <Area
          type="monotone"
          dataKey="income"
          stroke="#7BCFA9"
          fill="#7BCFA9"
          fillOpacity={0.25}
          strokeWidth={2}
          name="Income"
        />
        <Area
          type="monotone"
          dataKey="expenses"
          stroke="#FF6B5C"
          fill="#FF6B5C"
          fillOpacity={0.25}
          strokeWidth={2}
          name="Spending"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
