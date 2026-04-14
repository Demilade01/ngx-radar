import Link from "next/link";
import type { SectorHeatmapItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const INTENSITY_STYLES: Record<SectorHeatmapItem["intensity"], { bg: string; text: string; border: string }> = {
  HIGH:   { bg: "bg-[#00C853]/20", text: "text-[#00E676]",       border: "border-[#00C853]/40" },
  MEDIUM: { bg: "bg-[#FFD600]/10", text: "text-[#FFD600]",       border: "border-[#FFD600]/30" },
  LOW:    { bg: "bg-[#1565C0]/15", text: "text-[#42A5F5]",       border: "border-[#1565C0]/30" },
  NONE:   { bg: "bg-muted/50",     text: "text-muted-foreground", border: "border-border" },
};

interface SectorHeatmapProps {
  data: SectorHeatmapItem[];
}

export default function SectorHeatmap({ data }: SectorHeatmapProps) {
  if (!data.length) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center">
        No sector data yet
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {data.map((item) => {
        const style = INTENSITY_STYLES[item.intensity];
        const href = `/alerts?sector=${encodeURIComponent(item.sector)}`;

        return (
          <Link
            key={item.sector}
            href={href}
            className={cn(
              "group relative rounded-xl border p-3.5 flex flex-col gap-1 transition-all hover:scale-[1.02]",
              style.bg, style.border
            )}
          >
            <span className={cn("text-sm font-semibold leading-snug", style.text)}>
              {item.sector}
            </span>
            <div className="flex items-end justify-between gap-2 mt-1">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                  Alerts
                </span>
                <span className={cn("text-lg font-bold leading-none", style.text)}>
                  {item.count}
                </span>
              </div>
              {item.maxSpike > 0 && (
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                    Max Z
                  </span>
                  <span className="text-sm font-semibold text-muted-foreground leading-none">
                    {item.maxSpike.toFixed(1)}σ
                  </span>
                </div>
              )}
            </div>
            {/* Intensity bar */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl overflow-hidden">
              <div
                className={cn("h-full transition-all", style.text, "bg-current opacity-50")}
                style={{ width: item.intensity === "HIGH" ? "100%" : item.intensity === "MEDIUM" ? "66%" : item.intensity === "LOW" ? "33%" : "5%" }}
              />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
