import { Suspense } from "react";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import ConvictionBadge from "@/components/ConvictionBadge";
import Link from "next/link";
import { ArrowUpRight, Filter, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { AlertFeedItem } from "@/lib/types";

interface AlertsPageProps {
  searchParams: Promise<{
    tier?: string;
    sector?: string;
    page?: string;
  }>;
}

const TIERS = ["HIGH", "MEDIUM", "SPECULATIVE", "DISTRIBUTION"];
const SECTORS = ["Banking", "Telecom", "Consumer Goods", "Oil & Gas", "Cement", "Agriculture"];
const PAGE_SIZE = 25;

function FilterBar({
  tier,
  sector,
}: {
  tier: string;
  sector: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 bg-card border border-border rounded-xl px-4 py-3">
      <Filter size={14} className="text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mr-1">
        Tier
      </span>
      {["", ...TIERS].map((t) => {
        const isActive = tier === t;
        const params = new URLSearchParams();
        if (t) params.set("tier", t);
        if (sector) params.set("sector", sector);
        return (
          <Link
            key={t || "all"}
            href={`/alerts?${params.toString()}`}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
              isActive
                ? "bg-primary/15 text-primary border-primary/30"
                : "text-muted-foreground border-border hover:border-muted-foreground"
            }`}
          >
            {t || "All"}
          </Link>
        );
      })}

      <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mx-1">
        Sector
      </span>
      {["", ...SECTORS].map((s) => {
        const isActive = sector === s;
        const params = new URLSearchParams();
        if (tier) params.set("tier", tier);
        if (s) params.set("sector", s);
        return (
          <Link
            key={s || "all-sector"}
            href={`/alerts?${params.toString()}`}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
              isActive
                ? "bg-secondary/20 text-[#42A5F5] border-secondary/40"
                : "text-muted-foreground border-border hover:border-muted-foreground"
            }`}
          >
            {s || "All"}
          </Link>
        );
      })}
    </div>
  );
}

function AlertRow({ item }: { item: AlertFeedItem }) {
  const date = new Date(item.alert.createdAt);
  const ago = isNaN(date.getTime()) ? "—" : formatDistanceToNow(date, { addSuffix: true });
  const zScore = item.alert.volumeSpikeScore
    ? parseFloat(item.alert.volumeSpikeScore)
    : null;

  return (
    <tr className="border-b border-border hover:bg-accent/30 transition-colors group">
      <td className="py-3 px-4">
        <Link
          href={`/stocks/${encodeURIComponent(item.ticker)}`}
          className="flex items-center gap-1.5 font-mono text-primary font-bold hover:underline text-sm"
        >
          {item.ticker.replace(".LG", "")}
          <ArrowUpRight size={11} className="opacity-0 group-hover:opacity-60 transition-opacity" />
        </Link>
      </td>
      <td className="py-3 px-4">
        <ConvictionBadge tier={item.alert.convictionTier} size="sm" />
      </td>
      <td className="py-3 px-4 text-sm text-muted-foreground">{item.sector}</td>
      <td className="py-3 px-4">
        {zScore !== null ? (
          <span
            className={`text-sm font-semibold ${zScore > 2.5 ? "text-[#FF6D00]" : "text-foreground/70"}`}
          >
            {zScore.toFixed(2)}σ
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="py-3 px-4 max-w-sm">
        <p className="text-sm text-foreground/80 line-clamp-2 leading-snug">
          {item.alert.summary ?? `Volume anomaly detected — ${item.stockName}`}
        </p>
      </td>
      <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">{ago}</td>
    </tr>
  );
}

async function AlertsContent({
  tier,
  sector,
  page,
}: {
  tier: string;
  sector: string;
  page: number;
}) {
  const [alertsResult, statusResult] = await Promise.allSettled([
    api.getAlerts({
      tier: tier || undefined,
      sector: sector || undefined,
      page,
      limit: PAGE_SIZE,
    }),
    api.getStatus(),
  ]);

  const alerts: AlertFeedItem[] =
    alertsResult.status === "fulfilled" ? alertsResult.value : [];
  const status =
    statusResult.status === "fulfilled" ? statusResult.value : null;

  const totalShowing = alerts.length;

  // Pagination links helper
  const buildParams = (p: number) => {
    const q = new URLSearchParams();
    if (tier) q.set("tier", tier);
    if (sector) q.set("sector", sector);
    if (p > 1) q.set("page", String(p));
    return q.toString();
  };

  return (
    <>
      <Navbar marketOpen={status?.marketOpen} watTime={status?.watTime} />

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-foreground">Alerts</h1>
          <span className="text-xs text-muted-foreground">
            {totalShowing} result{totalShowing !== 1 ? "s" : ""}
            {(tier || sector) && " (filtered)"}
          </span>
        </div>

        <FilterBar tier={tier} sector={sector} />

        {alerts.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm">
            No alerts found for the selected filters. The cron job runs hourly.
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="text-left py-3 px-4 font-medium">Ticker</th>
                    <th className="text-left py-3 px-4 font-medium">Conviction</th>
                    <th className="text-left py-3 px-4 font-medium">Sector</th>
                    <th className="text-left py-3 px-4 font-medium">Z-Score</th>
                    <th className="text-left py-3 px-4 font-medium">Summary</th>
                    <th className="text-left py-3 px-4 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((item) => (
                    <AlertRow key={item.alert.id} item={item} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {alerts.length > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Page {page}</span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/alerts?${buildParams(page - 1)}`}
                  className="px-3 py-1.5 bg-card border border-border rounded-lg hover:bg-accent transition-colors text-foreground"
                >
                  ← Prev
                </Link>
              )}
              {totalShowing === PAGE_SIZE && (
                <Link
                  href={`/alerts?${buildParams(page + 1)}`}
                  className="px-3 py-1.5 bg-card border border-border rounded-lg hover:bg-accent transition-colors text-foreground"
                >
                  Next →
                </Link>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}

export default async function AlertsPage({ searchParams }: AlertsPageProps) {
  const sp = await searchParams;
  const tier = sp.tier ?? "";
  const sector = sp.sector ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));

  return (
    <div className="flex flex-col min-h-screen">
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 size={18} className="animate-spin" />
            Loading alerts…
          </div>
        }
      >
        <AlertsContent tier={tier} sector={sector} page={page} />
      </Suspense>
    </div>
  );
}
