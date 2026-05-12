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
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" />
        <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
        <Tooltip formatter={(v) => formatMoney(Number(v) || 0)} />
        <Legend />
        {series.map((s, i) => (
          <Bar
            key={s.name}
            dataKey={s.name}
            stackId="a"
            fill={s.color || CHART_COLORS[i % CHART_COLORS.length]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
