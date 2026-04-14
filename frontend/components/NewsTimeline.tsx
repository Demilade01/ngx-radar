import type { NewsItemWithSentiment } from "@/lib/types";
import SentimentBadge from "./SentimentBadge";
import { ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface NewsTimelineProps {
  items: NewsItemWithSentiment[];
}

const SOURCE_COLORS: Record<string, string> = {
  nairametrics: "#FFD600",
  businessday: "#1565C0",
  vanguard: "#00C853",
};

export default function NewsTimeline({ items }: NewsTimelineProps) {
  if (!items.length) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No news scraped for this ticker yet.
      </p>
    );
  }

  return (
    <ol className="relative border-l border-border ml-3 space-y-0">
      {items.map((item, i) => {
        const date = new Date(item.scrapedAt);
        const ago = isNaN(date.getTime()) ? "—" : formatDistanceToNow(date, { addSuffix: true });
        const sourceColor = SOURCE_COLORS[item.source?.toLowerCase() ?? ""] ?? "#9E9E9E";

        return (
          <li key={item.id} className="relative pl-6 pb-5 group">
            {/* Timeline dot */}
            <span
              className="absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-background"
              style={{ backgroundColor: sourceColor }}
            />

            {/* Connector line override (last item) */}
            {i === items.length - 1 && (
              <span className="absolute left-[-1px] top-3 bottom-0 w-px bg-background" />
            )}

            <div className="flex items-start gap-2 flex-wrap mb-1">
              <SentimentBadge
                label={item.sentimentLabel}
                score={item.sentimentScore}
                size="sm"
              />
              <span
                className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-sm"
                style={{ color: sourceColor, backgroundColor: `${sourceColor}20` }}
              >
                {item.source ?? "unknown"}
              </span>
              <span className="text-[11px] text-muted-foreground ml-auto">{ago}</span>
            </div>

            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group/link flex items-start gap-1.5 text-sm text-foreground/85 hover:text-foreground transition-colors"
              >
                <span className="leading-snug">{item.headline}</span>
                <ExternalLink
                  size={11}
                  className="shrink-0 mt-0.5 opacity-0 group-hover/link:opacity-60 transition-opacity"
                />
              </a>
            ) : (
              <p className="text-sm text-foreground/85 leading-snug">{item.headline}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
