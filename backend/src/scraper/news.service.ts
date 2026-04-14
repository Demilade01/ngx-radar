import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { DB } from '../database/database.module';
import * as schema from '../database/schema';
import RSSParser from 'rss-parser';
import * as cheerio from 'cheerio';

@Injectable()
export class NewsService implements OnModuleInit {
  private readonly logger = new Logger(NewsService.name);
  private readonly rssParser = new RSSParser();

  // Built dynamically from DB on module init
  private tickerKeywords: Array<{ keyword: string; ticker: string }> = [];

  constructor(
    @Inject(DB) private readonly db: NeonHttpDatabase<typeof schema>,
  ) {}

  async onModuleInit() {
    await this.buildTickerKeywords();
  }

  private async buildTickerKeywords() {
    const stocks = await this.db
      .select({ ticker: schema.stocks.ticker, name: schema.stocks.name })
      .from(schema.stocks);

    this.tickerKeywords = stocks.flatMap((s) => {
      const symbol = s.ticker.replace('.LG', '');
      const entries: Array<{ keyword: string; ticker: string }> = [
        { keyword: symbol, ticker: s.ticker },
      ];
      if (s.name && s.name !== symbol) {
        entries.push({ keyword: s.name, ticker: s.ticker });
        // Add first meaningful word if name is multi-word
        const firstWord = s.name.split(' ')[0];
        if (firstWord.length > 4) {
          entries.push({ keyword: firstWord, ticker: s.ticker });
        }
      }
      return entries;
    });

    this.logger.log(`[NEWS] Ticker keywords built: ${this.tickerKeywords.length} entries`);
  }

  private detectTicker(headline: string): string | null {
    const lower = headline.toLowerCase();
    for (const { keyword, ticker } of this.tickerKeywords) {
      if (lower.includes(keyword.toLowerCase())) return ticker;
    }
    return null;
  }

  async scrapeAll(): Promise<number> {
    // Refresh keywords in case new stocks were added
    await this.buildTickerKeywords();

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
      tickerMentioned: this.detectTicker(item.title ?? ''),
      scrapedAt: new Date(),
    }));
    return this.insertItems(items);
  }

  private async scrapeBusinessDay(): Promise<number> {
    const res = await fetch('https://businessday.ng/markets', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Ngix/1.0)' },
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
          tickerMentioned: this.detectTicker(headline),
          scrapedAt: new Date(),
        });
      }
    });

    return this.insertItems(items.slice(0, 30));
  }

  private async scrapeVanguard(): Promise<number> {
    const res = await fetch('https://www.vanguardngr.com/category/business', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Ngix/1.0)' },
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
          tickerMentioned: this.detectTicker(headline),
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
