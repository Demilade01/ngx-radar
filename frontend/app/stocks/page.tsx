import { Suspense } from "react";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { ArrowUpRight, Loader2, Search, TrendingUp, Zap } from "lucide-react";
import type { Stock, StockWithPrice, AllSignalItem, OpportunityItem } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────────────────



interface StocksPageProps {
  searchParams: Promise<{
    q?: string;
    sector?: string;
    priceRange?: string;
    tab?: string;
  }>;
}

type PriceRange = "cheap" | "mid" | "premium";

const PRICE_RANGE_LABELS: Record<PriceRange | "all", string> = {
  all: "All",
  cheap: "Under ₦50",
  mid: "₦50–₦500",
  premium: "Above ₦500",
};

const TIER_COLORS: Record<string, string> = {
  HIGH: "text-[#00E676] bg-[#00E676]/10 border-[#00E676]/20",
  MEDIUM: "text-[#FFD600] bg-[#FFD600]/10 border-[#FFD600]/20",
  SPECULATIVE: "text-[#FF6D00] bg-[#FF6D00]/10 border-[#FF6D00]/20",
  DISTRIBUTION: "text-[#FF1744] bg-[#FF1744]/10 border-[#FF1744]/20",
};

// ─────────────────────────────────────────────────────────────────────────────
//  Stocks tab
// ─────────────────────────────────────────────────────────────────────────────

