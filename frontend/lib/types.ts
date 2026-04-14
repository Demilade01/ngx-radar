export interface Stock {
  id: number;
  ticker: string;
  name: string;
  sector: string;
  marketCapTier: string | null;
  grahamScore: number | null;
  currentRatio: string | null;
  peRatio: string | null;
  pbRatio: string | null;
}

export interface PriceSnapshot {
  id: number;
  stockId: number;
  price: string;
  volume: number | null;
  timestamp: string;
}

export interface AnomalyEvent {
  id: number;
  stockId: number;
  type: string | null;
  volumeSpikeScore: string | null;
  sentimentScore: string | null;
  grahamScore: number | null;
  convictionTier: string | null;
  summary: string | null;
  createdAt: string;
}

export interface AlertFeedItem {
  alert: AnomalyEvent;
  ticker: string;
  stockName: string;
  sector: string;
}

export interface SectorHeatmapItem {
  sector: string;
  count: number;
  maxSpike: number;
  intensity: "HIGH" | "MEDIUM" | "LOW" | "NONE";
}

export interface NewsItemWithSentiment {
  id: number;
  headline: string;
  source: string | null;
  url: string | null;
  scrapedAt: string;
  sentimentScore: string | null;
  sentimentLabel: string | null;
  sentimentConfidence: string | null;
}

export interface StatusResponse {
  status: string;
  version: string;
  marketOpen: boolean;
  marketStatus: "OPEN" | "CLOSED";
  watTime: string;
  stocksMonitored: number;
  alertsToday: number;
  priceSnapshotsToday: number;
  timestamp: string;
}
