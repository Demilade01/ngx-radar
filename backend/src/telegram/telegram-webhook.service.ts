import { Injectable, Logger, OnApplicationBootstrap, Inject } from '@nestjs/common';
import { AlertsService } from '../alerts/alerts.service';
import { QuantService } from '../intelligence/quant.service';
import { StocksService } from '../stocks/stocks.service';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { DB } from '../database/database.module';
import * as schema from '../database/schema';
import { count, gte } from 'drizzle-orm';

// ─────────────────────────────────────────────
//  Telegram Update shape (minimal subset)
// ─────────────────────────────────────────────

interface TelegramMessage {
  chat: { id: number };
  text?: string;
}

interface TelegramUpdate {
  message?: TelegramMessage;
}

// ─────────────────────────────────────────────
//  Service
// ─────────────────────────────────────────────

@Injectable()
export class TelegramWebhookService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TelegramWebhookService.name);
  private readonly token = process.env.TELEGRAM_BOT_TOKEN!;
  private readonly apiBase = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

  constructor(
    private readonly alertsService: AlertsService,
    private readonly quantService: QuantService,
    private readonly stocksService: StocksService,
    @Inject(DB) private readonly db: NeonHttpDatabase<typeof schema>,
  ) {}

  // ─── Startup: register webhook with Telegram ────────────────────────────────

  async onApplicationBootstrap() {
    const herokuUrl = process.env.HEROKU_URL;

    if (!herokuUrl) {
      this.logger.warn(
        '[TELEGRAM WEBHOOK] HEROKU_URL not set — skipping webhook registration. ' +
        'Set HEROKU_URL=https://your-app.herokuapp.com to enable interactive bot commands.',
      );
      return;
    }

    if (!this.token) {
      this.logger.warn('[TELEGRAM WEBHOOK] TELEGRAM_BOT_TOKEN not set — skipping registration.');
      return;
    }

    const webhookUrl = `${herokuUrl}/api/telegram/webhook`;

    try {
      const res = await fetch(
        `${this.apiBase}/setWebhook?url=${encodeURIComponent(webhookUrl)}`,
        { method: 'GET', signal: AbortSignal.timeout(10000) },
      );
      const json = await res.json() as { ok: boolean; description?: string };

      if (json.ok) {
        this.logger.log(`[TELEGRAM WEBHOOK] Registered: ${webhookUrl}`);
      } else {
        this.logger.error(`[TELEGRAM WEBHOOK] Registration failed: ${json.description}`);
      }
    } catch (err) {
      this.logger.error(`[TELEGRAM WEBHOOK] Registration error: ${(err as Error).message}`);
    }
  }

  // ─── Dispatcher ─────────────────────────────────────────────────────────────

  async handleUpdate(body: Record<string, unknown>): Promise<void> {
    const update = body as TelegramUpdate;
    const message = update.message;
    if (!message?.text || !message.chat?.id) return;

    const chatId = message.chat.id;
    const text = message.text.trim();

    this.logger.log(`[TELEGRAM BOT] ${chatId}: ${text}`);

    if (text === '/start') {
      await this.handleStart(chatId);
    } else if (text === '/top') {
      await this.handleTop(chatId);
    } else if (text === '/alerts') {
      await this.handleAlerts(chatId);
    } else if (text.startsWith('/stock')) {
      const parts = text.split(/\s+/);
      const ticker = parts[1]?.toUpperCase();
      await this.handleStock(chatId, ticker);
    } else if (text === '/market') {
      await this.handleMarket(chatId);
    } else {
      await this.handleUnknown(chatId);
    }
  }

  // ─── Command handlers ────────────────────────────────────────────────────────

  private async handleStart(chatId: number): Promise<void> {
    await this.sendReply(
      chatId,
      `🤖 <b>NGX Radar Bot</b>\n\n` +
      `Track smart money on the Nigerian Stock Exchange.\n\n` +
      `<b>Available commands:</b>\n\n` +
      `/top — Top 5 quant signals right now\n` +
      `/alerts — Latest 5 anomaly alerts\n` +
      `/stock [TICKER] — Single stock summary (e.g. <code>/stock GTCO</code>)\n` +
      `/market — Market open/closed + today's stats`,
    );
  }

  private async handleTop(chatId: number): Promise<void> {
    try {
      const signals = await this.quantService.getTopSignals(5);

      if (!signals.length) {
        await this.sendReply(chatId, '📊 <b>Top Signals</b>\n\nNo quant signals computed yet. Run <code>/api/admin/quant-now</code> to trigger computation.');
        return;
      }

      const lines = signals.map((s, i) => {
        const score = s.quantScore !== null ? s.quantScore : '—';
        const sig = s.signal ?? '—';
        const rsi = s.rsi14 ? parseFloat(s.rsi14).toFixed(1) : '—';
        const mom = s.momentum20
          ? `${(parseFloat(s.momentum20) * 100).toFixed(1)}%`
          : '—';
        const sigEmoji = sig === 'BUY' ? '🟢' : sig === 'SELL' ? '🔴' : '🟡';
        return (
          `${i + 1}. <b>${s.ticker.replace('.LG', '')}</b> — Score: <b>${score}</b> ${sigEmoji} ${sig}\n` +
          `   RSI: ${rsi} | Momentum(20d): ${mom}`
        );
      });

      await this.sendReply(chatId, `📊 <b>Top 5 Quant Signals</b>\n\n${lines.join('\n\n')}`);
    } catch (err) {
      await this.sendReply(chatId, `⚠️ Could not fetch quant signals: ${(err as Error).message}`);
    }
  }

  private async handleAlerts(chatId: number): Promise<void> {
    try {
      const rows = await this.alertsService.findAll({ limit: 5, page: 1 });

      if (!rows.length) {
        await this.sendReply(chatId, '🚨 <b>Latest Alerts</b>\n\nNo anomaly alerts recorded yet.');
        return;
      }

      const tierEmoji: Record<string, string> = {
        HIGH: '🚨', MEDIUM: '⚠️', SPECULATIVE: '🟠', DISTRIBUTION: '🔴',
      };

      const lines = rows.map((r, i) => {
        const tier = r.alert.convictionTier ?? 'SPECULATIVE';
        const emoji = tierEmoji[tier] ?? '📊';
        const zScore = r.alert.volumeSpikeScore
          ? parseFloat(r.alert.volumeSpikeScore).toFixed(1)
          : '—';
        const when = new Date(r.alert.createdAt).toLocaleString('en-NG', {
          timeZone: 'Africa/Lagos',
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });
        return (
          `${i + 1}. ${emoji} <b>${r.ticker.replace('.LG', '')}</b> [${tier}]\n` +
          `   Z-Score: ${zScore}x | ${when} WAT`
        );
      });

      await this.sendReply(chatId, `🚨 <b>Latest 5 Alerts</b>\n\n${lines.join('\n\n')}`);
    } catch (err) {
      await this.sendReply(chatId, `⚠️ Could not fetch alerts: ${(err as Error).message}`);
    }
  }

  private async handleStock(chatId: number, ticker?: string): Promise<void> {
    if (!ticker) {
      await this.sendReply(
        chatId,
        '❌ Please provide a ticker symbol.\nExample: <code>/stock GTCO</code>',
      );
      return;
    }

    // Accept bare ticker (GTCO) or Yahoo format (GTCO.LG)
    const normalized = ticker.includes('.') ? ticker.toUpperCase() : `${ticker.toUpperCase()}.LG`;

    try {
      const [stock, signals] = await Promise.all([
        this.stocksService.findByTicker(normalized),
        this.quantService.getSignalsForTicker(normalized),
      ]);

      if (!stock) {
        await this.sendReply(chatId, `❌ Stock <code>${ticker}</code> not found. Use the NGX ticker, e.g. GTCO, DANGCEM, MTNN.`);
        return;
      }

      const graham = stock.grahamScore !== null ? `${stock.grahamScore}/7` : '—';
      const score = signals?.quantScore !== null ? signals?.quantScore ?? '—' : '—';
      const signal = signals?.signal ?? '—';
      const rsi = signals?.rsi14 ? parseFloat(signals.rsi14).toFixed(1) : '—';
      const mom = signals?.momentum20
        ? `${(parseFloat(signals.momentum20) * 100).toFixed(1)}%`
        : '—';
      const sigEmoji =
        signal === 'BUY' ? '🟢' : signal === 'SELL' ? '🔴' : signal === 'HOLD' ? '🟡' : '⚪';

      await this.sendReply(
        chatId,
        `📈 <b>${stock.ticker}</b> — ${stock.name}\n\n` +
        `<b>Sector:</b> ${stock.sector}\n` +
        `<b>Graham Score:</b> ${graham}\n` +
        `<b>Quant Score:</b> ${score} ${sigEmoji} ${signal}\n` +
        `<b>RSI (14):</b> ${rsi}\n` +
        `<b>Momentum (20d):</b> ${mom}`,
      );
    } catch (err) {
      await this.sendReply(chatId, `⚠️ Could not fetch stock data: ${(err as Error).message}`);
    }
  }

  private async handleMarket(chatId: number): Promise<void> {
    try {
      const now = new Date();
      const watHour = (now.getUTCHours() + 1) % 24;
      const dayOfWeek = now.getUTCDay();
      const marketOpen =
        dayOfWeek >= 1 && dayOfWeek <= 5 && watHour >= 9 && watHour < 15;
      const watTime = `${String(watHour).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')} WAT`;

      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);

      const [stockCount, alertCount, snapshotCount] = await Promise.all([
        this.db.select({ value: count() }).from(schema.stocks),
        this.db.select({ value: count() }).from(schema.anomalyEvents).where(gte(schema.anomalyEvents.createdAt, todayStart)),
        this.db.select({ value: count() }).from(schema.priceSnapshots).where(gte(schema.priceSnapshots.timestamp, todayStart)),
      ]);

      const statusIcon = marketOpen ? '✅ OPEN' : '🔴 CLOSED';

      await this.sendReply(
        chatId,
        `🏦 <b>NGX Market Status</b>\n\n` +
        `<b>Status:</b> ${statusIcon}\n` +
        `<b>Time:</b> ${watTime}\n` +
        `<b>Stocks Monitored:</b> ${stockCount[0]?.value ?? 0}\n` +
        `<b>Alerts Today:</b> ${alertCount[0]?.value ?? 0}\n` +
        `<b>Price Snapshots Today:</b> ${snapshotCount[0]?.value ?? 0}`,
      );
    } catch (err) {
      await this.sendReply(chatId, `⚠️ Could not fetch market status: ${(err as Error).message}`);
    }
  }

  private async handleUnknown(chatId: number): Promise<void> {
    await this.sendReply(
      chatId,
      `❓ <b>Unknown command</b>\n\n` +
      `Here's what I can do:\n\n` +
      `/top — Top 5 quant signals right now\n` +
      `/alerts — Latest 5 anomaly alerts\n` +
      `/stock [TICKER] — Single stock summary (e.g. <code>/stock GTCO</code>)\n` +
      `/market — Market open/closed + today's stats`,
    );
  }

  // ─── Sender ──────────────────────────────────────────────────────────────────

  async sendReply(chatId: number, text: string): Promise<void> {
    if (!this.token) {
      this.logger.warn('[TELEGRAM BOT] Token not set — skipping reply');
      return;
    }

    try {
      const res = await fetch(`${this.apiBase}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        const body = await res.text();
        this.logger.error(`[TELEGRAM BOT] sendMessage failed (${res.status}): ${body}`);
      }
    } catch (err) {
      this.logger.error(`[TELEGRAM BOT] Network error: ${(err as Error).message}`);
    }
  }
}
