import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import YahooFinance from 'yahoo-finance2';
import { DB } from '../database/database.module';
import * as schema from '../database/schema';

interface GrahamBreakdown {
  score: number;
  criteria: Record<string, boolean>;
  currentRatio: number | null;
  peRatio: number | null;
  pbRatio: number | null;
}

@Injectable()
export class GrahamService {
  private readonly logger = new Logger(GrahamService.name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly yf: any = new YahooFinance();

  constructor(
    @Inject(DB) private readonly db: NeonHttpDatabase<typeof schema>,
  ) {}

  async updateAllGrahamScores(): Promise<void> {
    const stocks = await this.db.select().from(schema.stocks);
    let updated = 0;

    for (const stock of stocks) {
      try {
        const breakdown = await this.scoreStock(stock.ticker);
        await this.db
          .update(schema.stocks)
          .set({
            grahamScore: breakdown.score,
            currentRatio: breakdown.currentRatio !== null ? String(breakdown.currentRatio) : null,
            peRatio: breakdown.peRatio !== null ? String(breakdown.peRatio) : null,
            pbRatio: breakdown.pbRatio !== null ? String(breakdown.pbRatio) : null,
          })
          .where(eq(schema.stocks.id, stock.id));
        updated++;
        this.logger.log(
          `[GRAHAM] ${stock.ticker}: ${breakdown.score}/7`,
        );
      } catch (err) {
        this.logger.error(
          `[GRAHAM] Failed ${stock.ticker}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(`[GRAHAM] Updated ${updated}/${stocks.length} stocks`);
  }

  async scoreStock(ticker: string): Promise<GrahamBreakdown> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summary: any = await this.yf.quoteSummary(ticker, {
      modules: ['financialData', 'defaultKeyStatistics', 'summaryDetail'],
    });

    const fd = summary?.financialData ?? {};
    const ks = summary?.defaultKeyStatistics ?? {};
    const sd = summary?.summaryDetail ?? {};

    const currentRatio: number | null = fd.currentRatio ?? null;
    const debtToEquity: number | null = fd.debtToEquity ?? null;
    const trailingEps: number | null = ks.trailingEps ?? null;
    const dividendYield: number | null = sd.dividendYield ?? sd.trailingAnnualDividendYield ?? null;
    const earningsGrowth: number | null = fd.earningsGrowth ?? ks.earningsQuarterlyGrowth ?? null;
    const trailingPE: number | null = sd.trailingPE ?? null;
    const priceToBook: number | null = ks.priceToBook ?? null;

    const criteria: Record<string, boolean> = {
      currentRatioGte2: currentRatio !== null ? currentRatio >= 2.0 : false,
      debtLt50pct: debtToEquity !== null ? debtToEquity < 50 : false,
      noEarningsDeficit: trailingEps !== null ? trailingEps > 0 : false,
      dividendPaid: dividendYield !== null ? dividendYield > 0 : false,
      earningsGrowthGt10: earningsGrowth !== null ? earningsGrowth > 0.1 : false,
      peLt15: trailingPE !== null ? trailingPE < 15 : false,
      pbLt15: priceToBook !== null ? priceToBook < 1.5 : false,
    };

    const score = Object.values(criteria).filter(Boolean).length;

    return { score, criteria, currentRatio, peRatio: trailingPE, pbRatio: priceToBook };
  }
}
