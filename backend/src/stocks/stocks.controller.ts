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
import { StockDto, PriceSnapshotDto, FetchNowResponseDto } from './dto/stock.dto';

@ApiTags('Stocks')
@Controller('stocks')
export class StocksController {
  constructor(
    private readonly stocksService: StocksService,
    private readonly yahooService: YahooService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List all tracked NGX stocks',
    description: 'Returns all 20 monitored NGX stocks with their latest fundamental data and Graham quality scores.',
  })
  @ApiOkResponse({ type: [StockDto] })
  findAll() {
    return this.stocksService.findAll();
  }

  @Get('fetch-now')
  @ApiOperation({
    summary: 'Manually trigger a Yahoo Finance price fetch',
    description:
      'Bypasses the cron schedule and immediately fetches the latest price and volume for all 20 stocks from Yahoo Finance. Useful for development and testing.',
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
  @ApiParam({
    name: 'ticker',
    example: 'DANGCEM.LG',
    description: 'Yahoo Finance ticker symbol (e.g. DANGCEM.LG)',
  })
  @ApiOkResponse({ type: [PriceSnapshotDto] })
  @ApiNotFoundResponse({ description: 'No price data found for the given ticker' })
  async getPrices(@Param('ticker') ticker: string) {
    const snapshots = await this.stocksService.getPriceSnapshots(ticker);
    if (!snapshots.length) {
      throw new NotFoundException(`No price data found for ${ticker}`);
    }
    return snapshots;
  }

  @Get(':ticker')
  @ApiOperation({
    summary: 'Get a single stock by ticker',
    description: 'Returns full detail for a single stock including sector, Graham score, and fundamental ratios.',
  })
  @ApiParam({
    name: 'ticker',
    example: 'GTCO.LG',
    description: 'Yahoo Finance ticker symbol (e.g. GTCO.LG)',
  })
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
