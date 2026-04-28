import { Injectable, Logger, OnApplicationBootstrap, Inject } from '@nestjs/common';
import { AlertsService } from '../alerts/alerts.service';
import { QuantService } from '../intelligence/quant.service';
import { StocksService } from '../stocks/stocks.service';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { DB } from '../database/database.module';
import * as schema from '../database/schema';
import { count, gte } from 'drizzle-orm';
import Groq from 'groq-sdk';

// ─────────────────────────────────────────────
//  Telegram Update shapes
// ─────────────────────────────────────────────

interface TelegramMessage {
  chat: { id: number };
  text?: string;
}

interface TelegramCallbackQuery {
  id: string;
  from: { id: number };
  message?: { chat: { id: number } };
  data?: string;
}

interface TelegramUpdate {
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

// Inline keyboard types
type InlineButton = { text: string; callback_data: string };
type InlineKeyboard = { inline_keyboard: InlineButton[][] };

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

const SECTOR_EMOJI: Record<string, string> = {
  Banking: '🏦',
  Telecom: '📡',
  'Consumer Goods': '🛒',
  'Oil & Gas': '⛽',
  Cement: '🏗️',
  Agriculture: '🌾',
  Insurance: '🛡️',
  Healthcare: '🏥',
  Industrial: '⚙️',
  Other: '📦',
};

// ─────────────────────────────────────────────
//  Service
// ─────────────────────────────────────────────

@Injectable()
export class TelegramWebhookService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TelegramWebhookService.name);
  private readonly token = process.env.TELEGRAM_BOT_TOKEN!;
  private readonly apiBase = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
  private readonly groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  // Conversation memory: Map<chatId, conversation history>
  private conversationHistory = new Map<number, Array<{ role: 'user' | 'assistant'; content: string }>>();

  constructor(
    private readonly alertsService: AlertsService,
    private readonly quantService: QuantService,
    private readonly stocksService: StocksService,
    @Inject(DB) private readonly db: NeonHttpDatabase<typeof schema>,
  ) {}

  // ─── Startup ─────────────────────────────────────────────────────────────────

  async onApplicationBootstrap() {
    const herokuUrl = process.env.HEROKU_URL;

    if (!herokuUrl || !this.token) {
      this.logger.warn(
        '[TELEGRAM WEBHOOK] HEROKU_URL or TELEGRAM_BOT_TOKEN not set — skipping webhook registration.',
      );
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

  // ─── Dispatcher ──────────────────────────────────────────────────────────────

  async handleUpdate(body: Record<string, unknown>): Promise<void> {
    const update = body as TelegramUpdate;

    // Inline button tap
    if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
      return;
    }

    // Regular message
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
      const ticker = parts[1]; // undefined if no arg given
      await this.handleStock(chatId, ticker);
    } else if (text === '/market') {
      await this.handleMarket(chatId);
    } else {
      await this.handleChat(chatId, text);
    }
  }

  // ─── Callback query (button taps) ────────────────────────────────────────────

  private async handleCallbackQuery(query: TelegramCallbackQuery): Promise<void> {
    const chatId = query.message?.chat?.id;
    if (!chatId) return;

    // Always dismiss Telegram's loading spinner
    await this.answerCallbackQuery(query.id);

    const data = query.data ?? '';

    if (data.startsWith('stock:')) {
      const ticker = data.replace('stock:', '');
      // ticker here is already in TICKER.LG format — strip suffix for handleStock
      await this.handleStock(chatId, ticker.replace('.LG', ''));
    }
    // 'noop' callbacks (sector header buttons) are silently ignored
  }

  // ─── Command: /start ─────────────────────────────────────────────────────────

  private async handleStart(chatId: number): Promise<void> {
    await this.sendReply(
      chatId,
      `🤖 <b>NGX Radar Bot</b>\n\n` +
      `Track smart money on the Nigerian Stock Exchange with AI-powered Graham value investing insights.\n\n` +
      `<b>Available commands:</b>\n\n` +
      `/top — Top 5 quant signals right now\n` +
      `/alerts — Latest 5 anomaly alerts\n` +
      `/stock [TICKER] — Stock summary (tap to browse or type a name)\n` +
      `/market — Market open/closed + today's stats\n\n` +
      `<b>💡 Graham Advisor:</b> Just ask any question!\n` +
      `• "What should I buy now?"\n` +
      `• "Which stocks are undervalued?"\n` +
      `• "Show me high Graham score stocks"\n` +
      `• "What's a good long-term investment?"`,
    );
  }

  // ─── Command: /top ───────────────────────────────────────────────────────────

  private async handleTop(chatId: number): Promise<void> {
    try {
      const signals = await this.quantService.getTopSignals(5);

      if (!signals.length) {
        await this.sendReply(
          chatId,
          '📊 <b>Top Signals</b>\n\nNo quant signals computed yet.',
        );
        return;
      }

      const lines = signals.map((s, i) => {
        const score = s.quantScore ?? '—';
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
      await this.sendReply(chatId, `⚠️ Could not fetch signals: ${(err as Error).message}`);
    }
  }

  // ─── Command: /alerts ────────────────────────────────────────────────────────

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

  // ─── Command: /stock ─────────────────────────────────────────────────────────

  private async handleStock(chatId: number, rawTicker?: string): Promise<void> {
    // No ticker → show interactive picker
    if (!rawTicker) {
      await this.showStockPicker(chatId);
      return;
    }

    try {
      // 1. Exact ticker match (accepts "GTCO" or "GTCO.LG")
      const normalized = rawTicker.includes('.')
        ? rawTicker.toUpperCase()
        : `${rawTicker.toUpperCase()}.LG`;

      const exactMatch = await this.stocksService.findByTicker(normalized);

      // 2. Fuzzy fallback — match against ticker or company name
      const allStocks = exactMatch ? [] : await this.stocksService.findAll();
      const q = rawTicker.toLowerCase();
      const fuzzyMatch = exactMatch
        ? null
        : (allStocks.find(
            (s) =>
              s.ticker.toLowerCase().replace('.lg', '').includes(q) ||
              s.name.toLowerCase().includes(q),
          ) ?? null);

      const stock = exactMatch ?? fuzzyMatch;

      if (!stock) {
        await this.sendReply(
          chatId,
          `❌ No stock found for "<code>${rawTicker}</code>".\n\nTry /stock to browse all stocks, or search by company name (e.g. <code>/stock zenith</code>).`,
        );
        return;
      }

      const signals = await this.quantService.getSignalsForTicker(stock.ticker);

      const graham = stock.grahamScore !== null ? `${stock.grahamScore}/7` : '—';
      const score = signals?.quantScore ?? '—';
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
      await this.sendReply(chatId, `⚠️ Could not fetch stock: ${(err as Error).message}`);
    }
  }

  /** Show an inline keyboard grouped by sector so users can tap instead of type. */
  private async showStockPicker(chatId: number): Promise<void> {
    try {
      const stocks = await this.stocksService.findAll();

      // Group by sector, preserve insertion order
      const grouped = new Map<string, typeof stocks>();
      for (const stock of stocks) {
        if (!grouped.has(stock.sector)) grouped.set(stock.sector, []);
        grouped.get(stock.sector)!.push(stock);
      }

      const keyboard: InlineButton[][] = [];

      for (const [sector, sectorStocks] of grouped.entries()) {
        // Sector header — non-functional button used as a visual label
        keyboard.push([
          {
            text: `${SECTOR_EMOJI[sector] ?? '📊'} ${sector}`,
            callback_data: 'noop',
          },
        ]);

        // Stock buttons, 3 per row
        for (let i = 0; i < sectorStocks.length; i += 3) {
          const row = sectorStocks.slice(i, i + 3).map((s) => ({
            text: s.ticker.replace('.LG', ''),
            callback_data: `stock:${s.ticker}`,
          }));
          keyboard.push(row);
        }
      }

      await this.sendReply(
        chatId,
        `📈 <b>Select a stock</b>\n\nOr type <code>/stock &lt;name&gt;</code> to search — e.g. <code>/stock zenith</code>`,
        { inline_keyboard: keyboard },
      );
    } catch (err) {
      await this.sendReply(chatId, `⚠️ Could not load stock list: ${(err as Error).message}`);
    }
  }

  // ─── Command: /market ────────────────────────────────────────────────────────

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
        this.db
          .select({ value: count() })
          .from(schema.anomalyEvents)
          .where(gte(schema.anomalyEvents.createdAt, todayStart)),
        this.db
          .select({ value: count() })
          .from(schema.priceSnapshots)
          .where(gte(schema.priceSnapshots.timestamp, todayStart)),
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

  // ─── Command: chat / free-form ─────────────────────────────────────────────

  private async handleChat(chatId: number, userMessage: string): Promise<void> {
    try {
      // Show typing indicator
      await this.sendChatAction(chatId, 'typing');

      // Get conversation history for this chat
      let history = this.conversationHistory.get(chatId) || [];

      // Get quality stocks for context
      const stocks = await this.stocksService.findAll();
      const qualityStocks = stocks
        .filter((s) => s.grahamScore && s.grahamScore >= 4)
        .sort((a, b) => (b.grahamScore ?? 0) - (a.grahamScore ?? 0))
        .slice(0, 10)
        .map((s) => {
          const pe = s.peRatio ? parseFloat(s.peRatio).toFixed(1) : '—';
          const pb = s.pbRatio ? parseFloat(s.pbRatio).toFixed(2) : '—';
          return `• ${s.ticker.replace('.LG', '')}: Graham ${s.grahamScore}/7, P/E ${pe}x, P/B ${pb}x`;
        })
        .join('\n');

      // Get today's market alerts for real-time context
      const todayAlerts = await this.alertsService.getRecentAlertsForDigest(1);
      const marketMoves = todayAlerts
        .slice(0, 5)
        .map((a) => `• ${a.ticker}: ${a.summary}`)
        .join('\n');

      const systemPrompt = `You are Graham, a value investing mentor on the NGX. You speak naturally, think like Benjamin Graham, and remember previous conversations with this user.

PERSONALITY & TONE:
- Conversational, not robotic. Say "I think..." not "The data suggests..."
- Challenge assumptions: "Have you considered...?"
- Build on what was discussed earlier in the chat
- Show your reasoning: "Here's why DANGCEM interests me..."
- Be skeptical of hype and short-term trends
- Ask follow-up questions to understand user's goals

VALUE INVESTING PHILOSOPHY:
- Buy with margin of safety: "Even if earnings drop 20%, there's still value"
- Focus on fundamentals over price movements
- Long-term thinking (5+ years)
- Compare valuations: "DANGCEM trades at 8x vs market 12x"
- Diversify across sectors
- Only invest in what you understand

QUALITY NGX STOCKS (Graham Score ≥4):
${qualityStocks || 'No high-quality stocks available'}

TODAY'S MARKET MOVES:
${marketMoves || 'Market quiet today'}

CONVERSATION TECHNIQUES:
- Reference previous messages in chat: "As you mentioned earlier..."
- Build on ideas: "To expand on that thought..."
- Ask probing questions: "What's your investment timeline?", "How much risk can you handle?"
- Acknowledge different views: "I see your point, but..."

ALWAYS:
1. Add disclaimer: "This is educational, not financial advice"
2. Use emojis: 🟢 Buy 🟡 Hold 🔴 Avoid 💡 Insight ⚠️ Risk
3. Keep responses concise for Telegram (500 chars max)
4. Reference specific metrics (P/E, Graham Score, sector)`;

      // Build messages array with conversation history
      const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: userMessage },
      ];

      const completion = await this.groq.chat.completions.create({
        model: 'llama-3.1-405b-versatile',
        messages,
        temperature: 0.75,
        max_tokens: 500,
        top_p: 0.9,
      });

      const reply = completion.choices[0]?.message?.content?.trim() ?? 'Unable to process your question.';

      // Store in conversation history (keep last 12 messages for context window)
      history.push({ role: 'user', content: userMessage });
      history.push({ role: 'assistant', content: reply });
      if (history.length > 24) {
        history = history.slice(-24);
      }
      this.conversationHistory.set(chatId, history);

      await this.sendReply(chatId, `💡 <b>Graham Advisor</b>\n\n${reply}`);
    } catch (err) {
      this.logger.error(`[TELEGRAM CHAT] Error: ${(err as Error).message}`);
      await this.sendReply(
        chatId,
        `⚠️ <b>Error</b>\n\nUnable to process your question at the moment. Try again or use /help.`,
      );
    }
  }

  // ─── API helpers ─────────────────────────────────────────────────────────────

  /** Dismiss Telegram's loading spinner after a button tap. */
  private async answerCallbackQuery(callbackQueryId: string): Promise<void> {
    try {
      await fetch(`${this.apiBase}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQueryId }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Non-critical — just swallow
    }
  }

  private async sendChatAction(chatId: number, action: 'typing' | 'upload_photo' | 'upload_video'): Promise<void> {
    if (!this.token) return;

    try {
      await fetch(`${this.apiBase}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (err) {
      // Non-critical — just swallow
    }
  }

  async sendReply(
    chatId: number,
    text: string,
    replyMarkup?: InlineKeyboard,
  ): Promise<void> {
    if (!this.token) {
      this.logger.warn('[TELEGRAM BOT] Token not set — skipping reply');
      return;
    }

    try {
      const body: Record<string, unknown> = {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      };
      if (replyMarkup) body.reply_markup = replyMarkup;

      const res = await fetch(`${this.apiBase}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        const resBody = await res.text();
        this.logger.error(`[TELEGRAM BOT] sendMessage failed (${res.status}): ${resBody}`);
      }
    } catch (err) {
      this.logger.error(`[TELEGRAM BOT] Network error: ${(err as Error).message}`);
    }
  }
}
