"use client";

import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { PriceSnapshot } from "@/lib/types";
import { useMemo } from "react";

interface StockChartProps {
  snapshots: PriceSnapshot[];
  ticker: string;
}

interface ChartPoint {
  time: string;
  price: number;
  volume: number;
  isSpike?: boolean;
}

// Tooltip
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.name === "price"
            ? `₦${p.value.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`
            : `Vol ${(p.value / 1e6).toFixed(1)}M`}
        </p>
      ))}
    </div>
  );
}

export default function StockChart({ snapshots, ticker }: StockChartProps) {
  const data = useMemo<ChartPoint[]>(() => {
    if (!snapshots.length) return [];

    const sorted = [...snapshots].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const volumes = sorted.map((s) => Number(s.volume ?? 0));
    const meanVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const stdVol = Math.sqrt(
      volumes.reduce((acc, v) => acc + Math.pow(v - meanVol, 2), 0) / volumes.length
    );

    return sorted.map((s) => {
      const vol = Number(s.volume ?? 0);
      const zScore = stdVol > 0 ? (vol - meanVol) / stdVol : 0;
      return {
        time: new Date(s.timestamp).toLocaleDateString("en-NG", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        price: parseFloat(s.price),
        volume: vol,
        isSpike: zScore > 2,
      };
    });
  }, [snapshots]);

  if (!data.length) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
        No price data available yet. Prices are fetched every 15 minutes.
      </div>
    );
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: "#9E9E9E" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="price"
            orientation="left"
            tick={{ fontSize: 10, fill: "#9E9E9E" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `₦${v.toFixed(0)}`}
            width={55}
          />
          <YAxis
            yAxisId="volume"
            orientation="right"
            tick={{ fontSize: 10, fill: "#9E9E9E" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${(v / 1e6).toFixed(0)}M`}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Volume bars — highlight spikes in orange */}
          <Bar
            yAxisId="volume"
            dataKey="volume"
            name="volume"
            fill="#1565C0"
            opacity={0.5}
            radius={[2, 2, 0, 0]}
          />

          {/* Price line */}
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="price"
            name="price"
            stroke="#00C853"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#00C853", stroke: "#0A0A0F", strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-[#00C853] rounded-full" />
          <span className="text-xs text-muted-foreground">Price</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-[#1565C0]/60" />
          <span className="text-xs text-muted-foreground">Volume</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-[#FF6D00]" />
          <span className="text-xs text-muted-foreground">Anomaly spike</span>
        </div>
      </div>
    </div>
  );
}
