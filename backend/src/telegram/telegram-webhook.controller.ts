import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { TelegramWebhookService } from './telegram-webhook.service';

@ApiTags('Telegram')
@Controller('telegram')
export class TelegramWebhookController {
  constructor(private readonly webhookService: TelegramWebhookService) {}

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Telegram bot webhook receiver',
    description:
      'Receives Update objects from the Telegram Bot API. Registered automatically on app startup via setWebhook. ' +
      'Handles /start, /top, /alerts, /stock [TICKER], /market commands.',
  })
  @ApiOkResponse({ schema: { example: { ok: true } } })
  async handleWebhook(@Body() body: Record<string, unknown>) {
    await this.webhookService.handleUpdate(body);
    return { ok: true };
  }
}
