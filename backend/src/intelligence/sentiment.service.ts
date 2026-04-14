import { Inject, Injectable, Logger } from '@nestjs/common';
import { isNull, isNotNull } from 'drizzle-orm';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import Groq from 'groq-sdk';
import { DB } from '../database/database.module';
import * as schema from '../database/schema';

const SYSTEM_PROMPT =
  'You are a financial analyst specializing in Nigerian markets. Analyze this headline and return JSON only — no explanation, no markdown: { "score": -1 to 1, "label": "positive"|"negative"|"neutral", "confidence": 0-1, "ticker": "string or null" }';

interface SentimentResult {
  score: number;
  label: 'positive' | 'negative' | 'neutral';
  confidence: number;
  ticker: string | null;
}

@Injectable()
export class SentimentService {
  private readonly logger = new Logger(SentimentService.name);
  private readonly groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  constructor(
    @Inject(DB) private readonly db: NeonHttpDatabase<typeof schema>,
  ) {}

  async scoreUnscoredNews(batchSize = 20): Promise<number> {
    // Find news_items that have no corresponding sentiment_scores row
    const unscoredNews = await this.db
      .select({
        id: schema.newsItems.id,
        headline: schema.newsItems.headline,
        tickerMentioned: schema.newsItems.tickerMentioned,
      })
      .from(schema.newsItems)
      .leftJoin(
        schema.sentimentScores,
        isNotNull(schema.newsItems.id),
      )
      .limit(batchSize);

    // Filter to only those without sentiment scores
    const allScored = await this.db
      .select({ newsItemId: schema.sentimentScores.newsItemId })
      .from(schema.sentimentScores);

    const scoredIds = new Set(allScored.map((s) => s.newsItemId));
    const toScore = unscoredNews.filter((n) => !scoredIds.has(n.id));

    if (!toScore.length) {
      this.logger.log('[SENTIMENT] No unscored news items');
      return 0;
    }

    let scored = 0;
    for (const item of toScore) {
      try {
        const result = await this.scoreHeadline(item.headline);
        await this.db.insert(schema.sentimentScores).values({
          newsItemId: item.id,
          score: String(result.score),
          label: result.label,
          confidence: String(result.confidence),
          createdAt: new Date(),
        });
        scored++;
      } catch (err) {
        this.logger.error(
          `[SENTIMENT] Failed to score news item ${item.id}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(`[SENTIMENT] Scored ${scored}/${toScore.length} items`);
    return scored;
  }

  async scoreHeadline(headline: string): Promise<SentimentResult> {
    const completion = await this.groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: headline },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 100,
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as Partial<SentimentResult>;

    return {
      score: Math.max(-1, Math.min(1, Number(parsed.score ?? 0))),
      label: (['positive', 'negative', 'neutral'].includes(parsed.label ?? '')
        ? parsed.label
        : 'neutral') as SentimentResult['label'],
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.5))),
      ticker: parsed.ticker ?? null,
    };
  }

  async getLatestSentimentForTicker(ticker: string): Promise<SentimentResult | null> {
    const rows = await this.db
      .select({
        score: schema.sentimentScores.score,
        label: schema.sentimentScores.label,
        confidence: schema.sentimentScores.confidence,
      })
      .from(schema.sentimentScores)
      .innerJoin(
        schema.newsItems,
        isNotNull(schema.sentimentScores.newsItemId),
      )
      .limit(1);

    if (!rows.length) return null;

    const row = rows[0];
    return {
      score: Number(row.score ?? 0),
      label: (row.label ?? 'neutral') as SentimentResult['label'],
      confidence: Number(row.confidence ?? 0.5),
      ticker,
    };
  }
}
