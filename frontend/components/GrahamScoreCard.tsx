import type { Stock } from "@/lib/types";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Criterion {
  label: string;
  passed: boolean;
  detail?: string;
}

function buildCriteria(stock: Stock): Criterion[] {
  const pe = stock.peRatio ? parseFloat(stock.peRatio) : null;
  const pb = stock.pbRatio ? parseFloat(stock.pbRatio) : null;
  const cr = stock.currentRatio ? parseFloat(stock.currentRatio) : null;

  return [
    {
      label: "P/E ≤ 15",
      passed: pe !== null && pe > 0 && pe <= 15,
      detail: pe !== null ? `P/E: ${pe.toFixed(1)}x` : "No data",
    },
    {
      label: "P/B ≤ 1.5",
      passed: pb !== null && pb > 0 && pb <= 1.5,
      detail: pb !== null ? `P/B: ${pb.toFixed(2)}x` : "No data",
    },
    {
      label: "P/E × P/B ≤ 22.5",
      passed: pe !== null && pb !== null && pe > 0 && pb > 0 && pe * pb <= 22.5,
      detail:
        pe !== null && pb !== null
          ? `Product: ${(pe * pb).toFixed(1)}`
          : "No data",
    },
    {
      label: "Current Ratio ≥ 2",
      passed: cr !== null && cr >= 2,
      detail: cr !== null ? `CR: ${cr.toFixed(2)}` : "No data",
    },
    {
      label: "Positive earnings",
      passed: pe !== null && pe > 0,
      detail: pe !== null ? (pe > 0 ? "Profitable" : "Loss") : "No data",
    },
    {
      label: "Graham score ≥ 5",
      passed: (stock.grahamScore ?? 0) >= 5,
      detail: `Score: ${stock.grahamScore ?? 0}/7`,
    },
    {
      label: "Large cap or mid cap",
      passed: stock.marketCapTier === "large" || stock.marketCapTier === "mid",
      detail: stock.marketCapTier ?? "Unknown",
    },
  ];
}

interface GrahamScoreCardProps {
  stock: Stock;
}

export default function GrahamScoreCard({ stock }: GrahamScoreCardProps) {
  const criteria = buildCriteria(stock);
  const score = stock.grahamScore ?? 0;
  const pct = (score / 7) * 100;

  const scoreColor =
    score >= 5 ? "#00E676" : score >= 3 ? "#FFD600" : "#FF1744";

  return (
    <div>
      {/* Score ring + label */}
      <div className="flex items-center gap-4 mb-5">
        {/* SVG ring */}
        <div className="relative shrink-0">
          <svg width={72} height={72} className="-rotate-90">
            <circle
              cx={36}
              cy={36}
              r={28}
              fill="none"
              stroke="#1E1E2E"
              strokeWidth={6}
            />
            <circle
              cx={36}
              cy={36}
              r={28}
              fill="none"
              stroke={scoreColor}
              strokeWidth={6}
              strokeDasharray={`${(pct / 100) * 175.93} 175.93`}
              strokeLinecap="round"
            />
          </svg>
          <span
            className="absolute inset-0 flex items-center justify-center text-lg font-bold rotate-90"
            style={{ color: scoreColor }}
          >
            {score}/7
          </span>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Graham Fundamental Score
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {score >= 5
              ? "Strong fundamentals — qualifies for HIGH conviction"
              : score >= 3
              ? "Moderate fundamentals"
              : "Weak fundamentals — speculative only"}
          </p>
        </div>
      </div>

      {/* Criteria checklist */}
      <ul className="space-y-2">
        {criteria.map((c) => (
          <li key={c.label} className="flex items-center gap-2.5 text-sm">
            {c.passed ? (
              <CheckCircle2 size={14} className="shrink-0 text-[#00E676]" />
            ) : (
              <XCircle size={14} className="shrink-0 text-muted-foreground/50" />
            )}
            <span
              className={cn(
                "flex-1",
                c.passed ? "text-foreground/80" : "text-muted-foreground"
              )}
            >
              {c.label}
            </span>
            {c.detail && (
              <span
                className={cn(
                  "text-xs",
                  c.passed ? "text-muted-foreground" : "text-muted-foreground/50"
                )}
              >
                {c.detail}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