async function StocksContent({
  q,
  sector,
  priceRange,
}: {
  q: string;
  sector: string;
  priceRange: string;
}) {
  const isPriceFiltered = priceRange && priceRange !== "all";

  const [stocksResult, statusResult, signalsResult] = await Promise.allSettled([
    isPriceFiltered
      ? api.getStocksFiltered({ priceRange: priceRange as PriceRange })
      : api.getStocks(),
    api.getStatus(),
    api.getAllSignals(),
  ]);

  const allStocks: (Stock | StockWithPrice)[] =
    stocksResult.status === "fulfilled" ? stocksResult.value : [];
  const status = statusResult.status === "fulfilled" ? statusResult.value : null;
  const allSignals: AllSignalItem[] =
    signalsResult.status === "fulfilled" ? signalsResult.value : [];

  const signalMap = new Map<string, AllSignalItem>(
    allSignals.map((s) => [s.ticker, s])
  );

  const filtered = allStocks.filter((s) => {
    const matchQ =
      !q ||
      s.ticker.toLowerCase().includes(q.toLowerCase()) ||
      s.name.toLowerCase().includes(q.toLowerCase());
    const matchSector = !sector || s.sector === sector;
    return matchQ && matchSector;
  });

  const activeSectors = Array.from(
    new Set(allStocks.map((s) => s.sector))
  ).sort();

  const hasPriceData = isPriceFiltered;

  // Helper: build a URL preserving all existing params except the changed one
  function buildUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (sector) p.set("sector", sector);
    if (priceRange) p.set("priceRange", priceRange);
    p.set("tab", "stocks");
    for (const [k, v] of Object.entries(overrides)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    return `/stocks?${p.toString()}`;
  }

  return (
    <>
      <Navbar marketOpen={status?.marketOpen} watTime={status?.watTime} />

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-lg font-bold text-foreground">Stocks</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {filtered.length} of {allStocks.length} stocks
              {(q || sector || isPriceFiltered) && " (filtered)"}
            </p>
          </div>
          <Link
            href="/"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Dashboard
          </Link>
        </div>

        {/* Filters card */}
        <div className="bg-card border border-border rounded-xl p-3 sm:p-4 space-y-3">
          {/* Search */}
          <form method="GET" action="/stocks" className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search ticker or company name…"
              className="w-full bg-background border border-border rounded-lg pl-8 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            <input type="hidden" name="tab" value="stocks" />
            {sector && <input type="hidden" name="sector" value={sector} />}
            {priceRange && (
              <input type="hidden" name="priceRange" value={priceRange} />
            )}
          </form>

          {/* Price range pills */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 font-medium">
              Price range
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(["all", "cheap", "mid", "premium"] as const).map((r) => {
                const isActive =
                  r === "all" ? !priceRange || priceRange === "all" : priceRange === r;
                return (
                  <Link
                    key={r}
                    href={buildUrl({ priceRange: r === "all" ? "" : r })}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all whitespace-nowrap ${
                      isActive
                        ? "bg-primary/15 text-primary border-primary/30"
                        : "text-muted-foreground border-border hover:border-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {PRICE_RANGE_LABELS[r]}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Sector pills */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 font-medium">
              Sector
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {["", ...activeSectors].map((s) => {
                const isActive = sector === s;
                return (
                  <Link
                    key={s || "all"}
                    href={buildUrl({ sector: s })}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all whitespace-nowrap ${
                      isActive
                        ? "bg-primary/15 text-primary border-primary/30"
                        : "text-muted-foreground border-border hover:border-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s || "All sectors"}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm">
            No stocks match your filters.
          </div>
        ) : (
          <>
            {/* Mobile: card grid */}
            <div className="grid grid-cols-2 sm:hidden gap-px bg-border rounded-xl overflow-hidden">
              {filtered.map((s) => (
                <Link
                  key={s.id}
                  href={`/stocks/${encodeURIComponent(s.ticker)}`}
                  className="bg-card px-3 py-3 flex flex-col gap-0.5 hover:bg-accent/40 active:scale-[0.99] transition-all"
                >
                  <span className="text-xs font-bold font-mono text-primary">
                    {s.ticker.replace(".LG", "")}
                  </span>
                  <span className="text-[11px] text-foreground/80 truncate leading-snug">
                    {s.name}
                  </span>
                  {"currentPrice" in s && s.currentPrice !== null && (
                    <span className="text-[11px] text-[#00C853] font-semibold mt-0.5">
                      ₦{s.currentPrice.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {s.sector}
                  </span>
                </Link>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block bg-card border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                      <th className="text-left py-3 px-4 font-medium w-28">Ticker</th>
                      <th className="text-left py-3 px-4 font-medium">Company</th>
                      <th className="text-left py-3 px-4 font-medium">Sector</th>
                      {hasPriceData && (
                        <th className="text-left py-3 px-4 font-medium">Price</th>
                      )}
                      <th className="text-left py-3 px-4 font-medium">Cap Tier</th>
                      <th className="text-left py-3 px-4 font-medium">Graham</th>
                      <th className="text-left py-3 px-4 font-medium">Quant</th>
                      <th className="py-3 px-4 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b border-border/50 hover:bg-accent/30 transition-colors group"
                      >
                        <td className="py-2.5 px-4">
                          <Link
                            href={`/stocks/${encodeURIComponent(s.ticker)}`}
                            className="font-mono text-primary font-bold text-xs bg-primary/10 px-2 py-0.5 rounded-md hover:bg-primary/20 transition-colors"
                          >
                            {s.ticker.replace(".LG", "")}
                          </Link>
                        </td>
                        <td className="py-2.5 px-4 text-foreground/80 max-w-xs truncate">
                          {s.name}
                        </td>
                        <td className="py-2.5 px-4 text-muted-foreground">{s.sector}</td>
                        {hasPriceData && (
                          <td className="py-2.5 px-4">
                            {"currentPrice" in s && s.currentPrice !== null ? (
                              <span className="text-xs font-semibold text-[#00C853]">
                                ₦
                                {s.currentPrice.toLocaleString("en-NG", {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/50 text-xs">—</span>
                            )}
                          </td>
                        )}
                        <td className="py-2.5 px-4 text-muted-foreground capitalize">
                          {s.marketCapTier ?? "—"}
                        </td>
                        <td className="py-2.5 px-4">
                          {s.grahamScore !== null ? (
                            <span
                              className={`text-xs font-semibold ${
                                s.grahamScore >= 5
                                  ? "text-[#00E676]"
                                  : s.grahamScore >= 3
                                  ? "text-[#FFD600]"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {s.grahamScore}/7
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50 text-xs">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4">
                          {(() => {
                            const sig = signalMap.get(s.ticker);
                            if (!sig || sig.quantScore === null) {
                              return (
                                <span className="text-muted-foreground/50 text-xs">—</span>
                              );
                            }
                            const qs = sig.quantScore;
                            const color =
                              qs >= 70
                                ? "text-[#00E676]"
                                : qs >= 40
                                ? "text-[#FFD600]"
                                : "text-[#FF1744]";
                            return (
                              <span className={`text-xs font-bold ${color}`}>{qs}</span>
                            );
                          })()}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <Link
                            href={`/stocks/${encodeURIComponent(s.ticker)}`}
                            className="inline-flex items-center text-muted-foreground group-hover:text-primary transition-colors"
                          >
                            <ArrowUpRight size={14} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2.5 border-t border-border/50 text-xs text-muted-foreground">
                {filtered.length} stock{filtered.length !== 1 ? "s" : ""}
                {allStocks.length !== filtered.length && ` of ${allStocks.length}`}
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Opportunities tab
// ─────────────────────────────────────────────────────────────────────────────

async function OpportunitiesContent({ watTime, marketOpen }: { watTime?: string; marketOpen?: boolean }) {
  let opportunities: OpportunityItem[] = [];
  try {
    opportunities = await api.getOpportunities();
  } catch {
    opportunities = [];
  }

  return (
    <>
      <Navbar marketOpen={marketOpen} watTime={watTime} />

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-[#FFD600]" />
              <h1 className="text-lg font-bold text-foreground">Opportunities</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 ml-6">
              Low-price stocks with unusual volume &amp; positive/neutral sentiment
            </p>
          </div>
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Dashboard
          </Link>
        </div>

        {/* Criteria badge strip */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Price", value: "< ₦100" },
            { label: "Vol Spike", value: "> 2.0 z-score" },
            { label: "Sentiment", value: "Positive / Neutral" },
          ].map((c) => (
            <div
              key={c.label}
              className="flex items-center gap-1.5 bg-card border border-border rounded-full px-3 py-1"
            >
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                {c.label}
              </span>
              <span className="text-[11px] text-foreground font-semibold">{c.value}</span>
            </div>
          ))}
          {opportunities.length > 0 && (
            <div className="flex items-center gap-1.5 bg-[#00E676]/10 border border-[#00E676]/20 rounded-full px-3 py-1">
              <span className="text-[11px] text-[#00E676] font-semibold">
                {opportunities.length} stock{opportunities.length !== 1 ? "s" : ""} qualify
              </span>
            </div>
          )}
        </div>

        {opportunities.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-16 text-center space-y-2">
            <TrendingUp size={32} className="mx-auto text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No opportunities right now</p>
            <p className="text-xs text-muted-foreground/60 max-w-xs mx-auto">
              Stocks priced under ₦100 with high volume spikes and positive/neutral
              sentiment will appear here when detected.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {opportunities.map((opp) => {
              const tierColor = TIER_COLORS[opp.convictionTier] ?? "text-muted-foreground bg-muted/10 border-muted/20";
              const spikeWidth = Math.min(100, (opp.volumeSpikeScore / 6) * 100); // cap bar at z=6
              const highLabel = opp.has52wHistory ? "52w High" : "Since tracking";

              return (
                <Link
                  key={opp.ticker}
                  href={`/stocks/${encodeURIComponent(opp.ticker)}`}
                  className="group bg-card border border-border rounded-xl p-4 hover:border-primary/30 hover:bg-accent/20 transition-all"
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-primary font-bold text-sm bg-primary/10 px-2 py-0.5 rounded-md">
                          {opp.ticker.replace(".LG", "")}
                        </span>
                        <span
                          className={`text-[10px] font-bold border rounded-full px-2 py-0.5 ${tierColor}`}
                        >
                          {opp.convictionTier}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">{opp.name}</p>
                      <p className="text-[10px] text-muted-foreground/60">{opp.sector}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold text-[#00C853]">
                        ₦{opp.currentPrice.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[10px] text-muted-foreground">current price</p>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                        Graham
                      </p>
                      <p
                        className={`text-xs font-semibold ${
                          opp.grahamScore !== null && opp.grahamScore >= 5
                            ? "text-[#00E676]"
                            : opp.grahamScore !== null && opp.grahamScore >= 3
                            ? "text-[#FFD600]"
                            : "text-muted-foreground"
                        }`}
                      >
                        {opp.grahamScore !== null ? `${opp.grahamScore}/7` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                        {highLabel}
                      </p>
                      <p className="text-xs font-semibold text-foreground/80">
                        {opp.distanceFrom52wHigh !== null
                          ? opp.distanceFrom52wHigh === 0
                            ? "At peak"
                            : `-${opp.distanceFrom52wHigh.toFixed(1)}%`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                        Sentiment
                      </p>
                      <p
                        className={`text-xs font-semibold capitalize ${
                          opp.sentimentLabel === "positive"
                            ? "text-[#00E676]"
                            : "text-muted-foreground"
                        }`}
                      >
                        {opp.sentimentLabel}
                      </p>
                    </div>
                  </div>

                  {/* Volume spike bar */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        Vol Spike
                      </p>
                      <p className="text-[11px] font-bold text-[#FFD600]">
                        {opp.volumeSpikeScore.toFixed(1)}x
                      </p>
                    </div>
                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#FFD600] to-[#FF6D00] rounded-full transition-all"
                        style={{ width: `${spikeWidth}%` }}
                      />
                    </div>
                  </div>

                  {/* Arrow hint */}
                  <div className="flex justify-end mt-3">
                    <ArrowUpRight
                      size={14}
                      className="text-muted-foreground group-hover:text-primary transition-colors"
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Tab nav component (stateless links)
// ─────────────────────────────────────────────────────────────────────────────

function TabNav({
  activeTab,
  q,
  sector,
  priceRange,
}: {
  activeTab: string;
  q: string;
  sector: string;
  priceRange: string;
}) {
  function tabUrl(tab: string) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (sector) p.set("sector", sector);
    if (priceRange) p.set("priceRange", priceRange);
    p.set("tab", tab);
    return `/stocks?${p.toString()}`;
  }

  return (
    <div className="flex items-center gap-1 border-b border-border px-3 sm:px-4 bg-card">
      {[
        { id: "stocks", label: "Stocks", icon: <TrendingUp size={13} /> },
        { id: "opportunities", label: "Opportunities", icon: <Zap size={13} /> },
      ].map((t) => (
        <Link
          key={t.id}
          href={tabUrl(t.id)}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap -mb-px ${
            activeTab === t.id
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.icon}
          {t.label}
        </Link>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function StocksPage({ searchParams }: StocksPageProps) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const sector = sp.sector ?? "";
  const priceRange = sp.priceRange ?? "";
  const tab = sp.tab ?? "stocks";

  // Fetch status independently so Navbar is available on both tabs
  let navStatus: { marketOpen?: boolean; watTime?: string } = {};
  try {
    const s = await api.getStatus();
    navStatus = { marketOpen: s.marketOpen, watTime: s.watTime };
  } catch { /* ignore */ }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Tab nav is outside Suspense so it renders immediately */}
      <TabNav activeTab={tab} q={q} sector={sector} priceRange={priceRange} />

      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 size={18} className="animate-spin" />
            Loading…
          </div>
        }
      >
        {tab === "opportunities" ? (
          <OpportunitiesContent
            marketOpen={navStatus.marketOpen}
            watTime={navStatus.watTime}
          />
        ) : (
          <StocksContent q={q} sector={sector} priceRange={priceRange} />
        )}
      </Suspense>
    </div>
  );
}
