import { Inject, Injectable, Logger } from '@nestjs/common';
import { desc, eq, sql } from 'drizzle-orm';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { DB } from '../database/database.module';
import * as schema from '../database/schema';
import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────
//  Interfaces
// ─────────────────────────────────────────────

export interface PriceFilters {
  minPrice?: number;
  maxPrice?: number;
  priceRange?: 'cheap' | 'mid' | 'premium';
}

export type StockWithPrice = typeof schema.stocks.$inferSelect & {
  currentPrice: number | null;
};

export interface OpportunityItem {
  ticker: string;
  name: string;
  sector: string;
  currentPrice: number;
  volumeSpikeScore: number;
  sentimentLabel: string;
  grahamScore: number | null;
  distanceFrom52wHigh: number | null;
  has52wHistory: boolean;
  convictionTier: string;
}

// Active status markers to INCLUDE (still tradeable)
const INCLUDE_MARKERS = ['', '[MRF]', '[BMF]'];

function parseCsv(): Array<{ ticker: string }> {
  const csvPath = path.join(process.cwd(), 'nigerian_companies.csv');
  if (!fs.existsSync(csvPath)) return [];

  const lines = fs.readFileSync(csvPath, 'utf-8').split('\n').slice(1); // skip header
  const results: Array<{ ticker: string }> = [];

  for (const line of lines) {
    const raw = line.trim();
    if (!raw) continue;

    const markerMatch = raw.match(/\[([A-Z]+)\]$/);
    const marker = markerMatch ? `[${markerMatch[1]}]` : '';

    if (!INCLUDE_MARKERS.includes(marker)) continue;

    const ticker = raw.replace(/\s*\[[A-Z]+\]$/, '').trim();
    if (ticker) results.push({ ticker: `${ticker}.LG` });
  }

  return results;
}

// Static sector map for well-known NGX tickers
const SECTOR_MAP: Record<string, string> = {
  // Banking
  'ACCESSCORP.LG': 'Banking', 'FCMB.LG': 'Banking', 'FIDELITYBK.LG': 'Banking',
  'FIRSTHOLDCO.LG': 'Banking', 'GTCO.LG': 'Banking', 'JAIZBANK.LG': 'Banking',
  'STANBIC.LG': 'Banking', 'STERLINGNG.LG': 'Banking', 'UBA.LG': 'Banking',
  'UNITYBNK.LG': 'Banking', 'WEMABANK.LG': 'Banking', 'ZENITHBANK.LG': 'Banking',
  'FBNH.LG': 'Banking', 'LIVINGTRUST.LG': 'Banking', 'VFDGROUP.LG': 'Banking',
  // Telecom
  'MTNN.LG': 'Telecom', 'AIRTELAFRI.LG': 'Telecom', 'CWG.LG': 'Telecom',
  'ETRANZACT.LG': 'Telecom', 'CHAMS.LG': 'Telecom', 'NSLTECH.LG': 'Telecom',
  // Consumer Goods
  'BUAFOODS.LG': 'Consumer Goods', 'CADBURY.LG': 'Consumer Goods', 'DANGSUGAR.LG': 'Consumer Goods',
  'FLOURMILL.LG': 'Consumer Goods', 'GUINNESS.LG': 'Consumer Goods', 'NB.LG': 'Consumer Goods',
  'NASCON.LG': 'Consumer Goods', 'NESTLE.LG': 'Consumer Goods', 'PZ.LG': 'Consumer Goods',
  'UACN.LG': 'Consumer Goods', 'UNILEVER.LG': 'Consumer Goods', 'VITAFOAM.LG': 'Consumer Goods',
  'NNFM.LG': 'Consumer Goods',
  // Oil & Gas
  'ARADEL.LG': 'Oil & Gas', 'CONOIL.LG': 'Oil & Gas', 'ETERNA.LG': 'Oil & Gas',
  'MRS.LG': 'Oil & Gas', 'OANDO.LG': 'Oil & Gas', 'SEPLAT.LG': 'Oil & Gas',
  'TOTAL.LG': 'Oil & Gas', 'TRANSCORP.LG': 'Oil & Gas', 'GEREGU.LG': 'Oil & Gas',
  // Cement
  'BUACEMENT.LG': 'Cement', 'DANGCEM.LG': 'Cement', 'WAPCO.LG': 'Cement',
  // Agriculture
  'OKOMUOIL.LG': 'Agriculture', 'PRESCO.LG': 'Agriculture', 'LIVESTOCK.LG': 'Agriculture',
  'ELLAHLAKES.LG': 'Agriculture', 'FTNCOCOA.LG': 'Agriculture',
  // Insurance
  'AIICO.LG': 'Insurance', 'CORNERST.LG': 'Insurance', 'CUSTODIAN.LG': 'Insurance',
  'GUINEAINS.LG': 'Insurance', 'LASACO.LG': 'Insurance', 'LINKASSURE.LG': 'Insurance',
  'MANSARD.LG': 'Insurance', 'NEM.LG': 'Insurance', 'REGALINS.LG': 'Insurance',
  'SOVRENINS.LG': 'Insurance', 'SUNUASSUR.LG': 'Insurance', 'UNIVINSURE.LG': 'Insurance',
  'WAPIC.LG': 'Insurance', 'VERITASKAP.LG': 'Insurance',
  // Healthcare
  'FIDSON.LG': 'Healthcare', 'MAYBAKER.LG': 'Healthcare', 'MORISON.LG': 'Healthcare',
  'NEIMETH.LG': 'Healthcare',
  // Industrial
  'BETAGLAS.LG': 'Industrial', 'BERGER.LG': 'Industrial', 'CAP.LG': 'Industrial',
  'CUTIX.LG': 'Industrial', 'ENAMELWA.LG': 'Industrial', 'JBERGER.LG': 'Industrial',
  'MEYER.LG': 'Industrial', 'TRANSPOWER.LG': 'Industrial',
  // Other
  'ABBEYBDS.LG': 'Other', 'AFRIPRUD.LG': 'Other', 'CAVERTON.LG': 'Other',
  'IKEJAHOTEL.LG': 'Other', 'NAHCO.LG': 'Other', 'NGXGROUP.LG': 'Other',
  'REDSTAREX.LG': 'Other', 'SKYAVN.LG': 'Other', 'TRANSCOHOT.LG': 'Other',
  'UCAP.LG': 'Other',
};

