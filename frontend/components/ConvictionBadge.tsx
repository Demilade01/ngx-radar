import { cn } from "@/lib/utils";

const TIER_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  HIGH:         { bg: "bg-[#00E676]/15", text: "text-[#00E676]", border: "border-[#00E676]/30", label: "HIGH" },
  MEDIUM:       { bg: "bg-[#FFD600]/15", text: "text-[#FFD600]", border: "border-[#FFD600]/30", label: "MEDIUM" },
  SPECULATIVE:  { bg: "bg-[#FF6D00]/15", text: "text-[#FF6D00]", border: "border-[#FF6D00]/30", label: "SPECULATIVE" },
  DISTRIBUTION: { bg: "bg-[#FF1744]/15", text: "text-[#FF1744]", border: "border-[#FF1744]/30", label: "DISTRIBUTION" },
};

interface ConvictionBadgeProps {
  tier: string | null;
  size?: "sm" | "md";
  className?: string;
}

export default function ConvictionBadge({ tier, size = "md", className }: ConvictionBadgeProps) {
  const style = TIER_STYLES[tier ?? ""] ?? {
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
    label: tier ?? "UNKNOWN",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center font-semibold rounded-full border tracking-wide",
        style.bg, style.text, style.border,
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        className
      )}
    >
      {style.label}
    </span>
  );
}
