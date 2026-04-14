# NGX Radar — Backend

NestJS API server powering the NGX Radar intelligence platform. Scrapes live Nigerian stock prices, scores news sentiment with Groq AI, detects volume anomalies, and fires Telegram alerts for high-conviction events.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 11 (TypeScript) |
| Database | Neon (serverless PostgreSQL) via Drizzle ORM |
| Scheduler | `@nestjs/schedule` (cron jobs) |
| AI | Groq SDK — Llama 3 (sentiment analysis) |
| Price data | NGX Pulse API (`ngxpulse.ng`) |
| News | RSS Parser + Cheerio (HTML scraping) |
| Alerts | Telegram Bot API |
| Docs | Swagger UI (`@nestjs/swagger`) |

---

## Project Structure

```
src/
├── app.controller.ts       # GET / (health), GET /admin/detect-now, GET /admin/telegram-test
├── app.module.ts           # Root module, seeds stocks on bootstrap
├── app.service.ts          # Status endpoint logic
├── main.ts                 # Bootstrap, Swagger setup, global prefix
│
├── database/
│   ├── database.module.ts  # Drizzle + Neon provider (DB injection token)
│   └── schema.ts           # Drizzle table definitions
│
├── stocks/
│   ├── stocks.controller.ts  # GET /stocks, GET /stocks/:ticker, prices, news
│   ├── stocks.service.ts     # CRUD + seedStocks() from CSV
│   └── dto/
│
├── scraper/
│   ├── yahoo.service.ts    # NGX Pulse price fetcher (fetchAndStorePrices)
│   └── news.service.ts     # RSS + HTML news scraper, ticker detection
│
├── intelligence/
│   ├── anomaly.service.ts  # Z-score volume anomaly detection
│   ├── sentiment.service.ts# Groq Llama 3 sentiment scoring
│   └── graham.service.ts   # Benjamin Graham fundamental scoring (0–7)
│
├── alerts/
│   ├── alerts.controller.ts  # GET /alerts, GET /sectors/heatmap
│   ├── alerts.service.ts     # Alert queries, sector heatmap aggregation
│   ├── telegram.service.ts   # Telegram bot message sender
│   └── dto/
│
└── scheduler/
    └── scheduler.service.ts  # Cron orchestration for all pipeline steps
```

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Create `backend/.env`:

```env
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
GROQ_API_KEY=gsk_...
TELEGRAM_BOT_TOKEN=<bot-id>:<token>
TELEGRAM_CHAT_ID=<your-personal-telegram-user-id>
NGX_PULSE_API_KEY=ngxpulse_...
```

> **Telegram Chat ID:** Message [@userinfobot](https://t.me/userinfobot) on Telegram — it replies with your user ID.

### 3. Run database migrations

```bash
npx drizzle-kit push
```

### 4. Start the server

```bash
# Development (hot reload)
npm run start:dev

# Production
npm run build
npm run start:prod
```

Server starts on port `3001` by default (`PORT` env var overrides).

---

## API Reference

Full Swagger UI is available at `http://localhost:3001/api/docs` when running locally.

### Core Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api` | Health check, market status, today's counters |
| `GET` | `/api/stocks` | All tracked NGX stocks |
| `GET` | `/api/stocks/:ticker` | Single stock with Graham score |
| `GET` | `/api/stocks/:ticker/prices` | Price snapshot history |
| `GET` | `/api/stocks/:ticker/news` | News with sentiment scores |
| `GET` | `/api/alerts` | Paginated anomaly alert feed (filter by tier/sector) |
| `GET` | `/api/sectors/heatmap` | Sector rotation heatmap (48h window) |

### Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/detect-now` | Manually trigger full intelligence pipeline |
| `GET` | `/api/admin/telegram-test` | Send a test Telegram message to verify bot setup |

---

## Cron Schedule

All crons use `Africa/Lagos` timezone (WAT = UTC+1).

| Job | Schedule | Description |
|---|---|---|
| `fetchPrices` | `*/15 10-14 * * 1-5` | NGX Pulse price fetch every 15 min during market hours |
| `scrapeNews` | `*/30 * * * *` | RSS + web news scrape every 30 min |
| `runSentiment` | `*/30 * * * *` | Score unprocessed news items via Groq |
| `detectAnomalies` | `0 * * * *` | Z-score anomaly detection + Telegram alerts |

---

## Intelligence Engine

### Volume Anomaly Detection (`anomaly.service.ts`)

Uses Z-score statistics against rolling historical volume:

```
Z = (current_volume - mean_volume) / std_dev_volume
```

A Z-score ≥ 2.0 triggers an anomaly event. Higher Z-scores receive higher conviction tiers.

**Requires:** At least 5–10 price snapshots per stock before meaningful baselines form.

### Graham Scoring (`graham.service.ts`)

Scores each stock 0–7 based on Benjamin Graham's criteria:

| Check | Points |
|---|---|
| P/E ratio ≤ 15 | +1 |
| P/B ratio ≤ 1.5 | +1 |
| Current ratio ≥ 2.0 | +1 |
| No earnings loss in last 3 years | +1 |
| Positive EPS growth | +1 |
| Dividend history | +1 |
| Debt-to-equity ≤ 1.0 | +1 |

### Sentiment Scoring (`sentiment.service.ts`)

Calls Groq Llama 3 with each unscored news headline, returns:
- `sentimentLabel`: `BULLISH` / `BEARISH` / `NEUTRAL`
- `sentimentScore`: float –1.0 to +1.0
- `sentimentConfidence`: float 0.0 to 1.0

---

## Database Schema

| Table | Purpose |
|---|---|
| `stocks` | Master list of NGX-listed companies |
| `price_snapshots` | OHLCV snapshots per stock per timestamp |
| `news_items` | Scraped headlines with ticker association |
| `anomaly_events` | Detected anomalies with conviction tier + Groq summary |

---

## Deployment (Heroku)

```bash
# From repo root
git subtree push --prefix backend heroku main

# Or use the Procfile directly
heroku create ngx-radar-api
heroku config:set DATABASE_URL=... GROQ_API_KEY=... ...
git push heroku main
```

The `Procfile` runs: `web: node dist/src/main.js`