@Injectable()
export class StocksService {
  private readonly logger = new Logger(StocksService.name);

  constructor(
    @Inject(DB) private readonly db: NeonHttpDatabase<typeof schema>,
  ) {}

  async seedStocks(): Promise<void> {
    const csvTickers = parseCsv();
    const toSeed = csvTickers.length > 0 ? csvTickers : this.fallbackStocks();

    const values = toSeed.map((t) => ({
      ticker: t.ticker,
      name: t.ticker.replace('.LG', ''),
      sector: SECTOR_MAP[t.ticker] ?? 'Other',
      marketCapTier: 'mid' as const,
    }));

    await this.db.insert(schema.stocks).values(values).onConflictDoNothing();
    this.logger.log(`[SEED] ${values.length} NGX stocks seeded (skipped duplicates)`);
  }

  private fallbackStocks() {
    return [
      { ticker: 'DANGCEM.LG' }, { ticker: 'GTCO.LG' }, { ticker: 'ZENITHBANK.LG' },
      { ticker: 'MTNN.LG' }, { ticker: 'AIRTELAFRI.LG' }, { ticker: 'BUAFOODS.LG' },
      { ticker: 'SEPLAT.LG' }, { ticker: 'ACCESSCORP.LG' }, { ticker: 'UBA.LG' },
      { ticker: 'FBNH.LG' }, { ticker: 'NESTLE.LG' }, { ticker: 'FLOURMILL.LG' },
      { ticker: 'TRANSCORP.LG' }, { ticker: 'OKOMUOIL.LG' }, { ticker: 'PRESCO.LG' },
      { ticker: 'BUACEMENT.LG' }, { ticker: 'STANBIC.LG' }, { ticker: 'FIDELITYBK.LG' },
      { ticker: 'WAPCO.LG' }, { ticker: 'TOTAL.LG' },
    ];
  }

  async findAll() {
    return this.db.select().from(schema.stocks);
  }

  async findByTicker(ticker: string) {
    const [stock] = await this.db
      .select()
      .from(schema.stocks)
      .where(eq(schema.stocks.ticker, ticker.toUpperCase()))
      .limit(1);
    return stock ?? null;
  }

