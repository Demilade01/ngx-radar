import { Inject, Injectable, Logger } from '@nestjs/common';
import { desc, eq, gte, and } from 'drizzle-orm';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import Groq from 'groq-sdk';
import { DB } from '../database/database.module';
import * as schema from '../database/schema';
import { SentimentService } from './sentiment.service';

export type ConvictionTier = 'HIGH' | 'MEDIUM' | 'SPECULATIVE' | 'DISTRIBUTION';

interface AnomalyResult {
  ticker: string;
  sector: string;
  volumeZScore: number;
  sentimentLabel: string;
  sentimentScore: number;
  grahamScore: number;
  convictionTier: ConvictionTier;
  summary: string;
}

const SUMMARY_PROMPT =
  'You are a Nigerian stock market analyst. Write exactly one sentence (max 20 words) explaining why this NGX stock may be experiencing unusual volume activity. Be specific and direct.';

@Injectable()
export class AnomalyService {
  private readonly logger = new Logger(AnomalyService.name);
  private readonly groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  constructor(
    @Inject(DB) private readonly db: NeonHttpDatabase<typeof schema>,
    private readonly sentimentService: SentimentService,
  ) {}

  async detectAll(): Promise<AnomalyResult[]> {
    // First, score any unscored news
    await this.sentimentService.scoreUnscoredNews();

    const stocks = await this.db.select().from(schema.stocks);
    const detected: AnomalyResult[] = [];

    for (const stock of stocks) {
      try {
        const result = await this.analyzeStock(stock);
        if (result) detected.push(result);
      } catch (err) {
        this.logger.error(
          `[ANOMALY] Failed ${stock.ticker}: ${(err as Error).message}`,
        );
      }
    }

    if (detected.length) {
      await this.detectSectorRotation(detected);
    }

    this.logger.log(`[ANOMALY] Detection complete — ${detected.length} anomalies found`);
    return detected;
  }

  private async analyzeStock(
    stock: typeof schema.stocks.$inferSelect,
  ): Promise<AnomalyResult | null> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const snapshots = await this.db
      .select({ volume: schema.priceSnapshots.volume, timestamp: schema.priceSnapshots.timestamp })
      .from(schema.priceSnapshots)
      .where(
        and(
          eq(schema.priceSnapshots.stockId, stock.id),
          gte(schema.priceSnapshots.timestamp, thirtyDaysAgo),
        ),
      )
      .orderBy(desc(schema.priceSnapshots.timestamp));

    if (snapshots.length < 5) return null;

    const volumes = snapshots.map((s) => Number(s.volume ?? 0));
    const todayVolume = volumes[0];
    const historicalVolumes = volumes.slice(1);

    const avg = historicalVolumes.reduce((a, b) => a + b, 0) / historicalVolumes.length;
    const variance =
      historicalVolumes.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) /
      historicalVolumes.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return null;

    const zScore = (todayVolume - avg) / stdDev;
    if (zScore < 2.5) return null;

    // Get latest sentiment for this ticker
    const sentiment = await this.sentimentService.getLatestSentimentForTicker(stock.ticker);
    const sentimentLabel = sentiment?.label ?? 'neutral';
    const sentimentScore = sentiment?.score ?? 0;
    const grahamScore = stock.grahamScore ?? 0;

    const convictionTier = this.assignConvictionTier(
      zScore,
      sentimentLabel,
      grahamScore,
    );

    const summary = await this.generateSummary(stock.ticker, stock.sector, zScore, sentimentLabel);

    // Persist the anomaly event
    await this.db.insert(schema.anomalyEvents).values({
      stockId: stock.id,
      type: 'VOLUME_SPIKE',
      volumeSpikeScore: String(zScore),
      sentimentScore: String(sentimentScore),
      grahamScore,
      convictionTier,
      summary,
      createdAt: new Date(),
    });

    this.logger.log(
      `[ANOMALY] ${stock.ticker} | z=${zScore.toFixed(2)} | ${convictionTier} | ${sentimentLabel}`,
    );

    return {
      ticker: stock.ticker,
      sector: stock.sector,
      volumeZScore: zScore,
      sentimentLabel,
      sentimentScore,
      grahamScore,
      convictionTier,
      summary,
    };
  }

  private assignConvictionTier(
    zScore: number,
    sentimentLabel: string,
    grahamScore: number,
  ): ConvictionTier {
    if (sentimentLabel === 'negative') return 'DISTRIBUTION';
    if (zScore > 2.5 && sentimentLabel === 'positive' && grahamScore >= 5) return 'HIGH';
    if (zScore > 2.5 && grahamScore >= 3 && grahamScore <= 4) return 'MEDIUM';
    if (grahamScore <= 2) return 'SPECULATIVE';
    return 'MEDIUM';
  }

  private async generateSummary(
    ticker: string,
    sector: string,
    zScore: number,
    sentiment: string,
  ): Promise<string> {
    try {
      const completion = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SUMMARY_PROMPT },
          {
            role: 'user',
            content: `Stock: ${ticker}, Sector: ${sector}, Volume spike: ${zScore.toFixed(1)}x above 30-day average, Sentiment: ${sentiment}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 60,
      });
      return completion.choices[0]?.message?.content?.trim() ?? 'Unusual volume activity detected.';
    } catch {
      return `${ticker} showing ${zScore.toFixed(1)}x normal volume with ${sentiment} sentiment.`;
    }
  }

  private async detectSectorRotation(events: AnomalyResult[]): Promise<void> {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // Count anomalies per sector in last 48h (combine current batch + recent DB records)
    const recentEvents = await this.db
      .select({
        stockId: schema.anomalyEvents.stockId,
        createdAt: schema.anomalyEvents.createdAt,
      })
      .from(schema.anomalyEvents)
      .where(gte(schema.anomalyEvents.createdAt, fortyEightHoursAgo));

    // Map stockId → sector from stocks table
    const stocks = await this.db.select().from(schema.stocks);
    const stockSectorMap = new Map(stocks.map((s) => [s.id, s.sector]));

    const sectorCounts = new Map<string, number>();

    // Count from DB
    for (const event of recentEvents) {
      const sector = stockSectorMap.get(event.stockId);
      if (sector) sectorCounts.set(sector, (sectorCounts.get(sector) ?? 0) + 1);
    }

    // Add current batch
    for (const event of events) {
      sectorCounts.set(event.sector, (sectorCounts.get(event.sector) ?? 0) + 1);
    }

    for (const [sector, count] of sectorCounts.entries()) {
      if (count >= 3) {
        // Find a representative stock for this sector
        const repStock = stocks.find((s) => s.sector === sector);
        if (!repStock) continue;

        await this.db.insert(schema.anomalyEvents).values({
          stockId: repStock.id,
          type: 'SECTOR_ROTATION',
          volumeSpikeScore: String(count),
          sentimentScore: null,
          grahamScore: null,
          convictionTier: 'HIGH',
          summary: `${count} stocks in ${sector} sector showing unusual volume — possible sector rotation.`,
          createdAt: new Date(),
        });

        this.logger.log(`[ANOMALY] Sector rotation detected: ${sector} (${count} stocks)`);
      }
    }
  }
}
