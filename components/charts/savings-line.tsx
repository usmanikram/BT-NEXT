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
      <LineChart data={data} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(31,26,20,0.06)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#897C68" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: "#897C68" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(v) => `${Number(v) || 0}%`}
          contentStyle={{ borderRadius: 12, border: "1px solid rgba(31,26,20,0.08)", fontSize: 12 }}
        />
        <Line
          type="monotone"
          dataKey="rate"
          stroke="#1F1A14"
          strokeWidth={2.5}
          dot={{ r: 4, fill: "#FF6B5C", stroke: "#1F1A14", strokeWidth: 2 }}
          activeDot={{ r: 6 }}
          name="Savings rate"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
