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
  Area,
} from "recharts";
import type { PriceSnapshot, TechnicalSignals } from "@/lib/types";
import { useMemo } from "react";

interface StockChartProps {
  snapshots: PriceSnapshot[];
  ticker: string;
  signals?: TechnicalSignals | null;
}

interface ChartPoint {
  time: string;
  price: number;
  volume: number;
  isSpike?: boolean;
}

interface RsiPoint {
  time: string;
  rsi: number;
}

// ─── Tooltips ───────────────────────────────────────────────

function PriceTooltip({
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
            : p.name === "volume"
            ? `Vol ${(p.value / 1e6).toFixed(1)}M`
            : null}
        </p>
      ))}
    </div>
  );
}

function RsiTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p style={{ color: payload[0].color }} className="font-semibold">
        RSI: {payload[0].value.toFixed(1)}
      </p>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────

export default function StockChart({ snapshots, ticker, signals }: StockChartProps) {
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

  // RSI chart data: replicate the time labels from price data but use a single RSI value
  // (static RSI displayed as a horizontal constant across the chart)
  const rsiValue = signals?.rsi14 ? parseFloat(signals.rsi14) : null;
  const bbUpper = signals?.bbUpper ? parseFloat(signals.bbUpper) : null;
  const bbLower = signals?.bbLower ? parseFloat(signals.bbLower) : null;

  const rsiData = useMemo<RsiPoint[]>(() => {
    if (rsiValue === null || !data.length) return [];
    // Show as a flat line across all time points — the RSI is current
    return data.map((d) => ({ time: d.time, rsi: rsiValue }));
  }, [data, rsiValue]);

  if (!data.length) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
        No price data available yet. Prices are fetched every 15 minutes.
      </div>
    );
  }

  const priceMin = Math.min(...data.map((d) => d.price));
  const priceMax = Math.max(...data.map((d) => d.price));
  const pricePad = (priceMax - priceMin) * 0.05 || 1;

  return (
    <div className="w-full space-y-3">
      {/* Price + Volume chart */}
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
            domain={[priceMin - pricePad, priceMax + pricePad]}
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
          <Tooltip content={<PriceTooltip />} />

          {/* Bollinger Bands — area fill if signals available */}
          {bbUpper !== null && bbLower !== null && (
            <>
              {/* Upper band reference */}
              <ReferenceLine
                yAxisId="price"
                y={bbUpper}
                stroke="#7C3AED"
                strokeDasharray="4 3"
                strokeOpacity={0.6}
                label={{ value: "BB↑", position: "insideTopRight", fontSize: 9, fill: "#7C3AED" }}
              />
              {/* Lower band reference */}
              <ReferenceLine
                yAxisId="price"
                y={bbLower}
                stroke="#7C3AED"
                strokeDasharray="4 3"
                strokeOpacity={0.6}
                label={{ value: "BB↓", position: "insideBottomRight", fontSize: 9, fill: "#7C3AED" }}
              />
            </>
          )}

          {/* Volume bars */}
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
      <div className="flex items-center gap-4 px-1 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-[#00C853] rounded-full" />
          <span className="text-xs text-muted-foreground">Price</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-[#1565C0]/60" />
          <span className="text-xs text-muted-foreground">Volume</span>
        </div>
        {bbUpper !== null && (
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0 border-t-2 border-dashed border-[#7C3AED]" />
            <span className="text-xs text-muted-foreground">Bollinger Bands</span>
          </div>
        )}
      </div>

      {/* RSI subplot */}
      {rsiData.length > 0 && rsiValue !== null && (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="px-3 pt-2 pb-0 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              RSI-14
            </span>
            <span
              className={`text-[10px] font-bold ${
                rsiValue > 70
                  ? "text-[#FF1744]"
                  : rsiValue < 30
                  ? "text-[#00E676]"
                  : "text-[#FFD600]"
              }`}
            >
              {rsiValue.toFixed(1)}{" "}
              {rsiValue > 70 ? "— Overbought" : rsiValue < 30 ? "— Oversold" : "— Neutral"}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <ComposedChart data={rsiData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" vertical={false} />
              <XAxis dataKey="time" hide />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 9, fill: "#9E9E9E" }}
                tickLine={false}
                axisLine={false}
                width={28}
                ticks={[0, 30, 50, 70, 100]}
              />
              <Tooltip content={<RsiTooltip />} />

              {/* Overbought zone */}
              <ReferenceLine y={70} stroke="#FF1744" strokeDasharray="3 3" strokeOpacity={0.7} />
              {/* Oversold zone */}
              <ReferenceLine y={30} stroke="#00E676" strokeDasharray="3 3" strokeOpacity={0.7} />
              {/* Midline */}
              <ReferenceLine y={50} stroke="#555" strokeDasharray="2 4" strokeOpacity={0.4} />

              <Area
                type="monotone"
                dataKey="rsi"
                stroke={rsiValue > 70 ? "#FF1744" : rsiValue < 30 ? "#00E676" : "#FFD600"}
                strokeWidth={2}
                fill={rsiValue > 70 ? "#FF174415" : rsiValue < 30 ? "#00E67615" : "#FFD60015"}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
