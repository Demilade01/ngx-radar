import { Suspense } from "react";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import SectorHeatmap from "@/components/SectorHeatmap";
import AlertFeed from "@/components/AlertFeed";
import {
  Activity,
  BarChart2,
  Bell,
  TrendingUp,
  Loader2,
} from "lucide-react";

async function DashboardContent() {
  const [status, alerts, heatmap] = await Promise.allSettled([
    api.getStatus(),
    api.getAlerts({ limit: 20 }),
    api.getSectorHeatmap(),
  ]);

  const statusData = status.status === "fulfilled" ? status.value : null;
  const alertsData = alerts.status === "fulfilled" ? alerts.value : [];
  const heatmapData = heatmap.status === "fulfilled" ? heatmap.value : [];

  return (
    <>
      {/* Inject navbar with live market status */}
      <Navbar
        marketOpen={statusData?.marketOpen}
        watTime={statusData?.watTime}
      />

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Market status bar */}
        <div
          className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
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
          <div className="flex-1">
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
                Lagos time: {statusData.watTime}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            v{statusData?.version ?? "—"}
          </span>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Stocks Monitored"
            value={statusData?.stocksMonitored ?? "—"}
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
            label="Price Snapshots"
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

        {/* 2-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Sector heatmap — 2 cols */}
          <section className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">
              Sector Heatmap
            </h2>
            <SectorHeatmap data={heatmapData} />
          </section>

          {/* Alert feed — 3 cols */}
          <section className="lg:col-span-3 bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Alert Feed
              </h2>
              <a
                href="/alerts"
                className="text-xs text-primary hover:underline"
              >
                View all →
              </a>
            </div>
            <AlertFeed items={alertsData} limit={12} />
          </section>
        </div>
      </main>
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
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
      <span className={`shrink-0 ${color}`}>
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground uppercase tracking-wider truncate">
          {label}
        </p>
        <p className="text-xl font-bold text-foreground leading-tight">{value}</p>
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
