import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('NGX Radar API')
    .setDescription(
      `**NGX Radar** is a private financial intelligence platform for the Nigerian Stock Exchange (NGX).
      
It automatically detects where smart money is quietly flowing before the general market reacts — 
a "Mini-Bloomberg for Nigeria" powered by volume anomaly detection, AI sentiment scoring, and Graham fundamental analysis.

### Phase 1 Endpoints (live)
- **Stocks** — list, detail, price history for all 20 monitored NGX tickers
- **Fetch Now** — manually trigger a Yahoo Finance price pull (dev helper)

### Coming in Phase 2
- Anomaly alerts with conviction tiers (HIGH / MEDIUM / SPECULATIVE / DISTRIBUTION)
- Groq AI sentiment scores from Nigerian financial news
- Sector rotation heatmap
- Telegram alert delivery`,
    )
    .setVersion('1.0')
    .setContact('NGX Radar', '', '')
    .setLicense('Private', '')
    .addServer(`http://localhost:${process.env.PORT ?? 3001}`, 'Local')
    .addServer('https://ngx-radar-backend.herokuapp.com', 'Production')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'NGX Radar API Docs',
    customCss: `
      .swagger-ui .topbar { background-color: #0A0A0F; }
      .swagger-ui .topbar .download-url-wrapper { display: none; }
      .swagger-ui .info .title { color: #00C853; }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
    },
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
