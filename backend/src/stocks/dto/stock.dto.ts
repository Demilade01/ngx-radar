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
