# NGX Radar — Frontend

Next.js 16 (App Router) dashboard for the NGX Radar financial intelligence platform. Displays live NGX stock data, anomaly alerts, sector rotation heatmaps, and Graham fundamental scores — all behind a single-user authentication wall.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React 19) |
| Styling | TailwindCSS v4 (custom dark-theme CSS variables) |
| Auth | NextAuth.js v5 (Credentials provider) |
| Charts | Recharts |
| Icons | Lucide React |
| UI primitives | shadcn/ui + Radix UI |
| Utilities | date-fns · clsx · tailwind-merge |

---

## Project Structure

```
app/
├── login/                  # Login page (username + password)
├── page.tsx                # Dashboard — stats, heatmap, alert feed, watchlist
├── alerts/
│   └── page.tsx            # Full alerts listing with tier/sector filters
├── stocks/
│   ├── page.tsx            # All-stocks watchlist with search + sector filter
│   └── [ticker]/
│       └── page.tsx        # Individual stock detail (chart, Graham, news)
├── api/auth/[...nextauth]/ # NextAuth.js route handler
├── icon.jpg                # Auto-detected favicon (Next.js App Router)
├── globals.css             # Brand palette via CSS custom properties
└── layout.tsx              # Root layout (dark theme, fonts, metadata)

components/
├── Navbar.tsx              # Sticky top nav — logo, links, market status pill, sign out
├── AlertFeed.tsx           # Scrollable list of recent anomaly alerts
├── SectorHeatmap.tsx       # Clickable grid of NGX sectors by intensity
├── ConvictionBadge.tsx     # HIGH / MEDIUM / SPECULATIVE / DISTRIBUTION pill
├── SentimentBadge.tsx      # BULLISH / BEARISH / NEUTRAL pill
├── StockChart.tsx          # Recharts dual-axis price + volume chart
├── GrahamScoreCard.tsx     # Graham score breakdown (0–7)
├── NewsTimeline.tsx        # News headlines with sentiment labels
└── DetectNowButton.tsx     # Admin button to trigger anomaly detection pipeline

lib/
├── api.ts                  # Typed fetch wrappers for all backend endpoints
├── auth.ts                 # NextAuth.js Credentials provider config
├── types.ts                # TypeScript DTOs matching backend response shapes
└── utils.ts                # cn() helper (clsx + tailwind-merge)
```

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Create `frontend/.env`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
AUTH_SECRET=<random-32-char-string>
AUTH_USERNAME=admin
AUTH_PASSWORD=<your-password>
```

Generate `AUTH_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Start the dev server

```bash
npm run dev
```

Dashboard runs on `http://localhost:3000`.

---

## Pages

### `/` — Dashboard

- **Market status bar** — NGX open/closed with WAT clock
- **Stat cards** — Stocks tracked, alerts today, price snapshots, feed items
- **Sector Heatmap** — 6 NGX sectors coloured by anomaly intensity (48h window)
- **Alert Feed** — Latest anomaly events with conviction badges + Z-scores
- **Detect Now button** — Manually triggers the backend intelligence pipeline
- **Watchlist** — First 30 stocks; "View all" links to `/stocks`

### `/stocks` — Stocks Watchlist

- Search by ticker or company name
- Filter by sector (auto-populated from database)
- Graham score column (colour-coded 0–7)
- Mobile: 2-column card grid; Desktop: full table

### `/stocks/[ticker]` — Stock Detail

- Price header with latest price + change %
- Dual-axis Recharts price/volume chart
- Graham score card with criteria breakdown
- News timeline with sentiment labels

### `/alerts` — Alert Feed

- Tier filter: `ALL` / `HIGH` / `MEDIUM` / `SPECULATIVE` / `DISTRIBUTION`
- Sector filter with all NGX sectors
- Mobile: card layout; Desktop: sortable table
- Pagination (25 per page)

### `/login` — Authentication

- Single-user credentials (configured via env vars)
- Redirect to dashboard on success
- All routes except `/login` are protected by `middleware.ts`

---

## Color Palette

| Token | Value | Usage |
|---|---|---|
| Background | `#0A0A0F` | Page background |
| Card | `#13131A` | Component surfaces |
| Primary | `#00B4D8` | Interactive elements, tickers |
| Secondary | `#1565C0` | Accent elements |
| Bullish | `#00E676` | Positive price, open market, HIGH alerts |
| Warning | `#FFD600` | MEDIUM alerts, moderate activity |
| Spike | `#FF6D00` | Anomaly spikes, Z-score highlights |
| Bearish | `#FF1744` | Negative price change, DISTRIBUTION alerts |

---

## Authentication

Uses NextAuth.js v5 with a Credentials provider. Configuration lives in `lib/auth.ts`.

- Login credentials are stored in environment variables (`AUTH_USERNAME`, `AUTH_PASSWORD`)
- `middleware.ts` protects all routes except `/login` and `/api/auth/**`
- Session is JWT-based with a 7-day expiry

---

## API Layer (`lib/api.ts`)

All backend calls go through typed wrappers with `cache: "no-store"`:

```ts
api.getStatus()                       // GET /api
api.getStocks()                       // GET /api/stocks
api.getStock(ticker)                  // GET /api/stocks/:ticker
api.getStockPrices(ticker)            // GET /api/stocks/:ticker/prices
api.getStockNews(ticker)              // GET /api/stocks/:ticker/news
api.getAlerts({ tier, sector, page }) // GET /api/alerts
api.getSectorHeatmap()                // GET /api/sectors/heatmap
api.detectNow()                       // GET /api/admin/detect-now
api.telegramTest()                    // GET /api/admin/telegram-test
```

---

## Deployment (Vercel)

1. Push to GitHub
2. Import the repo in the Vercel dashboard
3. Set **Root Directory** to `frontend`
4. Add environment variables:
   - `NEXT_PUBLIC_API_URL` → your Heroku backend URL
   - `AUTH_SECRET`, `AUTH_USERNAME`, `AUTH_PASSWORD`
5. Deploy

> Ensure the backend's CORS config allows your Vercel domain.
