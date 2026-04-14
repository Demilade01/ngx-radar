import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { StocksModule } from './stocks/stocks.module';
import { ScraperModule } from './scraper/scraper.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { StocksService } from './stocks/stocks.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule,
    ScraperModule,
    StocksModule,
    SchedulerModule,
  ],
})
export class AppModule implements OnApplicationBootstrap {
  constructor(private readonly stocksService: StocksService) {}

  async onApplicationBootstrap() {
    await this.stocksService.seedStocks();
  }
}