  async getPriceSnapshots(ticker: string, limit = 30) {
    const stock = await this.findByTicker(ticker);
    if (!stock) return [];

    return this.db
      .select()
      .from(schema.priceSnapshots)
      .where(eq(schema.priceSnapshots.stockId, stock.id))
      .orderBy(desc(schema.priceSnapshots.timestamp))
      .limit(limit);
  }

  async getNewsWithSentiment(ticker: string, limit = 20) {
    const rows = await this.db
      .select({
        id: schema.newsItems.id,
        headline: schema.newsItems.headline,
        source: schema.newsItems.source,
        url: schema.newsItems.url,
        scrapedAt: schema.newsItems.scrapedAt,
        sentimentScore: schema.sentimentScores.score,
        sentimentLabel: schema.sentimentScores.label,
        sentimentConfidence: schema.sentimentScores.confidence,
      })
      .from(schema.newsItems)
      .leftJoin(
        schema.sentimentScores,
        eq(schema.sentimentScores.newsItemId, schema.newsItems.id),
      )
      .where(eq(schema.newsItems.tickerMentioned, ticker.toUpperCase()))
      .orderBy(desc(schema.newsItems.scrapedAt))
      .limit(limit);

    return rows;
  }

  // ─────────────────────────────────────────────
  //  Price-enriched queries
  // ─────────────────────────────────────────────

  /**
   * Fetch the most recent price for every stock in one query.
   * Uses DISTINCT ON (stock_id) ordered by timestamp DESC.
   * Returns Map<stockId → price in NGN>.
   */
  async getLatestPriceMap(): Promise<Map<number, number>> {
    const result = await this.db.execute(
      sql`
        SELECT DISTINCT ON (stock_id)
          stock_id,
          price
        FROM price_snapshots
        ORDER BY stock_id, timestamp DESC
      `,
    );

    type LatestPriceRow = { stock_id: string; price: string };
    const map = new Map<number, number>();
    for (const row of result.rows as unknown as LatestPriceRow[]) {
      map.set(Number(row.stock_id), parseFloat(row.price));
    }
    return map;
  }

  /**
   * Returns all stocks enriched with their current price.
   * Applies optional price filters (minPrice / maxPrice / priceRange).
   * priceRange takes precedence over explicit min/max.
   */
  async findAllWithPrices(filters: PriceFilters = {}): Promise<StockWithPrice[]> {
    const [stocks, priceMap] = await Promise.all([
      this.findAll(),
      this.getLatestPriceMap(),
    ]);

    // Resolve priceRange → effective min/max
    let effectiveMin = filters.minPrice;
    let effectiveMax = filters.maxPrice;

    if (filters.priceRange === 'cheap') {
      effectiveMin = undefined;
      effectiveMax = 50;
    } else if (filters.priceRange === 'mid') {
      effectiveMin = 50;
      effectiveMax = 500;
    } else if (filters.priceRange === 'premium') {
      effectiveMin = 500;
      effectiveMax = undefined;
    }

    const enriched: StockWithPrice[] = stocks.map((s) => ({
      ...s,
      currentPrice: priceMap.get(s.id) ?? null,
    }));

    return enriched.filter((s) => {
      const price = s.currentPrice;
      if (price === null) return false; // exclude stocks with no price data when filtering
      if (effectiveMin !== undefined && price < effectiveMin) return false;
      if (effectiveMax !== undefined && price > effectiveMax) return false;
      return true;
    });
  }

