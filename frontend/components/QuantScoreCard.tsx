import type { TechnicalSignals } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";

interface QuantScoreCardProps {
  signals: TechnicalSignals | null;
}

type SignalType = "BUY" | "SELL" | "HOLD";

function SignalBadge({ signal }: { signal: SignalType | null }) {
  if (!signal) return null;
  const cfg = {
    BUY: { bg: "bg-[#00E676]/15", text: "text-[#00E676]", border: "border-[#00E676]/30", icon: TrendingUp },
    SELL: { bg: "bg-[#FF1744]/15", text: "text-[#FF1744]", border: "border-[#FF1744]/30", icon: TrendingDown },
    HOLD: { bg: "bg-[#FFD600]/15", text: "text-[#FFD600]", border: "border-[#FFD600]/30", icon: Minus },
  }[signal];
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border",
        cfg.bg, cfg.text, cfg.border
      )}
    >
      <Icon size={11} />
      {signal}
    </span>
  );
}

function GaugeArc({ score, color }: { score: number; color: string }) {
  // Semi-circle gauge: starts at 180°, sweeps clockwise for `score/100` of 180°
  const r = 44;
  const cx = 56;
  const cy = 56;
  const circumference = Math.PI * r; // half circle
  const filled = (score / 100) * circumference;

  // Convert polar to cartesian for arc
  const startX = cx - r;
  const startY = cy;
  const endX = cx + r;
  const endY = cy;

  return (
    <svg width={112} height={64} viewBox="0 0 112 64">
      {/* Track */}
      <path
        d={`M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`}
        fill="none"
        stroke="#1E1E2E"
        strokeWidth={8}
        strokeLinecap="round"
      />
      {/* Fill */}
      <path
        d={`M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`}
        fill="none"
        stroke={color}
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
      />
    </svg>
  );
}

