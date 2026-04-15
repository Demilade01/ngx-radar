import { Inject, Injectable, Logger } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { DB } from '../database/database.module';
import * as schema from '../database/schema';

// ─────────────────────────────────────────────
//  Math helpers
// ─────────────────────────────────────────────

function computeEMA(prices: number[], period: number): number[] {
  if (prices.length < period) return [];
  const k = 2 / (period + 1);
  const emas: number[] = [];
  // seed with SMA of first `period` values
  const seed = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  emas.push(seed);
  for (let i = period; i < prices.length; i++) {
    emas.push(prices[i] * k + emas[emas.length - 1] * (1 - k));
  }
  return emas;
}

function computeSMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const window = prices.slice(prices.length - period);
  return window.reduce((a, b) => a + b, 0) / period;
}

function computeRSI(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

interface MACDResult {
  macdLine: number;
  macdSignal: number;
  macdHistogram: number;
}

function computeMACD(prices: number[]): MACDResult | null {
  // Need at least 26 + 9 - 1 = 34 points for a proper reading
  if (prices.length < 27) return null;

  const ema12 = computeEMA(prices, 12);
  const ema26 = computeEMA(prices, 26);

  if (!ema12.length || !ema26.length) return null;

  // Align: ema26 has length = prices.length - 25, ema12 has length = prices.length - 11
  // MACD line = ema12 - ema26 (aligned on trailing end)
  const macdLine: number[] = [];
  const offset = ema12.length - ema26.length;
  for (let i = 0; i < ema26.length; i++) {
    macdLine.push(ema12[i + offset] - ema26[i]);
  }

  const signalEma = computeEMA(macdLine, 9);
  if (!signalEma.length) return null;

  const latestMacd = macdLine[macdLine.length - 1];
  const latestSignal = signalEma[signalEma.length - 1];
  return {
    macdLine: latestMacd,
    macdSignal: latestSignal,
    macdHistogram: latestMacd - latestSignal,
  };
}

interface BollingerResult {
  upper: number;
  lower: number;
  middle: number;
  position: number; // 0–1, (price - lower) / (upper - lower)
}

function computeBollinger(prices: number[], period = 20): BollingerResult | null {
  if (prices.length < period) return null;
  const window = prices.slice(prices.length - period);
  const mean = window.reduce((a, b) => a + b, 0) / period;
  const variance = window.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  const upper = mean + 2 * stdDev;
  const lower = mean - 2 * stdDev;
  const price = prices[prices.length - 1];
  const position = upper === lower ? 0.5 : (price - lower) / (upper - lower);

  return { upper, lower, middle: mean, position: Math.max(0, Math.min(1, position)) };
}

interface RegressionResult {
  slope: number;   // price per period (₦/snapshot)
  r2: number;      // 0–1 goodness of fit
  forecast: number; // price + slope
}

function computeLinearRegression(prices: number[], window = 20): RegressionResult | null {
  if (prices.length < window) return null;
  const y = prices.slice(prices.length - window);
  const n = y.length;
  const x = Array.from({ length: n }, (_, i) => i);

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // R²
  const meanY = sumY / n;
  const ssTot = y.reduce((acc, yi) => acc + Math.pow(yi - meanY, 2), 0);
  const ssRes = y.reduce((acc, yi, i) => acc + Math.pow(yi - (slope * x[i] + intercept), 2), 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { slope, r2, forecast: prices[prices.length - 1] + slope };
}

interface MomentumResult {
  momentum5: number;  // % return over 5 periods
  momentum20: number; // % return over 20 periods
}

function computeMomentum(prices: number[]): MomentumResult | null {
  if (prices.length < 21) return null;
  const current = prices[prices.length - 1];
  const p5 = prices[prices.length - 6];
  const p20 = prices[prices.length - 21];
  return {
    momentum5: p5 !== 0 ? (current - p5) / p5 : 0,
    momentum20: p20 !== 0 ? (current - p20) / p20 : 0,
  };
}

// ─────────────────────────────────────────────
//  QuantScore (0–100)
// ─────────────────────────────────────────────

export interface IndicatorBundle {
  rsi14: number | null;
  macdHistogram: number | null;
  bbPosition: number | null;
  momentum20: number | null;
}

export function computeQuantScore(
  indicators: IndicatorBundle,
  grahamScore: number,        // 0–7
  sentimentScore: number,     // –1 to 1
): number {
  // Momentum points (0–25)
  let momentumPts = 12;
  if (indicators.momentum20 !== null) {
    if (indicators.momentum20 > 0.01) momentumPts = 25;
    else if (indicators.momentum20 < -0.01) momentumPts = 0;
  }

  // Technical points (0–25)
  let technicalPts = 0;
  if (indicators.macdHistogram !== null && indicators.macdHistogram > 0) technicalPts += 8;
  if (indicators.rsi14 !== null && indicators.rsi14 >= 40 && indicators.rsi14 <= 60) technicalPts += 9;
  if (indicators.bbPosition !== null && indicators.bbPosition >= 0.3 && indicators.bbPosition <= 0.7) technicalPts += 8;

  // Fundamental points (0–25)
  const fundamentalPts = Math.round((grahamScore / 7) * 25);

  // Sentiment points (0–25)
  const sentimentPts = Math.round(((sentimentScore + 1) / 2) * 25);

  return Math.min(100, Math.max(0, momentumPts + technicalPts + fundamentalPts + sentimentPts));
}

// ─────────────────────────────────────────────
//  Service
// ─────────────────────────────────────────────

export interface SignalRow {
  stockId: number;
  rsi14: string | null;
  macdLine: string | null;
  macdSignal: string | null;
  macdHistogram: string | null;
  bbUpper: string | null;
  bbLower: string | null;
  bbPosition: string | null;
  sma20: string | null;
  sma50: string | null;
  trendSlope: string | null;
  trendR2: string | null;
  momentum5: string | null;
  momentum20: string | null;
  meanReversionZ: string | null;
  quantScore: number | null;
  signal: string | null;
  computedAt: Date;
}

@Injectable()
export class QuantService {
  private readonly logger = new Logger(QuantService.name);

  constructor(@Inject(DB) private readonly db: NeonHttpDatabase<typeof schema>) {}

  async updateAllSignals(): Promise<{ updated: number; skipped: number }> {
    const stocks = await this.db.select().from(schema.stocks);
    let updated = 0;
    let skipped = 0;

    for (const stock of stocks) {
      try {
        const did = await this.computeAndUpsert(stock);
        if (did) updated++;
        else skipped++;
      } catch (err) {
        this.logger.error(`[QUANT] Failed ${stock.ticker}: ${(err as Error).message}`);
        skipped++;
      }
    }

    this.logger.log(`[QUANT] updateAllSignals done — ${updated} updated, ${skipped} skipped`);
    return { updated, skipped };
  }

  private async computeAndUpsert(
    stock: typeof schema.stocks.$inferSelect,
  ): Promise<boolean> {
    // Fetch latest 60 snapshots (oldest→newest)
    const rows = await this.db
      .select({ price: schema.priceSnapshots.price })
      .from(schema.priceSnapshots)
      .where(eq(schema.priceSnapshots.stockId, stock.id))
      .orderBy(desc(schema.priceSnapshots.timestamp))
      .limit(60);

    if (rows.length < 27) {
      this.logger.debug(`[QUANT] ${stock.ticker}: only ${rows.length} snapshots — skipping`);
      return false;
    }

    // Reverse so oldest is first for math
    const prices = rows.map((r) => parseFloat(r.price)).reverse();

    const rsi = computeRSI(prices);
    const macd = computeMACD(prices);
    const bb = computeBollinger(prices);
    const regression = computeLinearRegression(prices);
    const momentum = computeMomentum(prices);

    const sma20 = computeSMA(prices, 20);
    const sma50 = computeSMA(prices, 50);

    // Mean reversion Z (rolling 20)
    let meanRevZ: number | null = null;
    if (prices.length >= 20) {
      const window = prices.slice(prices.length - 20);
      const mean = window.reduce((a, b) => a + b, 0) / window.length;
      const std = Math.sqrt(
        window.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / window.length,
      );
      meanRevZ = std > 0 ? (prices[prices.length - 1] - mean) / std : null;
    }

    const grahamScore = stock.grahamScore ?? 0;
    // Use grahamScore as a proxy sentiment since we don't have a per-stock real-time sentiment here
    // For now, default sentimentScore to 0 (neutral); could be joined from sentimentScores if needed
    const sentimentScore = 0;

    const quantScore = computeQuantScore(
      {
        rsi14: rsi,
        macdHistogram: macd?.macdHistogram ?? null,
        bbPosition: bb?.position ?? null,
        momentum20: momentum?.momentum20 ?? null,
      },
      grahamScore,
      sentimentScore,
    );

    const signal: 'BUY' | 'SELL' | 'HOLD' =
      quantScore >= 70 ? 'BUY' : quantScore <= 30 ? 'SELL' : 'HOLD';

    const payload: typeof schema.technicalSignals.$inferInsert = {
      stockId: stock.id,
      rsi14: rsi !== null ? String(rsi) : null,
      macdLine: macd ? String(macd.macdLine) : null,
      macdSignal: macd ? String(macd.macdSignal) : null,
      macdHistogram: macd ? String(macd.macdHistogram) : null,
      bbUpper: bb ? String(bb.upper) : null,
      bbLower: bb ? String(bb.lower) : null,
      bbPosition: bb ? String(bb.position) : null,
      sma20: sma20 !== null ? String(sma20) : null,
      sma50: sma50 !== null ? String(sma50) : null,
      trendSlope: regression ? String(regression.slope) : null,
      trendR2: regression ? String(regression.r2) : null,
      momentum5: momentum ? String(momentum.momentum5) : null,
      momentum20: momentum ? String(momentum.momentum20) : null,
      meanReversionZ: meanRevZ !== null ? String(meanRevZ) : null,
      quantScore,
      signal,
      computedAt: new Date(),
    };

    // Upsert — one row per stock (unique index on stockId)
    await this.db
      .insert(schema.technicalSignals)
      .values(payload)
      .onConflictDoUpdate({
        target: schema.technicalSignals.stockId,
        set: {
          rsi14: payload.rsi14,
          macdLine: payload.macdLine,
          macdSignal: payload.macdSignal,
          macdHistogram: payload.macdHistogram,
          bbUpper: payload.bbUpper,
          bbLower: payload.bbLower,
          bbPosition: payload.bbPosition,
          sma20: payload.sma20,
          sma50: payload.sma50,
          trendSlope: payload.trendSlope,
          trendR2: payload.trendR2,
          momentum5: payload.momentum5,
          momentum20: payload.momentum20,
          meanReversionZ: payload.meanReversionZ,
          quantScore: payload.quantScore,
          signal: payload.signal,
          computedAt: payload.computedAt,
        },
      });

    this.logger.debug(
      `[QUANT] ${stock.ticker} → score=${quantScore} | signal=${signal} | RSI=${rsi?.toFixed(1)}`,
    );
    return true;
  }

  /** Returns the latest technical signals for one stock by ticker */
  async getSignalsForTicker(ticker: string): Promise<SignalRow | null> {
    const [stock] = await this.db
      .select()
      .from(schema.stocks)
      .where(eq(schema.stocks.ticker, ticker.toUpperCase()))
      .limit(1);

    if (!stock) return null;

    const [row] = await this.db
      .select()
      .from(schema.technicalSignals)
      .where(eq(schema.technicalSignals.stockId, stock.id))
      .limit(1);

    return row ?? null;
  }

  /** Top N stocks ranked by quantScore DESC */
  async getTopSignals(limit = 10) {
    const rows = await this.db
      .select({
        ticker: schema.stocks.ticker,
        name: schema.stocks.name,
        sector: schema.stocks.sector,
        quantScore: schema.technicalSignals.quantScore,
        signal: schema.technicalSignals.signal,
        rsi14: schema.technicalSignals.rsi14,
        momentum20: schema.technicalSignals.momentum20,
      })
      .from(schema.technicalSignals)
      .innerJoin(schema.stocks, eq(schema.technicalSignals.stockId, schema.stocks.id))
      .orderBy(desc(schema.technicalSignals.quantScore))
      .limit(limit);

    return rows;
  }

  /** All stocks with their latest quant score (null if not computed) */
  async getAllSignals() {
    const rows = await this.db
      .select({
        ticker: schema.stocks.ticker,
        quantScore: schema.technicalSignals.quantScore,
        signal: schema.technicalSignals.signal,
      })
      .from(schema.stocks)
      .leftJoin(
        schema.technicalSignals,
        eq(schema.technicalSignals.stockId, schema.stocks.id),
      );

    return rows;
  }
}
