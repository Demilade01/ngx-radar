import Link from "next/link";
import type { AlertFeedItem } from "@/lib/types";
import ConvictionBadge from "./ConvictionBadge";
import { formatDistanceToNow } from "date-fns";
import { ArrowUpRight, TrendingUp } from "lucide-react";

interface AlertFeedProps {
  items: AlertFeedItem[];
  limit?: number;
}

export default function AlertFeed({ items, limit = 10 }: AlertFeedProps) {
  const visible = items.slice(0, limit);

  if (!visible.length) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        <TrendingUp className="mx-auto mb-2 opacity-40" size={24} />
        No alerts yet. Data pipeline will populate this once cron jobs run.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {visible.map((item) => {
        const date = new Date(item.alert.createdAt);
        const ago = isNaN(date.getTime())
          ? "—"
          : formatDistanceToNow(date, { addSuffix: true });

        const zScore = item.alert.volumeSpikeScore
          ? parseFloat(item.alert.volumeSpikeScore)
          : null;

        return (
          <Link
            key={item.alert.id}
            href={`/stocks/${encodeURIComponent(item.ticker)}`}
            className="flex items-start gap-3 py-3 px-1 hover:bg-accent/30 rounded-lg transition-colors -mx-1 group"
          >
            {/* Left: ticker badge */}
            <div className="shrink-0 w-16 text-center mt-0.5">
              <span className="block text-[11px] font-bold text-primary bg-primary/10 rounded-md px-1.5 py-1 leading-tight font-mono">
                {item.ticker.replace(".LG", "")}
              </span>
            </div>

            {/* Middle: content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <ConvictionBadge tier={item.alert.convictionTier} size="sm" />
                <span className="text-[11px] text-muted-foreground">{item.sector}</span>
                {zScore !== null && (
                  <span className="text-[11px] text-[#FF6D00] font-semibold">
                    {zScore.toFixed(1)}σ
                  </span>
                )}
              </div>
              {item.alert.summary ? (
                <p className="text-sm text-foreground/80 line-clamp-2 leading-snug">
                  {item.alert.summary}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Volume anomaly detected — {item.stockName}
                </p>
              )}
              <span className="text-[11px] text-muted-foreground mt-1 block">{ago}</span>
            </div>

            {/* Right: arrow */}
            <ArrowUpRight
              size={14}
              className="shrink-0 mt-1 text-muted-foreground group-hover:text-primary transition-colors"
            />
          </Link>
        );
      })}
    </div>
  );
}
