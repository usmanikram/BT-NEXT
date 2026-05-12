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
      <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
        <YAxis type="category" dataKey="name" width={100} />
        <Tooltip formatter={(v) => formatMoney(Number(v) || 0)} />
        <Legend />
        <Bar dataKey="budgeted" fill="#4e73df" name="Budgeted" />
        <Bar dataKey="spent" fill="#1cc88a" name="Spent" />
      </BarChart>
    </ResponsiveContainer>
  );
}
