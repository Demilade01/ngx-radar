import { Inject, Injectable, Logger } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { DB } from '../database/database.module';
import * as schema from '../database/schema';

const NGX_STOCKS = [
  { ticker: 'DANGCEM.LG', name: 'Dangote Cement', sector: 'Cement', marketCapTier: 'large' },
  { ticker: 'GTCO.LG', name: 'Guaranty Trust Holding Co', sector: 'Banking', marketCapTier: 'large' },
  { ticker: 'ZENITHBANK.LG', name: 'Zenith Bank', sector: 'Banking', marketCapTier: 'large' },
  { ticker: 'MTNN.LG', name: 'MTN Nigeria', sector: 'Telecom', marketCapTier: 'large' },
  { ticker: 'AIRTELAFRI.LG', name: 'Airtel Africa', sector: 'Telecom', marketCapTier: 'large' },
  { ticker: 'BUAFOODS.LG', name: 'BUA Foods', sector: 'Consumer Goods', marketCapTier: 'large' },
  { ticker: 'SEPLAT.LG', name: 'Seplat Energy', sector: 'Oil & Gas', marketCapTier: 'mid' },
  { ticker: 'ACCESSCORP.LG', name: 'Access Holdings', sector: 'Banking', marketCapTier: 'large' },
  { ticker: 'UBA.LG', name: 'United Bank for Africa', sector: 'Banking', marketCapTier: 'large' },
  { ticker: 'FBNH.LG', name: 'FBN Holdings', sector: 'Banking', marketCapTier: 'large' },
  { ticker: 'NESTLE.LG', name: 'Nestle Nigeria', sector: 'Consumer Goods', marketCapTier: 'large' },
  { ticker: 'FLOURMILL.LG', name: 'Flour Mills Nigeria', sector: 'Consumer Goods', marketCapTier: 'mid' },
  { ticker: 'TRANSCORP.LG', name: 'Transcorp', sector: 'Oil & Gas', marketCapTier: 'mid' },
  { ticker: 'OKOMUOIL.LG', name: 'Okomu Oil Palm', sector: 'Agriculture', marketCapTier: 'mid' },
  { ticker: 'PRESCO.LG', name: 'Presco', sector: 'Agriculture', marketCapTier: 'mid' },
  { ticker: 'BUACEMENT.LG', name: 'BUA Cement', sector: 'Cement', marketCapTier: 'large' },
  { ticker: 'STANBIC.LG', name: 'Stanbic IBTC Holdings', sector: 'Banking', marketCapTier: 'mid' },
  { ticker: 'FIDELITYBK.LG', name: 'Fidelity Bank', sector: 'Banking', marketCapTier: 'mid' },
  { ticker: 'WAPCO.LG', name: 'Lafarge Africa', sector: 'Cement', marketCapTier: 'mid' },
  { ticker: 'TOTAL.LG', name: 'TotalEnergies Marketing Nigeria', sector: 'Oil & Gas', marketCapTier: 'mid' },
];

@Injectable()
export class StocksService {
  private readonly logger = new Logger(StocksService.name);

  constructor(
    @Inject(DB) private readonly db: NeonHttpDatabase<typeof schema>,
  ) {}

  async seedStocks(): Promise<void> {
    await this.db
      .insert(schema.stocks)
      .values(NGX_STOCKS)
      .onConflictDoNothing();
    this.logger.log('[SEED] 20 NGX stocks seeded (skipped duplicates)');
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
}
