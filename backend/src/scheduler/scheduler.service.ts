import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { YahooService } from '../scraper/yahoo.service';
import { NewsService } from '../scraper/news.service';
import { AnomalyService } from '../intelligence/anomaly.service';
import { GrahamService } from '../intelligence/graham.service';
import { QuantService } from '../intelligence/quant.service';
import { AlertsService } from '../alerts/alerts.service';
import { TelegramService } from '../alerts/telegram.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly yahooService: YahooService,
    private readonly newsService: NewsService,
    private readonly anomalyService: AnomalyService,
    private readonly grahamService: GrahamService,
    private readonly quantService: QuantService,
    private readonly alertsService: AlertsService,
    private readonly telegramService: TelegramService,
  ) {}


  // Every 15 min during NGX market hours: 10:00 AM – 2:30 PM WAT (Mon–Fri)
  @Cron('*/15 10-14 * * 1-5', { timeZone: 'Africa/Lagos' })
  async fetchPrices() {
    this.logger.log(`[CRON] fetch-prices fired at ${new Date().toISOString()}`);
    const result = await this.yahooService.fetchAndStorePrices();
    this.logger.log(
      `[CRON] fetch-prices complete — ${result.success} ok, ${result.failed} failed`,
    );
  }

  // Quant signals: every 15 min during market hours, piggybacking on fetch-prices schedule
  @Cron('*/15 10-14 * * 1-5', { timeZone: 'Africa/Lagos' })
  async updateQuantSignals() {
    this.logger.log(`[CRON] quant-signals fired at ${new Date().toISOString()}`);
    const result = await this.quantService.updateAllSignals();
    this.logger.log(
      `[CRON] quant-signals complete — ${result.updated} updated, ${result.skipped} skipped`,
    );
  }

  // Every 30 minutes, 24/7
  @Cron('*/30 * * * *')
  async scrapeNews() {
    this.logger.log(`[CRON] scrape-news fired at ${new Date().toISOString()}`);
    const count = await this.newsService.scrapeAll();
    this.logger.log(`[CRON] scrape-news complete — ${count} new items`);
  }

  // Top of every hour
  @Cron('0 * * * *')
  async detectAnomalies() {
    this.logger.log(`[CRON] detect-anomalies fired at ${new Date().toISOString()}`);
    const results = await this.anomalyService.detectAll();
    this.logger.log(`[CRON] detect-anomalies complete — ${results.length} events`);
  }

  // After market close (3pm WAT, Mon–Fri) — refresh Graham scores
  @Cron('0 15 * * 1-5', { timeZone: 'Africa/Lagos' })
  async updateGrahamScoresPostMarket() {
    this.logger.log(`[CRON] update-graham (post-market) fired at ${new Date().toISOString()}`);
    await this.grahamService.updateAllGrahamScores();
    this.logger.log(`[CRON] update-graham (post-market) complete`);
  }

  // End of business day (5pm WAT, Mon–Fri) — refresh Graham scores again
  @Cron('0 17 * * 1-5', { timeZone: 'Africa/Lagos' })
  async updateGrahamScoresEndOfDay() {
    this.logger.log(`[CRON] update-graham (EOD) fired at ${new Date().toISOString()}`);
    await this.grahamService.updateAllGrahamScores();
    this.logger.log(`[CRON] update-graham (EOD) complete`);
  }

  // 9am WAT, Mon–Fri morning digest
  @Cron('0 9 * * 1-5', { timeZone: 'Africa/Lagos' })
  async morningDigest() {
    this.logger.log(`[CRON] morning-digest fired at ${new Date().toISOString()}`);
    const rows = await this.alertsService.getRecentAlertsForDigest(24);

    const payload = rows.map((r) => ({
      ticker: r.ticker,
      convictionTier: r.alert.convictionTier ?? 'SPECULATIVE',
      volumeZScore: Number(r.alert.volumeSpikeScore ?? 0),
      sentimentLabel: 'neutral',
      grahamScore: r.alert.grahamScore ?? 0,
      sector: r.sector,
      summary: r.alert.summary ?? '',
    }));

    await this.telegramService.sendMorningDigest(payload);
    this.logger.log(`[CRON] morning-digest sent — ${payload.length} alerts included`);
  }
}
