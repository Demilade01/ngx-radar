import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiOkResponse,
  ApiExtraModels,
} from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { AlertFeedItemDto, AnomalyEventDto, SectorHeatmapItemDto } from './dto/alert.dto';

@ApiTags('Alerts')
@ApiExtraModels(AnomalyEventDto)
@Controller()
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get('alerts')
  @ApiOperation({
    summary: 'Paginated anomaly alert feed',
    description: `Returns anomaly events ordered newest-first with their joined stock details.

Each item contains:
- **alert** — the full anomaly event (type, volumeSpikeScore, convictionTier, summary, etc.)
- **ticker** — the stock's Yahoo Finance symbol
- **stockName** — full company name
- **sector** — NGX sector

**Conviction tiers:**
- \`HIGH\` — volume spike + positive sentiment + Graham score 5–7
- \`MEDIUM\` — volume spike + Graham score 3–4
- \`SPECULATIVE\` — volume spike only, Graham score 0–2
- \`DISTRIBUTION\` — volume spike + negative sentiment (smart money exiting)`,
  })
  @ApiQuery({
    name: 'tier',
    required: false,
    example: 'HIGH',
    enum: ['HIGH', 'MEDIUM', 'SPECULATIVE', 'DISTRIBUTION'],
    description: 'Filter by conviction tier',
  })
  @ApiQuery({
    name: 'sector',
    required: false,
    example: 'Banking',
    enum: ['Banking', 'Telecom', 'Consumer Goods', 'Oil & Gas', 'Cement', 'Agriculture'],
    description: 'Filter by stock sector',
  })
  @ApiQuery({ name: 'page', required: false, example: 1, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, example: 20, description: 'Items per page, max 100 (default: 20)' })
  @ApiOkResponse({
    type: [AlertFeedItemDto],
    description: 'Array of alert feed items with joined stock details',
  })
  findAll(
    @Query('tier') tier?: string,
    @Query('sector') sector?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.alertsService.findAll({
      tier,
      sector,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('sectors/heatmap')
  @ApiOperation({
    summary: 'Sector rotation heatmap data',
    description: `Returns all 6 NGX sectors with their anomaly activity for the last 48 hours.

**Intensity levels** (used for frontend heatmap cell coloring):
- \`HIGH\` — 3+ events or max Z-score ≥ 4.0 → color: \`#00E676\`
- \`MEDIUM\` — 2+ events or max Z-score ≥ 2.5 → color: \`#FFD600\`
- \`LOW\` — 1 event → color: \`#FF6D00\`
- \`NONE\` — no activity → color: \`#1E1E2E\`

All 6 sectors are always returned even if count = 0.`,
  })
  @ApiOkResponse({
    type: [SectorHeatmapItemDto],
    description: 'All 6 sectors with count, maxSpike, and intensity',
  })
  getSectorHeatmap() {
    return this.alertsService.getSectorHeatmap();
  }
}
