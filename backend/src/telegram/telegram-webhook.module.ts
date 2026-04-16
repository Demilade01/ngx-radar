import { Module } from '@nestjs/common';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramWebhookService } from './telegram-webhook.service';
import { AlertsModule } from '../alerts/alerts.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { StocksModule } from '../stocks/stocks.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule, AlertsModule, IntelligenceModule, StocksModule],
  controllers: [TelegramWebhookController],
  providers: [TelegramWebhookService],
})
export class TelegramWebhookModule {}
