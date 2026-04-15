import type {
  Stock,
  PriceSnapshot,
  AlertFeedItem,
  SectorHeatmapItem,
  NewsItemWithSentiment,
  StatusResponse,
  TechnicalSignals,
  TopSignalItem,
  AllSignalItem,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function get<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    cache: "no-store",
    ...options,
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

function qs(params?: Record<string, string | number | undefined>): string {
  if (!params) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const api = {
  getStatus: () => get<StatusResponse>("/api"),

  getStocks: () => get<Stock[]>("/api/stocks"),

  getStock: (ticker: string) => get<Stock>(`/api/stocks/${encodeURIComponent(ticker)}`),

  getStockPrices: (ticker: string) =>
    get<PriceSnapshot[]>(`/api/stocks/${encodeURIComponent(ticker)}/prices`),

  getStockNews: (ticker: string) =>
    get<NewsItemWithSentiment[]>(`/api/stocks/${encodeURIComponent(ticker)}/news`),

  getAlerts: (params?: {
    tier?: string;
    sector?: string;
    page?: number;
    limit?: number;
  }) => get<AlertFeedItem[]>(`/api/alerts${qs(params)}`),

  getSectorHeatmap: () => get<SectorHeatmapItem[]>("/api/sectors/heatmap"),

  detectNow: () =>
    get<{ triggered: boolean; eventsDetected: number; timestamp: string }>(
      "/api/admin/detect-now"
    ),

  telegramTest: () => get<{ sent: boolean }>("/api/admin/telegram-test"),

  getStockSignals: (ticker: string) =>
    get<TechnicalSignals>(`/api/stocks/${encodeURIComponent(ticker)}/signals`),

  getTopSignals: () => get<TopSignalItem[]>("/api/quant/top-signals"),

  getAllSignals: () => get<AllSignalItem[]>("/api/quant/all-signals"),
};
