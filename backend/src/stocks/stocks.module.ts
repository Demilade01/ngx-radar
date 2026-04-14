import { Module } from '@nestjs/common';
import { StocksService } from './stocks.service';
import { StocksController } from './stocks.controller';
import { ScraperModule } from '../scraper/scraper.module';

@Module({
  imports: [ScraperModule],
  providers: [StocksService],
  controllers: [StocksController],
  exports: [StocksService],
})
export class StocksModule {}
