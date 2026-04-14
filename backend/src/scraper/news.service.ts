import { Inject, Injectable, Logger } from '@nestjs/common';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { DB } from '../database/database.module';
import * as schema from '../database/schema';
import RSSParser from 'rss-parser';
import * as cheerio from 'cheerio';

const TICKER_KEYWORDS: Record<string, string> = {
  'Dangote Cement': 'DANGCEM.LG',
  DANGCEM: 'DANGCEM.LG',
  'Guaranty Trust': 'GTCO.LG',
  GTCO: 'GTCO.LG',
  'Zenith Bank': 'ZENITHBANK.LG',
  Zenith: 'ZENITHBANK.LG',
  'MTN Nigeria': 'MTNN.LG',
  MTN: 'MTNN.LG',
  'Airtel Africa': 'AIRTELAFRI.LG',
  Airtel: 'AIRTELAFRI.LG',
  'BUA Foods': 'BUAFOODS.LG',
  Seplat: 'SEPLAT.LG',
  'Access Holdings': 'ACCESSCORP.LG',
  'Access Bank': 'ACCESSCORP.LG',
  'United Bank': 'UBA.LG',
  UBA: 'UBA.LG',
  'FBN Holdings': 'FBNH.LG',
  'First Bank': 'FBNH.LG',
  'Nestle Nigeria': 'NESTLE.LG',
  Nestle: 'NESTLE.LG',
  'Flour Mills': 'FLOURMILL.LG',
  Transcorp: 'TRANSCORP.LG',
  'Okomu Oil': 'OKOMUOIL.LG',
  Presco: 'PRESCO.LG',
  'BUA Cement': 'BUACEMENT.LG',
  'Stanbic IBTC': 'STANBIC.LG',
  Stanbic: 'STANBIC.LG',
  'Fidelity Bank': 'FIDELITYBK.LG',
  Fidelity: 'FIDELITYBK.LG',
  'Lafarge Africa': 'WAPCO.LG',
  Lafarge: 'WAPCO.LG',
  TotalEnergies: 'TOTAL.LG',
};

function detectTicker(headline: string): string | null {
  for (const [keyword, ticker] of Object.entries(TICKER_KEYWORDS)) {
    if (headline.toLowerCase().includes(keyword.toLowerCase())) {
      return ticker;
    }
  }
  return null;
}

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);
  private readonly rssParser = new RSSParser();

  constructor(
    @Inject(DB) private readonly db: NeonHttpDatabase<typeof schema>,
  ) {}

  async scrapeAll(): Promise<number> {
    const results = await Promise.allSettled([
      this.scrapeNairametrics(),
      this.scrapeBusinessDay(),
      this.scrapeVanguard(),
    ]);

    let total = 0;
    const sources = ['Nairametrics', 'BusinessDay', 'Vanguard'];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        total += r.value;
        this.logger.log(`[NEWS] ${sources[i]}: +${r.value} new items`);
      } else {
        this.logger.error(`[NEWS] ${sources[i]} failed: ${r.reason?.message}`);
      }
    });

    this.logger.log(`[NEWS] Scrape complete — ${total} new items total`);
    return total;
  }

  private async scrapeNairametrics(): Promise<number> {
    const feed = await this.rssParser.parseURL('https://nairametrics.com/feed/');
    const items = (feed.items ?? []).slice(0, 30).map((item) => ({
      headline: item.title ?? '',
      url: item.link ?? '',
      source: 'nairametrics',
      tickerMentioned: detectTicker(item.title ?? ''),
      scrapedAt: new Date(),
    }));
    return this.insertItems(items);
  }

  private async scrapeBusinessDay(): Promise<number> {
    const res = await fetch('https://businessday.ng/markets', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NGXRadar/1.0)' },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    const items: Array<{ headline: string; url: string; source: string; tickerMentioned: string | null; scrapedAt: Date }> = [];
    $('h3.entry-title a, h2.entry-title a, .post-title a, article h2 a').each((_, el) => {
      const headline = $(el).text().trim();
      const href = $(el).attr('href') ?? '';
      if (headline && href) {
        items.push({
          headline,
          url: href.startsWith('http') ? href : `https://businessday.ng${href}`,
          source: 'businessday',
          tickerMentioned: detectTicker(headline),
          scrapedAt: new Date(),
        });
      }
    });

    return this.insertItems(items.slice(0, 30));
  }

  private async scrapeVanguard(): Promise<number> {
    const res = await fetch('https://www.vanguardngr.com/category/business', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NGXRadar/1.0)' },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    const items: Array<{ headline: string; url: string; source: string; tickerMentioned: string | null; scrapedAt: Date }> = [];
    $('h2.entry-title a, h3.entry-title a, .entry-title a').each((_, el) => {
      const headline = $(el).text().trim();
      const href = $(el).attr('href') ?? '';
      if (headline && href) {
        items.push({
          headline,
          url: href.startsWith('http') ? href : `https://www.vanguardngr.com${href}`,
          source: 'vanguard',
          tickerMentioned: detectTicker(headline),
          scrapedAt: new Date(),
        });
      }
    });

    return this.insertItems(items.slice(0, 30));
  }

  private async insertItems(
    items: Array<{ headline: string; url: string; source: string; tickerMentioned: string | null; scrapedAt: Date }>,
  ): Promise<number> {
    if (!items.length) return 0;
    const result = await this.db
      .insert(schema.newsItems)
      .values(items)
      .onConflictDoNothing()
      .returning({ id: schema.newsItems.id });
    return result.length;
  }
}
