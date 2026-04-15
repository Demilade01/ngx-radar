import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiProperty } from '@nestjs/swagger';
import { AppService } from './app.service';
import { AnomalyService } from './intelligence/anomaly.service';
import { TelegramService } from './alerts/telegram.service';
import { QuantService } from './intelligence/quant.service';

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
  constructor(
    private readonly appService: AppService,
    private readonly anomalyService: AnomalyService,
    private readonly telegramService: TelegramService,
    private readonly quantService: QuantService,
  ) {}


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

  @Get('admin/detect-now')
  @ApiOperation({
    summary: '[Admin] Manually trigger anomaly detection',
    description:
      'Runs the full intelligence pipeline immediately: scores unscored news, detects volume anomalies, assigns conviction tiers, saves alerts, and sends Telegram notifications for HIGH/MEDIUM events. Useful for testing without waiting for the hourly cron.',
  })
  @ApiOkResponse({
    schema: {
      example: { triggered: true, eventsDetected: 3, timestamp: '2026-04-14T10:00:00.000Z' },
    },
  })
  async detectNow() {
    const results = await this.anomalyService.detectAll();
    return {
      triggered: true,
      eventsDetected: results.length,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('admin/telegram-test')
  @ApiOperation({
    summary: '[Admin] Send a test Telegram message',
    description:
      'Sends a test ping to your configured TELEGRAM_CHAT_ID to verify the bot token and chat ID are correctly set up.',
  })
  @ApiOkResponse({
    schema: { example: { sent: true } },
  })
  async telegramTest() {
    await this.telegramService['sendMessage'](
      `🔔 <b>Ngix — Connection Test</b>\n\nTelegram alerts are working correctly.\n<i>${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })} WAT</i>`,
    );
    return { sent: true };
  }

  @Get('admin/quant-now')
  @ApiOperation({
    summary: '[Admin] Manually trigger QuantScore computation for all stocks',
    description:
      'Immediately runs the quantitative signal computation pipeline for all tracked stocks. Useful for testing without waiting for the 15-min cron. Stocks with fewer than 27 price snapshots are skipped.',
  })
  @ApiOkResponse({
    schema: {
      example: { triggered: true, updated: 18, skipped: 2, timestamp: '2026-04-15T10:00:00.000Z' },
    },
  })
  async quantNow() {
    const result = await this.quantService.updateAllSignals();
    return {
      triggered: true,
      updated: result.updated,
      skipped: result.skipped,
      timestamp: new Date().toISOString(),
    };
  }
}
