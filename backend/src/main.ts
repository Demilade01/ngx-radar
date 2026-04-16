import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');

  // CORS: allow the frontend origin (set ALLOWED_ORIGIN in Heroku config vars)
  // Falls back to localhost for local dev
  const allowedOrigins = (
    process.env.ALLOWED_ORIGIN ?? 'http://localhost:3000'
  ).split(',').map((o) => o.trim());

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'HEAD', 'OPTIONS', 'POST'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
    credentials: false,
  });

  const config = new DocumentBuilder()
    .setTitle('NGX Radar API')
    .setDescription(
      `**NGX Radar** is a private financial intelligence platform for the Nigerian Stock Exchange (NGX) — a "Mini-Bloomberg for Nigeria" that automatically detects where smart money is quietly flowing before the general market reacts.

---

## Endpoint Groups

### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | \`/api\` | Server health, market open/closed status, daily counters |

### Stocks
| Method | Path | Description |
|--------|------|-------------|
| GET | \`/api/stocks\` | All 20 monitored NGX stocks with Graham scores |
| GET | \`/api/stocks/:ticker\` | Single stock — full detail + fundamentals |
| GET | \`/api/stocks/:ticker/prices\` | Last 30 price + volume snapshots |
| GET | \`/api/stocks/:ticker/news\` | Recent news headlines + Groq AI sentiment scores |
| GET | \`/api/stocks/fetch-now\` | **[Dev]** Manually trigger Yahoo Finance price fetch |

### Alerts
| Method | Path | Description |
|--------|------|-------------|
| GET | \`/api/alerts\` | Paginated anomaly feed (filterable by tier + sector) |
| GET | \`/api/sectors/heatmap\` | Sector rotation heatmap — 6 sectors × 48h activity |

---

## Conviction Tiers
| Tier | Criteria | Color |
|------|----------|-------|
| \`HIGH\` | Volume spike + positive sentiment + Graham ≥ 5 | 🟢 #00E676 |
| \`MEDIUM\` | Volume spike + Graham 3–4 | 🟡 #FFD600 |
| \`SPECULATIVE\` | Volume spike only + Graham ≤ 2 | 🟠 #FF6D00 |
| \`DISTRIBUTION\` | Volume spike + negative sentiment | 🔴 #FF1744 |

## Intelligence Pipeline
1. Yahoo Finance prices scraped every **15 min** during market hours (WAT 9am–2:45pm Mon–Fri)
2. Nigerian financial news scraped every **30 min** from Nairametrics, BusinessDay, Vanguard
3. Groq Llama 3 sentiment analysis runs **hourly** on unscored headlines
4. Volume anomaly detection runs **hourly** — flags Z-score > 2.5 standard deviations
5. Telegram alerts sent on **HIGH** and **MEDIUM** conviction events
6. Graham fundamental scores refreshed every **Monday 8am WAT**`,
    )
    .setVersion('2.0.0')
    .setContact('NGX Radar', '', '')
    .setLicense('Private — All rights reserved', '')
    .addServer(`http://localhost:${process.env.PORT ?? 3001}`, 'Local Development')
    .addServer(
      process.env.PUBLIC_URL ?? 'https://ngx-radar.herokuapp.com',
      'Production (Heroku)',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'NGX Radar API Docs',
    customCss: `
      .swagger-ui .topbar { background-color: #0A0A0F; border-bottom: 1px solid #1E1E2E; }
      .swagger-ui .topbar .download-url-wrapper { display: none; }
      .swagger-ui .info .title { color: #00C853; }
      .swagger-ui .info .description p { color: #9E9E9E; }
      .swagger-ui .info .description table th { background: #111118; color: #00C853; }
      .swagger-ui .scheme-container { background: #111118; border: 1px solid #1E1E2E; }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
      tryItOutEnabled: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
