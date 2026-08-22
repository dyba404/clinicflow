"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export function IngresosChart({
  data,
}: {
  data: Array<{ label: string; fecha: string; total: number }>;
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="ig-ingresos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0d9488" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#0d9488" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(42 12% 88%)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "hsl(24 6% 44%)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            width={56}
            tick={{ fontSize: 11, fill: "hsl(24 6% 44%)" }}
            tickFormatter={(v: number) => `S/ ${v}`}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(value) =>
              new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(
                Number(value),
              )
            }
            labelStyle={{ fontSize: 12, fontWeight: 600 }}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid hsl(42 12% 88%)",
              background: "#fff",
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="total"
            name="Ingresos"
            stroke="#0d9488"
            strokeWidth={2}
            fill="url(#ig-ingresos)"
            dot={false}
            activeDot={{ r: 4, fill: "#0d9488" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
