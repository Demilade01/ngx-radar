import { Inject, Injectable, Logger } from '@nestjs/common';
import { desc, eq, gte, and, SQL } from 'drizzle-orm';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { DB } from '../database/database.module';
import * as schema from '../database/schema';
import { TelegramService } from './telegram.service';

export interface AlertFilters {
  tier?: string;
  sector?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @Inject(DB) private readonly db: NeonHttpDatabase<typeof schema>,
    private readonly telegramService: TelegramService,
  ) {}

  async createAndNotify(payload: {
    stockId: number;
    ticker: string;
    sector: string;
    volumeZScore: number;
    sentimentLabel: string;
    sentimentScore: number;
    grahamScore: number;
    convictionTier: string;
    summary: string;
  }): Promise<void> {
    await this.db.insert(schema.anomalyEvents).values({
      stockId: payload.stockId,
      type: 'VOLUME_SPIKE',
      volumeSpikeScore: String(payload.volumeZScore),
      sentimentScore: String(payload.sentimentScore),
      grahamScore: payload.grahamScore,
      convictionTier: payload.convictionTier,
      summary: payload.summary,
      createdAt: new Date(),
    });

    if (payload.convictionTier === 'HIGH' || payload.convictionTier === 'MEDIUM') {
      await this.telegramService.sendAlert({
        ticker: payload.ticker,
        convictionTier: payload.convictionTier,
        volumeZScore: payload.volumeZScore,
        sentimentLabel: payload.sentimentLabel,
        grahamScore: payload.grahamScore,
        sector: payload.sector,
        summary: payload.summary,
      });
    }
  }

  async findAll(filters: AlertFilters = {}) {
    const { tier, sector, page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];
    if (tier) conditions.push(eq(schema.anomalyEvents.convictionTier, tier));

    const baseQuery = this.db
      .select({
        alert: schema.anomalyEvents,
        ticker: schema.stocks.ticker,
        stockName: schema.stocks.name,
        sector: schema.stocks.sector,
      })
      .from(schema.anomalyEvents)
      .innerJoin(schema.stocks, eq(schema.anomalyEvents.stockId, schema.stocks.id));

    const query = conditions.length
      ? baseQuery.where(and(...conditions))
      : baseQuery;

    let rows = await query
      .orderBy(desc(schema.anomalyEvents.createdAt))
      .limit(limit)
      .offset(offset);

    // Apply sector filter in-memory (sector lives on joined stocks row)
    if (sector) {
      rows = rows.filter((r) => r.sector === sector);
    }

    return rows;
  }

  async getSectorHeatmap() {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const recentEvents = await this.db
      .select({
        stockId: schema.anomalyEvents.stockId,
        volumeSpikeScore: schema.anomalyEvents.volumeSpikeScore,
        convictionTier: schema.anomalyEvents.convictionTier,
      })
      .from(schema.anomalyEvents)
      .where(gte(schema.anomalyEvents.createdAt, fortyEightHoursAgo));

    const stocks = await this.db.select().from(schema.stocks);
    const stockMap = new Map(stocks.map((s) => [s.id, s]));

    const sectorData = new Map<string, { count: number; maxSpike: number; topTier: string }>();

    for (const event of recentEvents) {
      const stock = stockMap.get(event.stockId);
      if (!stock) continue;

      const sector = stock.sector;
      const spike = Number(event.volumeSpikeScore ?? 0);
      const tier = event.convictionTier ?? 'SPECULATIVE';

      const existing = sectorData.get(sector) ?? { count: 0, maxSpike: 0, topTier: 'LOW' };
      const tierRank: Record<string, number> = { HIGH: 4, MEDIUM: 3, SPECULATIVE: 2, DISTRIBUTION: 1, LOW: 0 };
      const newTopTier =
        (tierRank[tier] ?? 0) > (tierRank[existing.topTier] ?? 0) ? tier : existing.topTier;

      sectorData.set(sector, {
        count: existing.count + 1,
        maxSpike: Math.max(existing.maxSpike, spike),
        topTier: newTopTier,
      });
    }

    // Ensure all 6 sectors are represented even if count = 0
    const allSectors = ['Banking', 'Telecom', 'Consumer Goods', 'Oil & Gas', 'Cement', 'Agriculture'];
    return allSectors.map((sector) => {
      const data = sectorData.get(sector) ?? { count: 0, maxSpike: 0, topTier: 'LOW' };
      return {
        sector,
        count: data.count,
        maxSpike: data.maxSpike,
        intensity: this.intensityLabel(data.count, data.maxSpike),
      };
    });
  }

  async getRecentAlertsForDigest(hours = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    return this.db
      .select({
        alert: schema.anomalyEvents,
        ticker: schema.stocks.ticker,
        sector: schema.stocks.sector,
      })
      .from(schema.anomalyEvents)
      .innerJoin(schema.stocks, eq(schema.anomalyEvents.stockId, schema.stocks.id))
      .where(gte(schema.anomalyEvents.createdAt, since))
      .orderBy(desc(schema.anomalyEvents.createdAt));
  }

  private intensityLabel(count: number, maxSpike: number): string {
    if (count >= 3 || maxSpike >= 4.0) return 'HIGH';
    if (count >= 2 || maxSpike >= 2.5) return 'MEDIUM';
    if (count >= 1) return 'LOW';
    return 'NONE';
  }
}
