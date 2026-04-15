import {
  pgTable,
  serial,
  text,
  numeric,
  bigint,
  timestamp,
  integer,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const stocks = pgTable('stocks', {
  id: serial('id').primaryKey(),
  ticker: text('ticker').unique().notNull(),
  name: text('name').notNull(),
  sector: text('sector').notNull(),
  marketCapTier: text('market_cap_tier'),
  grahamScore: integer('graham_score').default(0),
  currentRatio: numeric('current_ratio'),
  peRatio: numeric('pe_ratio'),
  pbRatio: numeric('pb_ratio'),
});

export const priceSnapshots = pgTable('price_snapshots', {
  id: serial('id').primaryKey(),
  stockId: integer('stock_id')
    .references(() => stocks.id)
    .notNull(),
  price: numeric('price').notNull(),
  volume: bigint('volume', { mode: 'number' }),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

export const newsItems = pgTable('news_items', {
  id: serial('id').primaryKey(),
  tickerMentioned: text('ticker_mentioned'),
  headline: text('headline').notNull(),
  source: text('source'),
  url: text('url'),
  scrapedAt: timestamp('scraped_at').defaultNow().notNull(),
});

export const sentimentScores = pgTable('sentiment_scores', {
  id: serial('id').primaryKey(),
  newsItemId: integer('news_item_id')
    .references(() => newsItems.id)
    .notNull(),
  score: numeric('score'),
  label: text('label'),
  confidence: numeric('confidence'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const anomalyEvents = pgTable('anomaly_events', {
  id: serial('id').primaryKey(),
  stockId: integer('stock_id')
    .references(() => stocks.id)
    .notNull(),
  type: text('type'),
  volumeSpikeScore: numeric('volume_spike_score'),
  sentimentScore: numeric('sentiment_score'),
  grahamScore: integer('graham_score'),
  convictionTier: text('conviction_tier'),
  summary: text('summary'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const technicalSignals = pgTable(
  'technical_signals',
  {
    id: serial('id').primaryKey(),
    stockId: integer('stock_id')
      .references(() => stocks.id)
      .notNull(),
    rsi14: numeric('rsi14'),
    macdLine: numeric('macd_line'),
    macdSignal: numeric('macd_signal'),
    macdHistogram: numeric('macd_histogram'),
    bbUpper: numeric('bb_upper'),
    bbLower: numeric('bb_lower'),
    bbPosition: numeric('bb_position'),
    sma20: numeric('sma20'),
    sma50: numeric('sma50'),
    trendSlope: numeric('trend_slope'),
    trendR2: numeric('trend_r2'),
    momentum5: numeric('momentum5'),
    momentum20: numeric('momentum20'),
    meanReversionZ: numeric('mean_reversion_z'),
    quantScore: integer('quant_score'),
    signal: text('signal'), // 'BUY' | 'SELL' | 'HOLD'
    computedAt: timestamp('computed_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('technical_signals_stock_id_idx').on(table.stockId)],
);
