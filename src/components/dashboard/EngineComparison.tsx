"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  LabelList,
} from "recharts";
import { scoreColor } from "@/lib/score";

export function EngineComparison({
  data,
}: {
  data: { engine: string; score: number }[];
}) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 36, bottom: 4, left: 8 }}
        >
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis
            type="category"
            dataKey="engine"
            width={80}
            tick={{ fill: "#cbd5e1", fontSize: 13 }}
            axisLine={false}
            tickLine={false}
          />
          <Bar dataKey="score" radius={[6, 6, 6, 6]} barSize={26}>
            {data.map((d) => (
              <Cell key={d.engine} fill={scoreColor(d.score)} />
            ))}
            <LabelList
              dataKey="score"
              position="right"
              fill="#f8fafc"
              fontSize={13}
              fontWeight={600}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
