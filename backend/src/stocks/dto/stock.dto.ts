import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StockDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'DANGCEM.LG', description: 'Yahoo Finance ticker symbol' })
  ticker: string;

  @ApiProperty({ example: 'Dangote Cement' })
  name: string;

  @ApiProperty({ example: 'Cement', enum: ['Banking', 'Telecom', 'Consumer Goods', 'Oil & Gas', 'Cement', 'Agriculture'] })
  sector: string;

  @ApiPropertyOptional({ example: 'large', enum: ['large', 'mid'] })
  marketCapTier: string | null;

  @ApiPropertyOptional({ example: 4, description: 'Graham quality score 0–7' })
  grahamScore: number | null;

  @ApiPropertyOptional({ example: '2.10', description: 'Current ratio (assets/liabilities)' })
  currentRatio: string | null;

  @ApiPropertyOptional({ example: '12.50', description: 'Price-to-earnings ratio' })
  peRatio: string | null;

  @ApiPropertyOptional({ example: '1.20', description: 'Price-to-book ratio' })
  pbRatio: string | null;
}

export class PriceSnapshotDto {
  @ApiProperty({ example: 101 })
  id: number;

  @ApiProperty({ example: 1, description: 'Foreign key to stocks.id' })
  stockId: number;

  @ApiProperty({ example: '452.00', description: 'Market price in NGN' })
  price: string;

  @ApiPropertyOptional({ example: 1850000, description: 'Trade volume for the period' })
  volume: number | null;

  @ApiProperty({ example: '2026-04-14T10:15:00.000Z' })
  timestamp: string;
}

export class FetchNowResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Price fetch triggered manually' })
  message: string;
}

export class StockWithPriceDto extends StockDto {
  @ApiPropertyOptional({
    example: 452.0,
    description: 'Most recent price snapshot in NGN (₦). Null if no snapshots exist yet.',
  })
  currentPrice: number | null;
}

export class OpportunityItemDto {
  @ApiProperty({ example: 'GTCO.LG', description: 'Yahoo Finance ticker symbol' })
  ticker: string;

  @ApiProperty({ example: 'Guaranty Trust Holding Company' })
  name: string;

  @ApiProperty({ example: 'Banking' })
  sector: string;

  @ApiProperty({ example: 45.2, description: 'Most recent price in NGN (₦)' })
  currentPrice: number;

  @ApiProperty({ example: 3.4, description: 'Volume spike z-score (> 2.0 to qualify)' })
  volumeSpikeScore: number;

  @ApiProperty({ example: 'positive', enum: ['positive', 'neutral'] })
  sentimentLabel: string;

  @ApiPropertyOptional({ example: 6, description: 'Graham quality score 0–7' })
  grahamScore: number | null;

  @ApiPropertyOptional({
    example: 28.4,
    description:
      '% below tracking-period high. Null when no price history exists. ' +
      'Labelled "since tracking" when history is < 365 days.',
  })
  distanceFrom52wHigh: number | null;

  @ApiProperty({ example: false, description: 'True when price history covers a full 365 days' })
  has52wHistory: boolean;

  @ApiProperty({ example: 'HIGH', enum: ['HIGH', 'MEDIUM', 'SPECULATIVE', 'DISTRIBUTION'] })
  convictionTier: string;
}
