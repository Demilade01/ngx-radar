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

function FilterBar({ tier, sector }: { tier: string; sector: string }) {
  const tierLinks = ["", ...TIERS].map((t) => {
    const isActive = tier === t;
    const params = new URLSearchParams();
    if (t) params.set("tier", t);
    if (sector) params.set("sector", sector);
    return (
      <Link
        key={t || "all-tier"}
        href={`/alerts?${params.toString()}`}
        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all whitespace-nowrap ${
          isActive
            ? "bg-primary/15 text-primary border-primary/30"
            : "text-muted-foreground border-border hover:border-muted-foreground hover:text-foreground"
        }`}
      >
        {t || "All"}
      </Link>
    );
  });

  const sectorLinks = ["", ...SECTORS].map((s) => {
    const isActive = sector === s;
    const params = new URLSearchParams();
    if (tier) params.set("tier", tier);
    if (s) params.set("sector", s);
    return (
      <Link
        key={s || "all-sector"}
        href={`/alerts?${params.toString()}`}
        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all whitespace-nowrap ${
          isActive
            ? "bg-secondary/20 text-[#42A5F5] border-secondary/40"
            : "text-muted-foreground border-border hover:border-muted-foreground hover:text-foreground"
        }`}
      >
        {s || "All"}
      </Link>
    );
  });

  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3">
      {/* Large screens: single row */}
      <div className="hidden lg:flex items-center gap-2 flex-nowrap overflow-x-auto scrollbar-none">
        <Filter size={13} className="text-muted-foreground shrink-0" />
        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest shrink-0 ml-1">
          Tier
        </span>
        {tierLinks}
        <span className="w-px h-4 bg-border mx-4 shrink-0" />
        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest shrink-0">
          Sector
        </span>
        {sectorLinks}
      </div>

      {/* Mobile / tablet: two rows */}
      <div className="lg:hidden space-y-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter size={13} className="text-muted-foreground shrink-0" />
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest mr-1">
            Tier
          </span>
          {tierLinks}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="w-[13px] shrink-0" />
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest mr-1">
            Sector
          </span>
          {sectorLinks}
        </div>
      </div>
    </div>
  );
}

function AlertCard({ item }: { item: AlertFeedItem }) {
  const date = new Date(item.alert.createdAt);
  const ago = isNaN(date.getTime()) ? "—" : formatDistanceToNow(date, { addSuffix: true });
  const zScore = item.alert.volumeSpikeScore ? parseFloat(item.alert.volumeSpikeScore) : null;

  return (
    <Link
      href={`/stocks/${encodeURIComponent(item.ticker)}`}
      className="block bg-card border border-border rounded-xl p-3.5 hover:bg-accent/40 transition-colors active:scale-[0.99] group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md">
            {item.ticker.replace(".LG", "")}
          </span>
          <ConvictionBadge tier={item.alert.convictionTier} size="sm" />
        </div>
        <ArrowUpRight size={13} className="shrink-0 mt-0.5 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>

      <p className="text-sm text-foreground/80 line-clamp-2 leading-snug mb-2">
        {item.alert.summary ?? `Volume anomaly detected — ${item.stockName}`}
      </p>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span>{item.sector}</span>
        {zScore !== null && (
          <span className={zScore > 2.5 ? "text-[#FF6D00] font-semibold" : ""}>
            {zScore.toFixed(2)}σ
          </span>
        )}
        <span className="ml-auto">{ago}</span>
      </div>
    </Link>
  );
}

function AlertRow({ item }: { item: AlertFeedItem }) {
  const date = new Date(item.alert.createdAt);
  const ago = isNaN(date.getTime()) ? "—" : formatDistanceToNow(date, { addSuffix: true });
  const zScore = item.alert.volumeSpikeScore ? parseFloat(item.alert.volumeSpikeScore) : null;

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
          <span className={`text-sm font-semibold ${zScore > 2.5 ? "text-[#FF6D00]" : "text-foreground/70"}`}>
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

async function AlertsContent({ tier, sector, page }: { tier: string; sector: string; page: number }) {
  const [alertsResult, statusResult] = await Promise.allSettled([
    api.getAlerts({ tier: tier || undefined, sector: sector || undefined, page, limit: PAGE_SIZE }),
    api.getStatus(),
  ]);

  const alerts: AlertFeedItem[] = alertsResult.status === "fulfilled" ? alertsResult.value : [];
  const status = statusResult.status === "fulfilled" ? statusResult.value : null;

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

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-base sm:text-lg font-bold text-foreground">Alerts</h1>
          <span className="text-xs text-muted-foreground">
            {alerts.length} result{alerts.length !== 1 ? "s" : ""}
            {(tier || sector) && " (filtered)"}
          </span>
        </div>

        <FilterBar tier={tier} sector={sector} />

        {alerts.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-10 sm:p-12 text-center">
            <p className="text-muted-foreground text-sm">
              No alerts found for the selected filters.
            </p>
            <p className="text-muted-foreground/60 text-xs mt-1">
              The intelligence cron runs hourly. Hit <strong>Detect Now</strong> on the dashboard to trigger it manually.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="sm:hidden space-y-2">
              {alerts.map((item) => (
                <AlertCard key={item.alert.id} item={item} />
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block bg-card border border-border rounded-xl overflow-hidden">
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
          </>
        )}

        {/* Pagination */}
        {alerts.length > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Page {page}</span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/alerts?${buildParams(page - 1)}`}
                  className="px-3 py-1.5 bg-card border border-border rounded-lg hover:bg-accent transition-colors text-foreground text-xs"
                >
                  ← Prev
                </Link>
              )}
              {alerts.length === PAGE_SIZE && (
                <Link
                  href={`/alerts?${buildParams(page + 1)}`}
                  className="px-3 py-1.5 bg-card border border-border rounded-lg hover:bg-accent transition-colors text-foreground text-xs"
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
