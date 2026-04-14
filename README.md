# NGX Radar

> Private financial intelligence platform for the Nigerian Stock Exchange (NGX).
> Detect where smart money is quietly flowing before the general market reacts.

---

## Overview

NGX Radar is a full-stack monorepo consisting of two services:

| Service | Stack | Purpose |
|---|---|---|
| `backend/` | NestJS · TypeScript · Drizzle ORM · Neon PostgreSQL | Data pipeline, intelligence engine, REST API |
| `frontend/` | Next.js 16 · TailwindCSS · NextAuth.js | Dashboard, alerts feed, stock detail pages |

The system runs autonomously on cron schedules — scraping NGX price data every 15 minutes during market hours, scoring news sentiment via Groq AI, detecting volume anomalies using Z-score statistics, and firing Telegram alerts for high-conviction events.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     NGX Radar                       │
│                                                     │
│  ┌──────────────────┐      ┌──────────────────────┐ │
│  │     Backend      │      │      Frontend        │ │
│  │   (NestJS API)   │◄─────│   (Next.js 16 App)   │ │
│  │                  │ REST │                      │ │
│  │  ┌────────────┐  │      │  Dashboard           │ │
│  │  │  Scraper   │  │      │  Stocks Watchlist    │ │
│  │  │  (NGX      │  │      │  Alert Feed          │ │
│  │  │   Pulse)   │  │      │  Sector Heatmap      │ │
│  │  └─────┬──────┘  │      │  Stock Detail        │ │
│  │        │         │      └──────────────────────┘ │
│  │  ┌─────▼──────┐  │                               │
│  │  │Intelligence│  │                               │
│  │  │  Engine    │  │                               │
│  │  │ Sentiment  │  │                               │
│  │  │ Graham     │  │                               │
│  │  │ Anomaly    │  │                               │
│  │  └─────┬──────┘  │                               │
│  │        │         │                               │
│  │  ┌─────▼──────┐  │                               │
│  │  │  Telegram  │  │                               │
│  │  │   Alerts   │  │                               │
│  │  └────────────┘  │                               │
│  └──────────────────┘                               │
└─────────────────────────────────────────────────────┘
```

---

## Monorepo Structure

```
ngx-radar/
├── backend/                  # NestJS API server
│   ├── src/
│   │   ├── alerts/           # Anomaly events, sector heatmap, Telegram bot
│   │   ├── database/         # Drizzle ORM + Neon PostgreSQL setup
│   │   ├── intelligence/     # Sentiment, Graham scoring, anomaly detection
│   │   ├── scheduler/        # Cron job orchestration
│   │   ├── scraper/          # NGX Pulse price scraper + news RSS scraper
│   │   ├── stocks/           # Stock CRUD, seeding from CSV
│   │   ├── app.controller.ts # Health, status + admin endpoints
│   │   └── main.ts
│   ├── nigerian_companies.csv
│   └── Procfile              # Heroku deployment
│
└── frontend/                 # Next.js 16 App Router
    ├── app/
    │   ├── alerts/           # Alerts listing page with filters
    │   ├── login/            # Authentication page
    │   ├── stocks/           # All stocks watchlist + stock detail
    │   └── page.tsx          # Main dashboard
    ├── components/           # UI components
    └── lib/                  # API client, auth config, TypeScript types
```

---

## Intelligence Pipeline

Each step runs automatically on a schedule:

| Step | Cron | What it does |
|---|---|---|
| **Price scraping** | Every 15 min (Mon–Fri 10:00–14:30 WAT) | Fetches live NGX prices from NGX Pulse API |
| **News scraping** | Every 30 min | Scrapes financial news RSS feeds, detects stock tickers |
| **Sentiment scoring** | Every 30 min | Calls Groq (Llama 3) to score news as bullish/bearish/neutral |
| **Anomaly detection** | Every hour | Z-score volume analysis across all stocks |
| **Graham scoring** | On demand | Calculates Benjamin Graham fundamental score (0–7) per stock |
| **Telegram alerts** | On anomaly | Sends formatted alerts for HIGH/MEDIUM conviction events |

### Conviction Tiers

| Tier | Criteria |
|---|---|
| `HIGH` | Volume spike + positive sentiment + Graham score 5–7 |
| `MEDIUM` | Volume spike + Graham score 3–4 |
| `SPECULATIVE` | Volume spike only, Graham score 0–2 |
| `DISTRIBUTION` | Volume spike + negative sentiment (smart money exiting) |

---

## Quick Start

### Prerequisites

- Node.js 20+
- A [Neon](https://neon.tech) PostgreSQL database
- A [Groq](https://console.groq.com) API key (free tier)
- A Telegram bot token + your chat ID (from [@BotFather](https://t.me/BotFather))
- An [NGX Pulse](https://ngxpulse.ng) API key (free tier)

### 1. Backend

```bash
cd backend
cp .env.example .env   # fill in your keys
npm install
npm run start:dev
```

API runs on `http://localhost:3001`. Swagger docs at `http://localhost:3001/api/docs`.

### 2. Frontend

```bash
cd frontend
cp .env.example .env   # set NEXT_PUBLIC_API_URL and AUTH_SECRET
npm install
npm run dev
```

Dashboard runs on `http://localhost:3000`.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `GROQ_API_KEY` | Groq API key for Llama 3 sentiment analysis |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | Your personal Telegram user ID (from @userinfobot) |
| `NGX_PULSE_API_KEY` | NGX Pulse API key for live stock prices |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend base URL (e.g. `http://localhost:3001`) |
| `AUTH_SECRET` | Random secret for NextAuth.js session encryption |
| `AUTH_USERNAME` | Dashboard login username |
| `AUTH_PASSWORD` | Dashboard login password |

---

## Deployment

| Service | Platform | Command |
|---|---|---|
| Backend | Heroku | `git push heroku main` (uses `Procfile`) |
| Frontend | Vercel | Connect repo, set env vars in dashboard |

---

## Tech Stack

**Backend:** NestJS · TypeScript · Drizzle ORM · Neon (PostgreSQL) · `@nestjs/schedule` · Groq SDK · Cheerio · RSS Parser · Telegram Bot API · Swagger

**Frontend:** Next.js 16 (App Router) · React 19 · TailwindCSS v4 · NextAuth.js v5 · Recharts · Lucide Icons · shadcn/ui · date-fns
