"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Datum = { label: string; rate: number };

export function SavingsLine({ data }: { data: Datum[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" />
        <YAxis tickFormatter={(v) => `${v}%`} />
        <Tooltip formatter={(v) => `${Number(v) || 0}%`} />
        <Line
          type="monotone"
          dataKey="rate"
          stroke="#4e73df"
          strokeWidth={2}
          dot={{ r: 4, fill: "#4e73df" }}
          name="Savings Rate"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
