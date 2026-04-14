import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { YahooService } from '../scraper/yahoo.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(private readonly yahooService: YahooService) {}

  // Every 15 minutes, 9am–2:45pm WAT, Monday–Friday
  @Cron('*/15 9-14 * * 1-5', { timeZone: 'Africa/Lagos' })
  async fetchPrices() {
    this.logger.log(`[CRON] fetch-prices fired at ${new Date().toISOString()}`);
    const result = await this.yahooService.fetchAndStorePrices();
    this.logger.log(
      `[CRON] fetch-prices complete — ${result.success} ok, ${result.failed} failed`,
    );
  }
}
