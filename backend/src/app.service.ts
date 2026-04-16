import { Inject, Injectable } from '@nestjs/common';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { DB } from './database/database.module';
import * as schema from './database/schema';
import { count, gte } from 'drizzle-orm';

@Injectable()
export class AppService {
  constructor(
    @Inject(DB) private readonly db: NeonHttpDatabase<typeof schema>,
  ) {}

  async getStatus() {
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0=Sun, 6=Sat
    // WAT = UTC+1
    const watHour = (now.getUTCHours() + 1) % 24;
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const isMarketHours = watHour >= 9 && watHour < 15;
    const marketOpen = isWeekday && isMarketHours;

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const [stockCount, alertCount, snapshotCount] = await Promise.all([
      this.db.select({ value: count() }).from(schema.stocks),
      this.db
        .select({ value: count() })
        .from(schema.anomalyEvents)
        .where(gte(schema.anomalyEvents.createdAt, todayStart)),
      this.db
        .select({ value: count() })
        .from(schema.priceSnapshots)
        .where(gte(schema.priceSnapshots.timestamp, todayStart)),
    ]);

    return {
      status: 'ok',
      version: '2.0.0',
      marketOpen,
      marketStatus: marketOpen ? 'OPEN' : 'CLOSED',
      watTime: `${String(watHour).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')} WAT`,
      stocksMonitored: stockCount[0]?.value ?? 0,
      alertsToday: alertCount[0]?.value ?? 0,
      priceSnapshotsToday: snapshotCount[0]?.value ?? 0,
      timestamp: now.toISOString(),
    };
  }
}
