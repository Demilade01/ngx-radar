import { Module } from '@nestjs/common';
import { SentimentService } from './sentiment.service';
import { GrahamService } from './graham.service';
import { AnomalyService } from './anomaly.service';
import { ScraperModule } from '../scraper/scraper.module';

@Module({
  imports: [ScraperModule],
  providers: [SentimentService, GrahamService, AnomalyService],
  exports: [SentimentService, GrahamService, AnomalyService],
})
export class IntelligenceModule {}
