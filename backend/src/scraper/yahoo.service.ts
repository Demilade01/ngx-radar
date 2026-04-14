import { Inject, Injectable, Logger } from '@nestjs/common';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { DB } from '../database/database.module';
import * as schema from '../database/schema';
import yahooFinance from 'yahoo-finance2';

@Injectable()
export class YahooService {
  private readonly logger = new Logger(YahooService.name);

  constructor(
    @Inject(DB) private readonly db: NeonHttpDatabase<typeof schema>,
  ) {}

  async fetchAndStorePrices(): Promise<{ success: number; failed: number }> {
    const stocks = await this.db.select().from(schema.stocks);

    let success = 0;
    let failed = 0;

    for (const stock of stocks) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const quote: any = await yahooFinance.quote(stock.ticker);

        if (!quote?.regularMarketPrice) {
          this.logger.warn(`[YAHOO] ${stock.ticker}: no price in response`);
          failed++;
          continue;
        }

        await this.db.insert(schema.priceSnapshots).values({
          stockId: stock.id,
          price: String(quote.regularMarketPrice),
          volume: quote.regularMarketVolume ?? 0,
          timestamp: quote.regularMarketTime
            ? new Date(quote.regularMarketTime)
            : new Date(),
        });

        this.logger.log(
          `[YAHOO] ✓ ${stock.ticker} — ₦${quote.regularMarketPrice} vol:${quote.regularMarketVolume}`,
        );
        success++;
      } catch (err) {
        this.logger.error(`[YAHOO] ✗ ${stock.ticker}: ${(err as Error).message}`);
        failed++;
      }
    }

    this.logger.log(`[YAHOO] Batch complete — ${success} ok, ${failed} failed`);
    return { success, failed };
  }
}
