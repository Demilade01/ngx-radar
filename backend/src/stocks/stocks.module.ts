import { Module } from '@nestjs/common';
import { StocksService } from './stocks.service';
import { StocksController } from './stocks.controller';
import { QuantController } from './quant.controller';
import { ScraperModule } from '../scraper/scraper.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';

@Module({
  imports: [ScraperModule, IntelligenceModule],
  providers: [StocksService],
  controllers: [StocksController, QuantController],
  exports: [StocksService],
})
export class StocksModule {}
