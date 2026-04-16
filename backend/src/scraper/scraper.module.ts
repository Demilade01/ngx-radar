import { Module } from '@nestjs/common';
import { YahooService } from './yahoo.service';
import { NewsService } from './news.service';

@Module({
  providers: [YahooService, NewsService],
  exports: [YahooService, NewsService],
})
export class ScraperModule {}
