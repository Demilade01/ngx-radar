import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { StocksService } from './stocks.service';
import { YahooService } from '../scraper/yahoo.service';
import { QuantService } from '../intelligence/quant.service';
import { StockDto, PriceSnapshotDto, FetchNowResponseDto } from './dto/stock.dto';
import { NewsItemWithSentimentDto } from '../alerts/dto/alert.dto';

@ApiTags('Stocks')
@Controller('stocks')
export class StocksController {
  constructor(
    private readonly stocksService: StocksService,
    private readonly yahooService: YahooService,
    private readonly quantService: QuantService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List all tracked NGX stocks',
    description: 'Returns all monitored NGX stocks with their latest fundamental data and Graham quality scores.',
  })
  @ApiOkResponse({ type: [StockDto] })
  findAll() {
    return this.stocksService.findAll();
  }

  @Get('fetch-now')
  @ApiOperation({
    summary: 'Manually trigger a Yahoo Finance price fetch',
    description:
      'Bypasses the cron schedule and immediately fetches the latest price and volume for all stocks from Yahoo Finance.',
  })
  @ApiOkResponse({ type: FetchNowResponseDto })
  async fetchNow() {
    await this.yahooService.fetchAndStorePrices();
    return { success: true, message: 'Price fetch triggered manually' };
  }

  @Get(':ticker/prices')
  @ApiOperation({
    summary: 'Get price & volume history for a stock',
    description: 'Returns the last 30 price snapshots for the given ticker, ordered newest first.',
  })
  @ApiParam({ name: 'ticker', example: 'DANGCEM.LG', description: 'Yahoo Finance ticker symbol' })
  @ApiOkResponse({ type: [PriceSnapshotDto] })
  @ApiNotFoundResponse({ description: 'No price data found for the given ticker' })
  async getPrices(@Param('ticker') ticker: string) {
    const snapshots = await this.stocksService.getPriceSnapshots(ticker);
    if (!snapshots.length) {
      throw new NotFoundException(`No price data found for ${ticker}`);
    }
    return snapshots;
  }

  @Get(':ticker/news')
  @ApiOperation({
    summary: 'Get recent news + sentiment for a stock',
    description: 'Returns the most recent news headlines for a given ticker with their Groq AI sentiment scores.',
  })
  @ApiParam({ name: 'ticker', example: 'MTNN.LG', description: 'Yahoo Finance ticker symbol' })
  @ApiOkResponse({ type: [NewsItemWithSentimentDto] })
  @ApiNotFoundResponse({ description: 'Stock not found' })
  async getNews(@Param('ticker') ticker: string) {
    const news = await this.stocksService.getNewsWithSentiment(ticker);
    return news;
  }

  @Get(':ticker/signals')
  @ApiOperation({
    summary: 'Get latest quantitative signals for a stock',
    description:
      'Returns the latest computed technical indicators and QuantScore (0–100) for the given ticker. Returns 404 if signals have not been computed yet (need ≥27 price snapshots).',
  })
  @ApiParam({ name: 'ticker', example: 'DANGCEM.LG', description: 'Yahoo Finance ticker symbol' })
  @ApiNotFoundResponse({ description: 'No signals computed yet for this ticker' })
  async getSignals(@Param('ticker') ticker: string) {
    const signals = await this.quantService.getSignalsForTicker(ticker);
    if (!signals) {
      throw new NotFoundException(`No signals computed yet for ${ticker}`);
    }
    return signals;
  }

  @Get(':ticker')
  @ApiOperation({
    summary: 'Get a single stock by ticker',
    description: 'Returns full detail for a single stock including sector, Graham score, and fundamental ratios.',
  })
  @ApiParam({ name: 'ticker', example: 'GTCO.LG', description: 'Yahoo Finance ticker symbol' })
  @ApiOkResponse({ type: StockDto })
  @ApiNotFoundResponse({ description: 'Stock not found' })
  async findOne(@Param('ticker') ticker: string) {
    const stock = await this.stocksService.findByTicker(ticker);
    if (!stock) {
      throw new NotFoundException(`Stock ${ticker} not found`);
    }
    return stock;
  }
}
