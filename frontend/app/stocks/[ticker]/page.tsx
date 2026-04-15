import { Suspense } from "react";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import StockChart from "@/components/StockChart";
import GrahamScoreCard from "@/components/GrahamScoreCard";
import QuantScoreCard from "@/components/QuantScoreCard";
import NewsTimeline from "@/components/NewsTimeline";
import { ArrowLeft, Building2, Tag } from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: Promise<{ ticker: string }>;
}

async function StockContent({ ticker }: { ticker: string }) {
  const [stockResult, pricesResult, newsResult, statusResult, signalsResult] =
    await Promise.allSettled([
      api.getStock(ticker),
      api.getStockPrices(ticker),
      api.getStockNews(ticker),
      api.getStatus(),
      api.getStockSignals(ticker),
    ]);

  if (stockResult.status === "rejected") notFound();

  const stock = stockResult.value;
  const prices = pricesResult.status === "fulfilled" ? pricesResult.value : [];
  const news = newsResult.status === "fulfilled" ? newsResult.value : [];
  const status = statusResult.status === "fulfilled" ? statusResult.value : null;
  // 404 is expected when signals not computed yet — treat as null
  const signals = signalsResult.status === "fulfilled" ? signalsResult.value : null;

  const latestPrice = prices.length ? parseFloat(prices[0].price) : null;
  const prevPrice = prices.length > 1 ? parseFloat(prices[1].price) : null;
  const priceChange = latestPrice !== null && prevPrice !== null ? latestPrice - prevPrice : null;
  const pricePct =
    priceChange !== null && prevPrice !== null ? (priceChange / prevPrice) * 100 : null;

  const isPositive = priceChange !== null && priceChange >= 0;

  return (
    <>
      <Navbar marketOpen={status?.marketOpen} watTime={status?.watTime} />

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-5">
        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} /> Back
        </Link>

        {/* Header card */}
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
          {/* Top row: ticker + price */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md font-bold">
                  {stock.ticker}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Tag size={10} /> {stock.marketCapTier ?? "—"} cap
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">{stock.name}</h1>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Building2 size={11} /> {stock.sector}
                </span>
              </div>
            </div>

            {/* Price block */}
            {latestPrice !== null && (
              <div className="text-right shrink-0">
                <p className="text-2xl sm:text-3xl font-bold text-foreground font-mono">
                  ₦{latestPrice.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                </p>
                {priceChange !== null && pricePct !== null && (
                  <p className={`text-sm font-semibold ${isPositive ? "text-[#00E676]" : "text-[#FF1744]"}`}>
                    {isPositive ? "+" : ""}
                    {priceChange.toFixed(2)} ({isPositive ? "+" : ""}
                    {pricePct.toFixed(2)}%)
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {prices.length} snapshot{prices.length !== 1 ? "s" : ""}
                </p>
              </div>
            )}
          </div>

          {/* No price state */}
          {latestPrice === null && (
            <p className="text-sm text-muted-foreground mt-3">
              No price data yet — price snapshots are captured every 15 min during market hours.
            </p>
          )}
        </div>

        {/* Chart — now with optional signals for BB + RSI */}
        {prices.length > 0 && (
          <section className="bg-card border border-border rounded-xl p-4 sm:p-5">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Price & Volume
            </h2>
            <StockChart snapshots={prices} ticker={stock.ticker} signals={signals} />
          </section>
        )}

        {/* QuantScoreCard + GrahamScoreCard — two-column on lg */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section className="bg-card border border-border rounded-xl p-4 sm:p-5">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Quant Intelligence Score
            </h2>
            <QuantScoreCard signals={signals} />
          </section>

          <section className="bg-card border border-border rounded-xl p-4 sm:p-5">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Graham Fundamental Score
            </h2>
            <GrahamScoreCard stock={stock} />
          </section>
        </div>

        {/* News timeline — full width below */}
        <section className="bg-card border border-border rounded-xl p-4 sm:p-5">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            News Timeline
          </h2>
          <NewsTimeline items={news} />
        </section>
      </main>
    </>
  );
}

export default async function StockPage({ params }: PageProps) {
  const { ticker } = await params;
  const decodedTicker = decodeURIComponent(ticker);

  return (
    <div className="flex flex-col min-h-screen">
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center text-muted-foreground gap-2">
            <span className="text-sm">Loading {decodedTicker}…</span>
          </div>
        }
      >
        <StockContent ticker={decodedTicker} />
      </Suspense>
    </div>
  );
}
