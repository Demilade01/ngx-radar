import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AnomalyEventDto {
  @ApiProperty({ example: 42 })
  id: number;

  @ApiProperty({ example: 1, description: 'Foreign key to stocks.id' })
  stockId: number;

  @ApiProperty({ example: 'VOLUME_SPIKE', enum: ['VOLUME_SPIKE', 'SECTOR_ROTATION'] })
  type: string | null;

  @ApiProperty({ example: '3.72', description: 'Volume Z-score — standard deviations above 30-day mean' })
  volumeSpikeScore: string | null;

  @ApiPropertyOptional({ example: '0.65', description: 'Aggregated sentiment score (-1 to 1)' })
  sentimentScore: string | null;

  @ApiPropertyOptional({ example: 5, description: 'Graham quality score (0–7) at time of alert' })
  grahamScore: number | null;

  @ApiProperty({
    example: 'HIGH',
    enum: ['HIGH', 'MEDIUM', 'SPECULATIVE', 'DISTRIBUTION'],
    description: 'Conviction tier assigned by the intelligence engine',
  })
  convictionTier: string | null;

  @ApiPropertyOptional({
    example: 'MTN Nigeria seeing unusual volume ahead of earnings announcement.',
    description: 'One-sentence AI-generated summary of the anomaly',
  })
  summary: string | null;

  @ApiProperty({ example: '2026-04-14T10:00:00.000Z' })
  createdAt: string;
}

export class AlertFeedItemDto {
  @ApiProperty({ type: AnomalyEventDto })
  alert: AnomalyEventDto;

  @ApiProperty({ example: 'MTNN.LG', description: 'Yahoo Finance ticker symbol' })
  ticker: string;

  @ApiProperty({ example: 'MTN Nigeria' })
  stockName: string;

  @ApiProperty({ example: 'Telecom', enum: ['Banking', 'Telecom', 'Consumer Goods', 'Oil & Gas', 'Cement', 'Agriculture'] })
  sector: string;
}

export class SectorHeatmapItemDto {
  @ApiProperty({
    example: 'Banking',
    enum: ['Banking', 'Telecom', 'Consumer Goods', 'Oil & Gas', 'Cement', 'Agriculture'],
  })
  sector: string;

  @ApiProperty({ example: 4, description: 'Number of anomaly events in the last 48 hours' })
  count: number;

  @ApiProperty({ example: 4.2, description: 'Highest volume Z-score recorded in this sector (48h)' })
  maxSpike: number;

  @ApiProperty({
    example: 'HIGH',
    enum: ['HIGH', 'MEDIUM', 'LOW', 'NONE'],
    description: 'Computed intensity level — used for heatmap cell coloring on the frontend',
  })
  intensity: string;
}

export class NewsItemWithSentimentDto {
  @ApiProperty({ example: 101 })
  id: number;

  @ApiProperty({ example: 'MTN Nigeria records 40% revenue growth in Q1 2026' })
  headline: string;

  @ApiProperty({
    example: 'nairametrics',
    enum: ['nairametrics', 'businessday', 'vanguard'],
    description: 'Source publication',
  })
  source: string | null;

  @ApiProperty({ example: 'https://nairametrics.com/2026/04/14/mtn-nigeria-revenue...' })
  url: string | null;

  @ApiProperty({ example: '2026-04-14T08:30:00.000Z' })
  scrapedAt: string;

  @ApiPropertyOptional({
    example: '0.82',
    description: 'Groq AI sentiment score (-1 = very negative, 0 = neutral, 1 = very positive)',
  })
  sentimentScore: string | null;

  @ApiPropertyOptional({
    example: 'positive',
    enum: ['positive', 'negative', 'neutral'],
  })
  sentimentLabel: string | null;

  @ApiPropertyOptional({ example: '0.91', description: 'Model confidence in the sentiment label (0–1)' })
  sentimentConfidence: string | null;
}
