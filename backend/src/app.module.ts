import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { StocksModule } from './stocks/stocks.module';
import { ScraperModule } from './scraper/scraper.module';
import { IntelligenceModule } from './intelligence/intelligence.module';
import { AlertsModule } from './alerts/alerts.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { StocksService } from './stocks/stocks.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AnomalyService } from './intelligence/anomaly.service';
import { TelegramService } from './alerts/telegram.service';
import { QuantService } from './intelligence/quant.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule,
    ScraperModule,
    StocksModule,
    IntelligenceModule,
    AlertsModule,
    SchedulerModule,
  ],
  controllers: [AppController],
  providers: [AppService, AnomalyService, TelegramService, QuantService],
})
export class AppModule implements OnApplicationBootstrap {
  constructor(private readonly stocksService: StocksService) {}

  async onApplicationBootstrap() {
    await this.stocksService.seedStocks();
  }
}
