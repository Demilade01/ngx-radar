import { Suspense } from "react";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { ArrowUpRight, Loader2, Search } from "lucide-react";
import type { Stock, AllSignalItem } from "@/lib/types";

interface StocksPageProps {
  searchParams: Promise<{ q?: string; sector?: string }>;
}

const SECTORS = [
  "Banking", "Telecom", "Consumer Goods", "Oil & Gas",
  "Cement", "Agriculture", "Insurance", "Healthcare",
  "Technology", "Real Estate", "Conglomerate", "Other",
];

async function StocksContent({ q, sector }: { q: string; sector: string }) {
  const [stocksResult, statusResult, signalsResult] = await Promise.allSettled([
    api.getStocks(),
    api.getStatus(),
    api.getAllSignals(),
  ]);

  const allStocks: Stock[] = stocksResult.status === "fulfilled" ? stocksResult.value : [];
  const status = statusResult.status === "fulfilled" ? statusResult.value : null;
  const allSignals: AllSignalItem[] = signalsResult.status === "fulfilled" ? signalsResult.value : [];

  // Build a quick lookup map: ticker → { quantScore, signal }
  const signalMap = new Map<string, AllSignalItem>(allSignals.map((s) => [s.ticker, s]));

  const filtered = allStocks.filter((s) => {
    const matchQ =
      !q ||
      s.ticker.toLowerCase().includes(q.toLowerCase()) ||
      s.name.toLowerCase().includes(q.toLowerCase());
    const matchSector = !sector || s.sector === sector;
    return matchQ && matchSector;
  });

  // Deduplicate sectors from actual data
  const activeSectors = Array.from(new Set(allStocks.map((s) => s.sector))).sort();

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
              {(q || sector) && " (filtered)"}
            </p>
          </div>
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Dashboard
          </Link>
        </div>

        {/* Search + sector filter */}
        <div className="bg-card border border-border rounded-xl p-3 sm:p-4 space-y-3">
          {/* Search input */}
          <form method="GET" action="/stocks" className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search ticker or company name…"
              className="w-full bg-background border border-border rounded-lg pl-8 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            {sector && <input type="hidden" name="sector" value={sector} />}
          </form>

          {/* Sector pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {["", ...activeSectors].map((s) => {
              const isActive = sector === s;
              const params = new URLSearchParams();
              if (q) params.set("q", q);
              if (s) params.set("sector", s);
              return (
                <Link
                  key={s || "all"}
                  href={`/stocks?${params.toString()}`}
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

        {filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm">
            No stocks match your search.
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
                  <span className="text-[11px] text-foreground/80 truncate leading-snug">{s.name}</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">{s.sector}</span>
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
                              return <span className="text-muted-foreground/50 text-xs">—</span>;
                            }
                            const qs = sig.quantScore;
                            const color =
                              qs >= 70 ? "text-[#00E676]" : qs >= 40 ? "text-[#FFD600]" : "text-[#FF1744]";
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

export default async function StocksPage({ searchParams }: StocksPageProps) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const sector = sp.sector ?? "";

  return (
    <div className="flex flex-col min-h-screen">
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 size={18} className="animate-spin" />
            Loading stocks…
          </div>
        }
      >
        <StocksContent q={q} sector={sector} />
      </Suspense>
    </div>
  );
}