  /**
   * "Where the money will move" feed.
   * Criteria:
   *   - Current price < ₦100
   *   - Most recent anomaly event: volumeSpikeScore > 2.0
   *   - Most recent anomaly event: sentimentScore >= 0 (neutral or positive)
   * Also computes distanceFrom52wHigh and has52wHistory flag.
   * Sorted by volumeSpikeScore DESC.
   */
  async getOpportunities(): Promise<OpportunityItem[]> {
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    // 1. All stocks + current prices
    const [stocks, priceMap] = await Promise.all([
      this.findAll(),
      this.getLatestPriceMap(),
    ]);

    // 2. Latest anomaly event per stock (DISTINCT ON stock_id)
    const latestEventsResult = await this.db.execute(
      sql`
        SELECT DISTINCT ON (stock_id)
          stock_id,
          volume_spike_score,
          sentiment_score,
          conviction_tier
        FROM anomaly_events
        ORDER BY stock_id, created_at DESC
      `,
    );

    type EventRow = {
      stock_id: string;
      volume_spike_score: string | null;
      sentiment_score: string | null;
      conviction_tier: string | null;
    };
    const eventMap = new Map<
      number,
      { volumeSpikeScore: number; sentimentScore: number; convictionTier: string }
    >();
    for (const row of latestEventsResult.rows as unknown as EventRow[]) {
      eventMap.set(Number(row.stock_id), {
        volumeSpikeScore: parseFloat(row.volume_spike_score ?? '0'),
        sentimentScore: parseFloat(row.sentiment_score ?? '0'),
        convictionTier: row.conviction_tier ?? 'SPECULATIVE',
      });
    }

    // 3. Tracking-period high per stock + oldest timestamp to determine has52wHistory
    const highResult = await this.db.execute(
      sql`
        SELECT
          stock_id,
          MAX(price::numeric) AS high_price,
          MIN(timestamp) AS oldest_ts
        FROM price_snapshots
        GROUP BY stock_id
      `,
    );

    type HighRow = { stock_id: string; high_price: string; oldest_ts: string };
    const highMap = new Map<number, { highPrice: number; has52wHistory: boolean }>();
    for (const row of highResult.rows as unknown as HighRow[]) {
      const oldestTs = new Date(row.oldest_ts);
      highMap.set(Number(row.stock_id), {
        highPrice: parseFloat(row.high_price),
        has52wHistory: oldestTs <= oneYearAgo,
      });
    }

    // 4. Sentiment label from latest news sentiment per stock
    const sentLabelResult = await this.db.execute(
      sql`
        SELECT DISTINCT ON (ni.ticker_mentioned)
          ni.ticker_mentioned,
          ss.label
        FROM news_items ni
        JOIN sentiment_scores ss ON ss.news_item_id = ni.id
        WHERE ni.ticker_mentioned IS NOT NULL
        ORDER BY ni.ticker_mentioned, ni.scraped_at DESC
      `,
    );
    type SentLabelRow = { ticker_mentioned: string; label: string };
    const labelMap = new Map<string, string>();
    for (const row of sentLabelResult.rows as unknown as SentLabelRow[]) {
      if (row.ticker_mentioned) labelMap.set(row.ticker_mentioned, row.label ?? 'neutral');
    }

    // 5. Filter + build result
    const PRICE_CEILING = 100;
    const VOL_SPIKE_MIN = 2.0;

    const results: OpportunityItem[] = [];

    for (const stock of stocks) {
      const currentPrice = priceMap.get(stock.id) ?? null;
      if (currentPrice === null || currentPrice >= PRICE_CEILING) continue;

      const event = eventMap.get(stock.id);
      if (!event) continue;
      if (event.volumeSpikeScore <= VOL_SPIKE_MIN) continue;
      if (event.sentimentScore < 0) continue;

      const highData = highMap.get(stock.id) ?? null;
      let distanceFrom52wHigh: number | null = null;
      let has52wHistory = false;

      if (highData) {
        has52wHistory = highData.has52wHistory;
        const highPrice = highData.highPrice;
        if (highPrice > 0 && currentPrice < highPrice) {
          distanceFrom52wHigh = parseFloat(
            (((highPrice - currentPrice) / highPrice) * 100).toFixed(2),
          );
        } else {
          distanceFrom52wHigh = 0;
        }
      }

      const sentimentLabel = labelMap.get(stock.ticker) ?? 'neutral';

      results.push({
        ticker: stock.ticker,
        name: stock.name,
        sector: stock.sector,
        currentPrice,
        volumeSpikeScore: parseFloat(event.volumeSpikeScore.toFixed(2)),
        sentimentLabel,
        grahamScore: stock.grahamScore,
        distanceFrom52wHigh,
        has52wHistory,
        convictionTier: event.convictionTier,
      });
    }

    // Sort by volume spike score descending
    results.sort((a, b) => b.volumeSpikeScore - a.volumeSpikeScore);

    this.logger.log(
      `[OPPORTUNITIES] ${results.length} stocks qualify (price < ₦${PRICE_CEILING}, vol spike > ${VOL_SPIKE_MIN})`,
    );

    return results;
  }
}
