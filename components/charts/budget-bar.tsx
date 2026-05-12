"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/format";

type Datum = { name: string; budgeted: number; spent: number };

export function BudgetBar({ data }: { data: Datum[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(31,26,20,0.06)" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v) => `${Math.round(v / 1000)}k`}
          tick={{ fontSize: 11, fill: "#897C68" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={100}
          tick={{ fontSize: 12, fill: "#1F1A14" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(v) => formatMoney(Number(v) || 0)}
          contentStyle={{ borderRadius: 12, border: "1px solid rgba(31,26,20,0.08)", fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
        <Bar dataKey="budgeted" fill="#FFD86B" name="Budgeted" radius={[6, 6, 6, 6]} />
        <Bar dataKey="spent" fill="#FF6B5C" name="Spent" radius={[6, 6, 6, 6]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
