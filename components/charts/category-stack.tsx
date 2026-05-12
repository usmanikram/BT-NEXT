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
import { CHART_COLORS } from "@/lib/constants";
import { formatMoney } from "@/lib/format";

type Series = { name: string; color: string };

export function CategoryStack({
  data,
  series,
}: {
  data: Record<string, string | number>[];
  series: Series[];
}) {
  return (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart data={data} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
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
        {series.map((s, i) => (
          <Bar
            key={s.name}
            dataKey={s.name}
            stackId="a"
            fill={s.color || CHART_COLORS[i % CHART_COLORS.length]}
            radius={i === series.length - 1 ? [6, 6, 0, 0] : 0}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
