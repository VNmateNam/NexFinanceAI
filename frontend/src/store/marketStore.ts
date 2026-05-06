import { create } from 'zustand';
import type { PriceData, NewsItem, AIPrediction, MarketSentiment, HistoricalPoint } from '../types';
import { pricesApi, newsApi, aiApi } from '../services/api';
import {
  DEMO_COMMODITIES, DEMO_STOCKS, DEMO_NEWS, DEMO_SENTIMENT,
  getLivePrices, generateHistory, getDemoPrediction,
} from '../services/demoData';

interface MarketState {
  commodities:  PriceData[];
  stocks:       PriceData[];
  news:         NewsItem[];
  sentiment:    MarketSentiment | null;
  predictions:  Record<string, AIPrediction>;
  historyCache: Record<string, HistoricalPoint[]>;
  loading:      boolean;
  lastUpdated:  Date | null;

  fetchAll:        () => Promise<void>;
  fetchPrediction: (symbol: string) => Promise<void>;
  fetchHistory:    (symbol: string, days: number) => HistoricalPoint[];
  jitterPrices:    () => void;
}

export const useMarketStore = create<MarketState>((set, get) => ({
  // Seed with demo immediately — UI is never blank
  commodities:  getLivePrices(DEMO_COMMODITIES),
  stocks:       getLivePrices(DEMO_STOCKS),
  news:         DEMO_NEWS,
  sentiment:    DEMO_SENTIMENT,
  predictions:  {},
  historyCache: {},
  loading:      false,
  lastUpdated:  new Date(),

  fetchAll: async () => {
    set({ loading: true });
    const [commRes, stockRes, newsRes, sentRes] = await Promise.allSettled([
      pricesApi.getCommodities(),
      pricesApi.getStocks(['AAPL','TSLA','NVDA','MSFT','META','GOOGL']),
      newsApi.getNews(),
      aiApi.getSentiment(),
    ]);
    set({
      commodities: commRes.status  === 'fulfilled' && commRes.value?.length  ? commRes.value  : getLivePrices(DEMO_COMMODITIES),
      stocks:      stockRes.status === 'fulfilled' && stockRes.value?.length ? stockRes.value : getLivePrices(DEMO_STOCKS),
      news:        newsRes.status  === 'fulfilled' && newsRes.value?.length  ? newsRes.value  : DEMO_NEWS,
      sentiment:   sentRes.status  === 'fulfilled' && sentRes.value         ? sentRes.value  : DEMO_SENTIMENT,
      loading:     false,
      lastUpdated: new Date(),
    });
  },

  fetchPrediction: async (symbol: string) => {
    if (get().predictions[symbol]) return;
    const allPrices = [...get().commodities, ...get().stocks];
    const currentPrice = allPrices.find(p => p.symbol === symbol)?.price ?? 100;
    try {
      const pred = await aiApi.getPrediction(symbol);
      if (pred) { set(s => ({ predictions: { ...s.predictions, [symbol]: pred } })); return; }
    } catch {}
    // Fall back to local demo prediction
    const pred = getDemoPrediction(symbol, currentPrice);
    set(s => ({ predictions: { ...s.predictions, [symbol]: pred } }));
  },

  fetchHistory: (symbol: string, days: number): HistoricalPoint[] => {
    const key = `${symbol}_${days}`;
    const cached = get().historyCache[key];
    if (cached) return cached;
    // Generate immediately so chart is never empty
    const generated = generateHistory(symbol, days);
    set(s => ({ historyCache: { ...s.historyCache, [key]: generated } }));
    // Then try real data in background
    pricesApi.getHistory(symbol, days)
      .then(data => {
        if (data?.length) set(s => ({ historyCache: { ...s.historyCache, [key]: data } }));
      })
      .catch(() => {});
    return generated;
  },

  // Tiny random walk every 10s to simulate live feed
  jitterPrices: () => {
    set(s => ({
      commodities: s.commodities.map(p => ({
        ...p,
        price: parseFloat((p.price * (1 + (Math.random() - 0.499) * 0.0008)).toFixed(2)),
        fetched_at: new Date().toISOString(),
      })),
      stocks: s.stocks.map(p => ({
        ...p,
        price: parseFloat((p.price * (1 + (Math.random() - 0.499) * 0.0012)).toFixed(2)),
        fetched_at: new Date().toISOString(),
      })),
    }));
  },
}));
