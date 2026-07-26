"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";

type ActivityPoint = {
  week: string;
  paid: number;
};

export function ActivityChart({ data }: { data: ActivityPoint[] }) {
  return (
    <Card className="h-[300px]">
      <p className="mb-4 text-sm text-slate-300">Escrow release velocity (USDC)</p>
      <ResponsiveContainer width="100%" height="90%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="flow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.7} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="week" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip />
          <Area type="monotone" dataKey="paid" stroke="#22d3ee" fill="url(#flow)" />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
