"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CHART_COLORS } from "@/lib/constants";
import { formatMoney } from "@/lib/format";

type Datum = { name: string; total: number; color: string };

export function CategoryPie({ data }: { data: Datum[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="total"
          nameKey="name"
          innerRadius={62}
          outerRadius={100}
          paddingAngle={3}
          stroke="white"
          strokeWidth={3}
        >
          {data.map((d, i) => (
            <Cell key={d.name} fill={d.color || CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v) => formatMoney(Number(v) || 0)}
          contentStyle={{ borderRadius: 12, border: "1px solid rgba(31,26,20,0.08)", fontSize: 12 }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          iconType="circle"
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
