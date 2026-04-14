import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface SentimentBadgeProps {
  label: string | null;
  score?: string | null;
  size?: "sm" | "md";
  className?: string;
}

const STYLES: Record<string, { bg: string; text: string; border: string; Icon: React.ElementType }> = {
  positive: { bg: "bg-[#00E676]/10", text: "text-[#00E676]", border: "border-[#00E676]/25", Icon: TrendingUp },
  negative: { bg: "bg-[#FF1744]/10", text: "text-[#FF1744]", border: "border-[#FF1744]/25", Icon: TrendingDown },
  neutral:  { bg: "bg-muted",         text: "text-muted-foreground", border: "border-border", Icon: Minus },
};

export default function SentimentBadge({ label, score, size = "md", className }: SentimentBadgeProps) {
  const key = label?.toLowerCase() ?? "neutral";
  const { bg, text, border, Icon } = STYLES[key] ?? STYLES.neutral;

  const scoreNum = score != null ? parseFloat(score) : null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium rounded-full border",
        bg, text, border,
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        className
      )}
    >
      <Icon size={size === "sm" ? 9 : 11} />
      <span className="capitalize">{label ?? "—"}</span>
      {scoreNum !== null && (
        <span className="opacity-70 ml-0.5">{scoreNum > 0 ? `+${scoreNum.toFixed(1)}` : scoreNum.toFixed(1)}</span>
      )}
    </span>
  );
}