function FactorBar({
  momentum,
  technical,
  fundamental,
  sentiment,
}: {
  momentum: number;
  technical: number;
  fundamental: number;
  sentiment: number;
}) {
  const total = momentum + technical + fundamental + sentiment || 1;
  const segments = [
    { label: "Momentum", value: momentum, color: "#7C3AED" },
    { label: "Technical", value: technical, color: "#0EA5E9" },
    { label: "Fundamental", value: fundamental, color: "#00E676" },
    { label: "Sentiment", value: sentiment, color: "#FFD600" },
  ];

  return (
    <div className="space-y-2">
      <div className="flex h-2 rounded-full overflow-hidden gap-px">
        {segments.map((s) => (
          <div
            key={s.label}
            style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
            title={`${s.label}: ${s.value} pts`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-[10px] text-muted-foreground">{s.label}</span>
            <span className="text-[10px] font-semibold" style={{ color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function IndicatorPill({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center bg-muted/30 border border-border rounded-lg px-3 py-2 min-w-[72px]">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="text-sm font-bold text-foreground mt-0.5">{value}</span>
      {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

export default function QuantScoreCard({ signals }: QuantScoreCardProps) {
  if (!signals || signals.quantScore === null) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
        <Activity size={28} className="text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">Signals not computed yet</p>
        <p className="text-xs text-muted-foreground/60">
          Need ≥27 price snapshots. Hit{" "}
          <code className="bg-muted px-1 py-0.5 rounded text-[10px]">GET /admin/quant-now</code>{" "}
          to compute manually.
        </p>
      </div>
    );
  }

  const score = signals.quantScore;
  const signal = signals.signal as SignalType | null;

  const scoreColor =
    score >= 70 ? "#00E676" : score >= 40 ? "#FFD600" : "#FF1744";

  // Reconstruct factor breakdown from indicators (approximate back-calculation)
  const rsi = signals.rsi14 ? parseFloat(signals.rsi14) : null;
  const macdH = signals.macdHistogram ? parseFloat(signals.macdHistogram) : null;
  const bbPos = signals.bbPosition ? parseFloat(signals.bbPosition) : null;
  const mom20 = signals.momentum20 ? parseFloat(signals.momentum20) : null;
  const slope = signals.trendSlope ? parseFloat(signals.trendSlope) : null;

  const momentumPts = mom20 === null ? 12 : mom20 > 0.01 ? 25 : mom20 < -0.01 ? 0 : 12;
  let technicalPts = 0;
  if (macdH !== null && macdH > 0) technicalPts += 8;
  if (rsi !== null && rsi >= 40 && rsi <= 60) technicalPts += 9;
  if (bbPos !== null && bbPos >= 0.3 && bbPos <= 0.7) technicalPts += 8;
  // fundamental + sentiment are the remainder
  const computedSubTotal = momentumPts + technicalPts;
  const remaining = Math.max(0, score - computedSubTotal);
  const fundamentalPts = Math.round(remaining * 0.5);
  const sentimentPts = remaining - fundamentalPts;

  // RSI label
  const rsiLabel =
    rsi === null ? "—" : rsi > 70 ? "Overbought" : rsi < 30 ? "Oversold" : "Neutral";

  // BB position label
  const bbLabel =
    bbPos === null ? "—" : bbPos > 0.8 ? "Extended" : bbPos < 0.2 ? "Oversold" : "Normal";

  // MACD direction
  const macdLabel = macdH === null ? "—" : macdH > 0 ? "Bullish ↑" : "Bearish ↓";
  const macdColor = macdH === null ? "" : macdH > 0 ? "text-[#00E676]" : "text-[#FF1744]";

  return (
    <div className="space-y-5">
      {/* Score + badge row */}
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <GaugeArc score={score} color={scoreColor} />
          <div
            className="absolute inset-0 flex items-end justify-center pb-1"
            style={{ color: scoreColor }}
          >
            <span className="text-2xl font-black leading-none">{score}</span>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <SignalBadge signal={signal} />
          </div>
          <p className="text-xs font-semibold text-foreground">QuantScore</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {score >= 70
              ? "Strong buy signal — high conviction"
              : score >= 40
              ? "Neutral — hold or watch"
              : "Weak signal — potential sell"}
          </p>
        </div>
      </div>

      {/* Factor breakdown */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
          Score breakdown
        </p>
        <FactorBar
          momentum={momentumPts}
          technical={technicalPts}
          fundamental={fundamentalPts}
          sentiment={sentimentPts}
        />
      </div>

      {/* Key indicators row */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
          Key indicators
        </p>
        <div className="flex flex-wrap gap-2">
          <IndicatorPill
            label="RSI-14"
            value={rsi !== null ? rsi.toFixed(1) : "—"}
            sub={rsiLabel}
          />
          <IndicatorPill
            label="MACD"
            value={macdLabel}
          />
          <IndicatorPill
            label="BB Pos"
            value={bbPos !== null ? `${(bbPos * 100).toFixed(0)}%` : "—"}
            sub={bbLabel}
          />
          <IndicatorPill
            label="Trend"
            value={slope !== null ? `${slope > 0 ? "+" : ""}${slope.toFixed(2)}` : "—"}
            sub="₦/snap"
          />
        </div>
      </div>

      {/* SMA cross hint */}
      {signals.sma20 && signals.sma50 && (
        <div className="text-[11px] text-muted-foreground border border-border/50 rounded-lg px-3 py-2">
          SMA cross:{" "}
          <span
            className={
              parseFloat(signals.sma20) > parseFloat(signals.sma50)
                ? "text-[#00E676] font-semibold"
                : "text-[#FF1744] font-semibold"
            }
          >
            {parseFloat(signals.sma20) > parseFloat(signals.sma50)
              ? "Golden cross (SMA20 > SMA50)"
              : "Death cross (SMA20 < SMA50)"}
          </span>
        </div>
      )}
    </div>
  );
}
