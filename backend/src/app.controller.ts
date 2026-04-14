import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiProperty } from '@nestjs/swagger';
import { AppService } from './app.service';

export class StatusResponseDto {
  @ApiProperty({ example: 'ok' })
  status: string;

  @ApiProperty({ example: '2.0.0' })
  version: string;

  @ApiProperty({ example: false, description: 'True when NGX market is open (Mon–Fri 9am–2:30pm WAT)' })
  marketOpen: boolean;

  @ApiProperty({ example: 'CLOSED', enum: ['OPEN', 'CLOSED'] })
  marketStatus: string;

  @ApiProperty({ example: '07:42 WAT', description: 'Current time in West Africa Time' })
  watTime: string;

  @ApiProperty({ example: 20, description: 'Number of NGX stocks being monitored' })
  stocksMonitored: number;

  @ApiProperty({ example: 3, description: 'Anomaly alerts fired today' })
  alertsToday: number;

  @ApiProperty({ example: 80, description: 'Price snapshots captured today' })
  priceSnapshotsToday: number;

  @ApiProperty({ example: '2026-04-14T06:42:00.000Z' })
  timestamp: string;
}

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'API health & market status',
    description:
      'Returns the current server health, NGX market open/closed status, and today\'s activity counters. Useful for the frontend dashboard status bar.',
  })
  @ApiOkResponse({ type: StatusResponseDto })
  getStatus() {
    return this.appService.getStatus();
  }
}
