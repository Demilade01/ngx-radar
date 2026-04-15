import { Injectable, Logger } from '@nestjs/common';

interface AlertPayload {
  ticker: string;
  convictionTier: string;
  volumeZScore: number;
  sentimentLabel: string;
  grahamScore: number;
  sector: string;
  summary: string;
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly token = process.env.TELEGRAM_BOT_TOKEN!;
  private readonly chatId = process.env.TELEGRAM_CHAT_ID!;
  private readonly apiBase = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

  async sendAlert(payload: AlertPayload): Promise<void> {
    const tierEmoji: Record<string, string> = {
      HIGH: '🚨',
      MEDIUM: '⚠️',
      SPECULATIVE: '🟠',
      DISTRIBUTION: '🔴',
    };

    const emoji = tierEmoji[payload.convictionTier] ?? '📊';

    const text = `${emoji} <b>NGX RADAR ALERT</b>

<b>Ticker:</b> ${payload.ticker}
<b>Conviction:</b> ${payload.convictionTier}
<b>Volume Spike:</b> ${payload.volumeZScore.toFixed(1)}x 30-day average
<b>Sentiment:</b> ${payload.sentimentLabel}
<b>Graham Score:</b> ${payload.grahamScore}/7
<b>Sector:</b> ${payload.sector}

<i>${payload.summary}</i>`;

    await this.sendMessage(text);
  }

  async sendMorningDigest(alerts: AlertPayload[]): Promise<void> {
    if (!alerts.length) {
      await this.sendMessage(`📋 <b>NGX RADAR — Morning Digest</b>\n\nNo anomalies detected in the last 24 hours. Market appears quiet.`);
      return;
    }

    const highCount = alerts.filter((a) => a.convictionTier === 'HIGH').length;
    const mediumCount = alerts.filter((a) => a.convictionTier === 'MEDIUM').length;
    const distCount = alerts.filter((a) => a.convictionTier === 'DISTRIBUTION').length;

    const lines = alerts
      .slice(0, 10)
      .map(
        (a) =>
          `• <b>${a.ticker}</b> [${a.convictionTier}] z=${a.volumeZScore.toFixed(1)} — ${a.sentimentLabel}`,
      )
      .join('\n');

    const text = `📋 <b>NGX RADAR — Morning Digest</b>
${new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

<b>Last 24h Summary:</b>
🚨 HIGH: ${highCount} | ⚠️ MEDIUM: ${mediumCount} | 🔴 DISTRIBUTION: ${distCount}

<b>Top Alerts:</b>
${lines}${alerts.length > 10 ? `\n<i>+${alerts.length - 10} more alerts</i>` : ''}`;

    await this.sendMessage(text);
  }

  private async sendMessage(text: string): Promise<void> {
    if (!this.token || !this.chatId) {
      this.logger.warn('[TELEGRAM] BOT_TOKEN or CHAT_ID not set — skipping send');
      return;
    }

    try {
      const res = await fetch(`${this.apiBase}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text,
          parse_mode: 'HTML',
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        const body = await res.text();
        this.logger.error(`[TELEGRAM] Send failed (${res.status}): ${body}`);
      } else {
        this.logger.log('[TELEGRAM] Message sent');
      }
    } catch (err) {
      this.logger.error(`[TELEGRAM] Network error: ${(err as Error).message}`);
    }
  }
}
