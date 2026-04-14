import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { ScraperModule } from '../scraper/scraper.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [ScraperModule, IntelligenceModule, AlertsModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
