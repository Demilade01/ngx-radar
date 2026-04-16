import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { DB } from '../database/database.module';
import * as schema from '../database/schema';
import { isNotNull } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

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
}
