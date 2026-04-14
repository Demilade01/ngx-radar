import { Suspense } from "react";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import SectorHeatmap from "@/components/SectorHeatmap";
import AlertFeed from "@/components/AlertFeed";
import DetectNowButton from "@/components/DetectNowButton";
import Link from "next/link";
import {
  Activity,
  BarChart2,
  Bell,
  TrendingUp,
  Loader2,
  ArrowUpRight,
} from "lucide-react";
import type { Stock } from "@/lib/types";

async function DashboardContent() {
  const [status, alerts, heatmap, stocks] = await Promise.allSettled([
    api.getStatus(),
    api.getAlerts({ limit: 20 }),
    api.getSectorHeatmap(),
    api.getStocks(),
  ]);

  const statusData = status.status === "fulfilled" ? status.value : null;
  const alertsData = alerts.status === "fulfilled" ? alerts.value : [];
  const heatmapData = heatmap.status === "fulfilled" ? heatmap.value : [];
  const stocksData = stocks.status === "fulfilled" ? stocks.value : [];

  return (
    <>
      <Navbar marketOpen={statusData?.marketOpen} watTime={statusData?.watTime} />

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Market status bar */}
        <div
          className={`rounded-xl border px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-3 ${
            statusData?.marketOpen
              ? "bg-[#00E676]/5 border-[#00E676]/20"
              : "bg-muted/50 border-border"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              statusData?.marketOpen ? "bg-[#00E676] animate-pulse" : "bg-muted-foreground"
            }`}
          />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-foreground">
              NGX Market{" "}
              <span
                className={statusData?.marketOpen ? "text-[#00E676]" : "text-muted-foreground"}
              >
                {statusData?.marketStatus ?? "—"}
              </span>
            </span>
            {statusData?.watTime && (
              <span className="text-xs text-muted-foreground ml-2">
                {statusData.watTime}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            v{statusData?.version ?? "—"}
          </span>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <StatCard
            label="Stocks Tracked"
            value={statusData?.stocksMonitored !== undefined ? statusData.stocksMonitored : stocksData.length > 0 ? stocksData.length : "—"}
            icon={BarChart2}
            color="text-primary"
          />
          <StatCard
            label="Alerts Today"
            value={statusData?.alertsToday ?? "—"}
            icon={Bell}
            color="text-[#FF6D00]"
          />
          <StatCard
            label="Snapshots Today"
            value={statusData?.priceSnapshotsToday ?? "—"}
            icon={Activity}
            color="text-secondary"
          />
          <StatCard
            label="Feed Items"
            value={alertsData.length}
            icon={TrendingUp}
            color="text-[#FFD600]"
          />
        </div>

        {/* Main 2-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Sector heatmap */}
          <section className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
            <h2 className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider">
              Sector Rotation
            </h2>
            <SectorHeatmap data={heatmapData} />
          </section>

          {/* Alert feed */}
          <section className="lg:col-span-3 bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Alert Feed
              </h2>
              <div className="flex items-center gap-2">
                <DetectNowButton />
                <Link href="/alerts" className="text-xs text-primary hover:underline">
                  View all →
                </Link>
              </div>
            </div>
            <AlertFeed items={alertsData} limit={12} />
          </section>
        </div>

        {/* Stocks watchlist */}
        {stocksData.length > 0 && (
          <section className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Watchlist
              </h2>
              <Link href="/stocks" className="text-xs text-primary hover:underline">
                View all {stocksData.length} →
              </Link>
            </div>
            <StocksList stocks={stocksData} />
          </section>
        )}
      </main>
    </>
  );
}

function StocksList({ stocks }: { stocks: Stock[] }) {
  return (
    <>
      {/* Mobile: card grid */}
      <div className="grid grid-cols-2 sm:hidden gap-px bg-border">
        {stocks.slice(0, 20).map((s) => (
          <Link
            key={s.id}
            href={`/stocks/${encodeURIComponent(s.ticker)}`}
            className="bg-card px-3 py-3 flex flex-col gap-0.5 hover:bg-accent/40 transition-colors"
          >
            <span className="text-xs font-bold font-mono text-primary">
              {s.ticker.replace(".LG", "")}
            </span>
            <span className="text-[11px] text-muted-foreground truncate">{s.name}</span>
            <span className="text-[10px] text-muted-foreground/60 mt-0.5">{s.sector}</span>
          </Link>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
              <th className="text-left py-2.5 px-4 font-medium">Ticker</th>
              <th className="text-left py-2.5 px-4 font-medium">Company</th>
              <th className="text-left py-2.5 px-4 font-medium">Sector</th>
              <th className="text-left py-2.5 px-4 font-medium">Cap Tier</th>
              <th className="py-2.5 px-4" />
            </tr>
          </thead>
          <tbody>
            {stocks.slice(0, 30).map((s) => (
              <tr key={s.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors group">
                <td className="py-2.5 px-4">
                  <Link
                    href={`/stocks/${encodeURIComponent(s.ticker)}`}
                    className="font-mono text-primary font-bold text-xs bg-primary/10 px-2 py-0.5 rounded-md hover:bg-primary/20 transition-colors"
                  >
                    {s.ticker.replace(".LG", "")}
                  </Link>
                </td>
                <td className="py-2.5 px-4 text-foreground/80">{s.name}</td>
                <td className="py-2.5 px-4 text-muted-foreground">{s.sector}</td>
                <td className="py-2.5 px-4 text-muted-foreground capitalize">{s.marketCapTier ?? "—"}</td>
                <td className="py-2.5 px-4 text-right">
                  <Link
                    href={`/stocks/${encodeURIComponent(s.ticker)}`}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors"
                  >
                    <ArrowUpRight size={13} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {stocks.length > 30 && (
          <div className="border-t border-border/50 px-4 py-2.5 text-center">
            <Link
              href="/stocks"
              className="text-xs text-primary hover:underline"
            >
              Showing 30 of {stocks.length} — View all stocks →
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
      <span className={`shrink-0 ${color}`}>
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider truncate">
          {label}
        </p>
        <p className="text-lg sm:text-xl font-bold text-foreground leading-tight">{value}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 size={18} className="animate-spin" />
            Loading dashboard…
          </div>
        }
      >
        <DashboardContent />
      </Suspense>
    </div>
  );
}
