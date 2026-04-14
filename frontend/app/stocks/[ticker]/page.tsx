import { Suspense } from "react";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import StockChart from "@/components/StockChart";
import GrahamScoreCard from "@/components/GrahamScoreCard";
import NewsTimeline from "@/components/NewsTimeline";
import { ArrowLeft, Building2, Tag, Layers } from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: Promise<{ ticker: string }>;
}

async function StockContent({ ticker }: { ticker: string }) {
  const [stockResult, pricesResult, newsResult, statusResult] = await Promise.allSettled([
    api.getStock(ticker),
    api.getStockPrices(ticker),
    api.getStockNews(ticker),
    api.getStatus(),
  ]);

  if (stockResult.status === "rejected") notFound();

  const stock = stockResult.value;
  const prices = pricesResult.status === "fulfilled" ? pricesResult.value : [];
  const news = newsResult.status === "fulfilled" ? newsResult.value : [];
  const status = statusResult.status === "fulfilled" ? statusResult.value : null;

  // Latest price
  const latestPrice = prices.length ? parseFloat(prices[0].price) : null;
  const prevPrice = prices.length > 1 ? parseFloat(prices[1].price) : null;
  const priceChange =
    latestPrice !== null && prevPrice !== null ? latestPrice - prevPrice : null;
  const pricePct =
    priceChange !== null && prevPrice !== null
      ? (priceChange / prevPrice) * 100
      : null;

  return (
    <>
      <Navbar marketOpen={status?.marketOpen} watTime={status?.watTime} />

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-6 space-y-5">
        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>

        {/* Header */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md font-bold">
                  {stock.ticker}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Tag size={10} /> {stock.marketCapTier ?? "—"} cap
                </span>
              </div>
              <h1 className="text-2xl font-bold text-foreground">{stock.name}</h1>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Building2 size={11} /> {stock.sector}
                </span>
              </div>
            </div>

            {/* Price */}
            {latestPrice !== null && (
              <div className="text-right">
                <p className="text-3xl font-bold text-foreground font-mono">
                  ₦{latestPrice.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                </p>
                {priceChange !== null && pricePct !== null && (
                  <p
                    className={`text-sm font-semibold ${
                      priceChange >= 0 ? "text-[#00E676]" : "text-[#FF1744]"
                    }`}
                  >
                    {priceChange >= 0 ? "+" : ""}
                    {priceChange.toFixed(2)} ({pricePct >= 0 ? "+" : ""}
                    {pricePct.toFixed(2)}%)
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Price chart */}
        <section className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
            Price & Volume Chart
          </h2>
          <StockChart snapshots={prices} ticker={stock.ticker} />
        </section>

        {/* Graham + News side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <section className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-5">
              Graham Score
            </h2>
            <GrahamScoreCard stock={stock} />
          </section>

          <section className="lg:col-span-3 bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-5">
              News Timeline
            </h2>
            <NewsTimeline items={news} />
          </section>
        </div>
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
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Loading {decodedTicker}…
          </div>
        }
      >
        <StockContent ticker={decodedTicker} />
      </Suspense>
    </div>
  );
}
