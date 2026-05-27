import { create } from 'zustand';
import type { PriceData, NewsItem, AIPrediction, MarketSentiment, HistoricalPoint } from '../types';
import { pricesApi, newsApi, aiApi } from '../services/api';
import {
  DEMO_COMMODITIES, DEMO_STOCKS, DEMO_CRYPTO, DEMO_NEWS, DEMO_SENTIMENT,
  getLivePrices, generateHistory, getDemoPrediction,
} from '../services/demoData';

interface MarketState {
  commodities:  PriceData[];
  stocks:       PriceData[];
  crypto:       PriceData[];
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
  commodities:  getLivePrices(DEMO_COMMODITIES),
  stocks:       getLivePrices(DEMO_STOCKS),
  crypto:       getLivePrices(DEMO_CRYPTO),
  news:         DEMO_NEWS,
  sentiment:    DEMO_SENTIMENT,
  predictions:  {},
  historyCache: {},
  loading:      false,
  lastUpdated:  new Date(),

  fetchAll: async () => {
    set({ loading: true });
    const [commRes, stockRes, cryptoRes, newsRes, sentRes] = await Promise.allSettled([
      pricesApi.getCommodities(),
      pricesApi.getStocks(['AAPL','TSLA','NVDA','MSFT','META','GOOGL']),
      pricesApi.getCrypto(['BTC','ETH','SOL','BNB','XRP','DOGE']),
      newsApi.getNews(),
      aiApi.getSentiment(),
    ]);
    set({
      commodities: commRes.status  === 'fulfilled' && commRes.value?.length  ? commRes.value  : getLivePrices(DEMO_COMMODITIES),
      stocks:      stockRes.status === 'fulfilled' && stockRes.value?.length ? stockRes.value : getLivePrices(DEMO_STOCKS),
      crypto:      cryptoRes.status === 'fulfilled' && cryptoRes.value?.length ? cryptoRes.value : getLivePrices(DEMO_CRYPTO),
      news:        newsRes.status  === 'fulfilled' && newsRes.value?.length  ? newsRes.value  : DEMO_NEWS,
      sentiment:   sentRes.status  === 'fulfilled' && sentRes.value         ? sentRes.value  : DEMO_SENTIMENT,
      loading:     false,
      lastUpdated: new Date(),
    });
  },

  fetchPrediction: async (symbol: string) => {
    if (get().predictions[symbol]) return;
    const allPrices = [...get().commodities, ...get().stocks, ...get().crypto];
    const currentPrice = allPrices.find(p => p.symbol === symbol)?.price ?? 100;
    try {
      const pred = await aiApi.getPrediction(symbol);
      if (pred) { set(s => ({ predictions: { ...s.predictions, [symbol]: pred } })); return; }
    } catch {}
    const pred = getDemoPrediction(symbol, currentPrice);
    set(s => ({ predictions: { ...s.predictions, [symbol]: pred } }));
  },

  fetchHistory: (symbol: string, days: number): HistoricalPoint[] => {
    const key = `${symbol}_${days}`;
    const cached = get().historyCache[key];
    if (cached) return cached;
    const generated = generateHistory(symbol, days);
    set(s => ({ historyCache: { ...s.historyCache, [key]: generated } }));
    pricesApi.getHistory(symbol, days)
      .then(data => {
        if (data?.length) set(s => ({ historyCache: { ...s.historyCache, [key]: data } }));
      })
      .catch(() => {});
    return generated;
  },

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
      crypto: s.crypto.map(p => ({
        ...p,
        price: parseFloat((p.price * (1 + (Math.random() - 0.499) * 0.0020)).toFixed(p.price < 1 ? 4 : 2)),
        fetched_at: new Date().toISOString(),
      })),
    }));
  },
}));
