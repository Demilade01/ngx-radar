import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { TelegramService } from './telegram.service';

@Module({
  providers: [AlertsService, TelegramService],
  controllers: [AlertsController],
  exports: [AlertsService, TelegramService],
})
export class AlertsModule {}
