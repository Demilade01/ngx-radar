import { Inject, Injectable, Logger } from '@nestjs/common';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { DB } from '../database/database.module';
import * as schema from '../database/schema';

interface NgxPulseStock {
  symbol: string;
  name: string;
  current_price: number;
  previous_close: number;
  change_percent: number | null;
  volume: number;
  market_cap: number;
  sector: string;
  market: string;
  trade_date: string;
}

interface NgxPulseResponse {
  stocks: NgxPulseStock[];
}

@Injectable()
export class YahooService {
  private readonly logger = new Logger(YahooService.name);
  private readonly apiKey = process.env.NGX_PULSE_API_KEY!;
  private readonly baseUrl = 'https://ngxpulse.ng';

  constructor(
    @Inject(DB) private readonly db: NeonHttpDatabase<typeof schema>,
  ) {}

  async fetchAndStorePrices(): Promise<{ success: number; failed: number }> {
    const prices = await this.fetchAllStocks();

    if (!prices.length) {
      this.logger.warn('[NGX] No prices retrieved from NGX Pulse');
      return { success: 0, failed: 0 };
    }

    const stocks = await this.db.select().from(schema.stocks);
    const stockMap = new Map(stocks.map((s) => [s.ticker.replace('.LG', ''), s]));

    let success = 0;
    let failed = 0;

    for (const row of prices) {
      const stock = stockMap.get(row.symbol.toUpperCase());
      if (!stock) continue;

      try {
        await this.db.insert(schema.priceSnapshots).values({
          stockId: stock.id,
          price: String(row.current_price),
          volume: row.volume ?? 0,
          timestamp: new Date(),
        });
        const chg = row.change_percent;
        const chgStr = chg != null ? ` (${chg >= 0 ? '+' : ''}${chg}%)` : '';
        this.logger.log(`[NGX] ✓ ${row.symbol} — ₦${row.current_price}${chgStr} vol:${row.volume}`);
        success++;
      } catch (err) {
        this.logger.warn(`[NGX] ✗ ${row.symbol}: ${(err as Error).message}`);
        failed++;
      }
    }

    this.logger.log(`[NGX Pulse] Batch complete — ${success} ok, ${failed} skipped`);
    return { success, failed };
  }

  private async fetchAllStocks(): Promise<NgxPulseStock[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/ngxdata/stocks`, {
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (res.status === 401) {
        this.logger.error('[NGX Pulse] Invalid API key — check NGX_PULSE_API_KEY in .env');
        return [];
      }
      if (res.status === 429) {
        this.logger.warn('[NGX Pulse] Rate limit hit — will retry on next cron tick');
        return [];
      }
      if (!res.ok) {
        this.logger.error(`[NGX Pulse] HTTP ${res.status}`);
        return [];
      }

      const data = await res.json() as NgxPulseResponse;
      const stocks = data?.stocks ?? [];
      this.logger.log(`[NGX Pulse] Fetched ${stocks.length} stocks`);
      return stocks;
    } catch (err) {
      this.logger.error(`[NGX Pulse] Request failed: ${(err as Error).message}`);
      return [];
    }
  }
}
