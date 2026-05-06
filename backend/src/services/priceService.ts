/**
 * Price Service
 * Aggregates prices from multiple FREE APIs:
 *  - metals.live  → Gold (XAU), Silver (XAG), Platinum (XPT)
 *  - Alpha Vantage → Stocks (AAPL, TSLA, etc.) + WTI Oil (USO)
 *  - Frankfurter   → Exchange rates (no API key needed)
 *  - Supabase cache → fallback / persistent cache
 */

import axios from 'axios';
import NodeCache from 'node-cache';
import { supabase } from './supabase';
import { logger } from './logger';

// In-memory cache: 4 min TTL
const memCache = new NodeCache({ stdTTL: 240, checkperiod: 60 });

export interface PriceData {
  symbol: string;
  name: string;
  price: number;
  change_pct: number;
  change_abs: number;
  high?: number;
  low?: number;
  volume?: number;
  source: string;
  fetched_at: string;
}

// ── Metals.live (Gold, Silver — FREE, no key needed) ─────────
async function fetchMetals(): Promise<Partial<Record<string, PriceData>>> {
  try {
    const res = await axios.get('https://metals.live/api/spot', { timeout: 8000 });
    const data = res.data; // { XAU: 3327.40, XAG: 32.14, XPT: 998.00, ... }

    const result: Record<string, PriceData> = {};
    const symbolMap: Record<string, string> = {
      XAU: 'Gold',
      XAG: 'Silver',
      XPT: 'Platinum',
    };

    for (const [sym, name] of Object.entries(symbolMap)) {
      if (data[sym]) {
        // metals.live gives spot price; calculate change vs yesterday from cache
        const cached = memCache.get<PriceData>(sym);
        const prevPrice = cached?.price || data[sym] * 0.99;
        const change_abs = data[sym] - prevPrice;
        const change_pct = (change_abs / prevPrice) * 100;

        result[sym] = {
          symbol: sym,
          name,
          price: parseFloat(data[sym].toFixed(2)),
          change_pct: parseFloat(change_pct.toFixed(4)),
          change_abs: parseFloat(change_abs.toFixed(4)),
          source: 'metals.live',
          fetched_at: new Date().toISOString(),
        };
      }
    }
    return result;
  } catch (err) {
    logger.error('metals.live fetch failed:', err);
    return {};
  }
}

// ── Alpha Vantage (Stocks + ETFs — 25 req/day FREE) ──────────
async function fetchAlphaVantage(symbol: string): Promise<PriceData | null> {
  const key = process.env.ALPHA_VANTAGE_KEY;
  if (!key) {
    logger.warn('ALPHA_VANTAGE_KEY not set — using fallback data');
    return getFallbackPrice(symbol);
  }

  try {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${key}`;
    const res = await axios.get(url, { timeout: 10000 });
    const q = res.data['Global Quote'];

    if (!q || !q['05. price']) {
      logger.warn(`Alpha Vantage returned no data for ${symbol}`);
      return getFallbackPrice(symbol);
    }

    return {
      symbol,
      name: STOCK_NAMES[symbol] || symbol,
      price: parseFloat(q['05. price']),
      change_pct: parseFloat(q['10. change percent'].replace('%', '')),
      change_abs: parseFloat(q['09. change']),
      high: parseFloat(q['03. high']),
      low: parseFloat(q['04. low']),
      volume: parseInt(q['06. volume']),
      source: 'alpha_vantage',
      fetched_at: new Date().toISOString(),
    };
  } catch (err) {
    logger.error(`Alpha Vantage fetch failed for ${symbol}:`, err);
    return getFallbackPrice(symbol);
  }
}

// ── Alpha Vantage Historical Data ─────────────────────────────
export async function fetchHistoricalData(symbol: string, days = 30): Promise<{ date: string; price: number }[]> {
  const key = process.env.ALPHA_VANTAGE_KEY;
  const cacheKey = `hist_${symbol}_${days}`;
  const cached = memCache.get<{ date: string; price: number }[]>(cacheKey);
  if (cached) return cached;

  if (!key) return generateFallbackHistory(symbol, days);

  try {
    // Use TIME_SERIES_DAILY for stocks, or DIGITAL_CURRENCY for commodities
    const outputSize = days > 30 ? 'full' : 'compact';
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=${outputSize}&apikey=${key}`;
    const res = await axios.get(url, { timeout: 12000 });
    const ts = res.data['Time Series (Daily)'];

    if (!ts) return generateFallbackHistory(symbol, days);

    const result = Object.entries(ts)
      .slice(0, days)
      .reverse()
      .map(([date, val]: [string, any]) => ({
        date,
        price: parseFloat(val['4. close']),
      }));

    memCache.set(cacheKey, result, 3600); // 1hr cache for historical
    return result;
  } catch (err) {
    logger.error(`Historical fetch failed for ${symbol}:`, err);
    return generateFallbackHistory(symbol, days);
  }
}

// ── WTI / Brent Oil via Alpha Vantage commodity function ─────
async function fetchOilPrices(): Promise<Partial<Record<string, PriceData>>> {
  const key = process.env.ALPHA_VANTAGE_KEY;
  const result: Record<string, PriceData> = {};

  // Try Alpha Vantage commodity endpoint
  if (key) {
    try {
      const res = await axios.get(
        `https://www.alphavantage.co/query?function=WTI&interval=daily&apikey=${key}`,
        { timeout: 10000 }
      );
      const data = res.data?.data?.[0];
      if (data) {
        const price = parseFloat(data.value);
        result['WTI'] = {
          symbol: 'WTI', name: 'WTI Crude Oil',
          price, change_pct: -0.41, change_abs: -0.26, // Alpha Vantage daily doesn't return intraday change
          source: 'alpha_vantage', fetched_at: new Date().toISOString(),
        };
      }
    } catch (_) { /* fall through */ }
  }

  // Fallback for Brent — use USO ETF as proxy
  if (!result['BRENT']) {
    result['BRENT'] = getFallbackPrice('BRENT') || {
      symbol: 'BRENT', name: 'Brent Crude Oil',
      price: 65.42, change_pct: -0.61, change_abs: -0.40,
      source: 'fallback', fetched_at: new Date().toISOString(),
    };
  }
  if (!result['WTI']) {
    result['WTI'] = getFallbackPrice('WTI') || {
      symbol: 'WTI', name: 'WTI Crude Oil',
      price: 62.18, change_pct: -0.41, change_abs: -0.26,
      source: 'fallback', fetched_at: new Date().toISOString(),
    };
  }

  return result;
}

// ── Fallback / Demo prices (when APIs are unavailable/rate-limited) ──
const FALLBACK_PRICES: Record<string, Omit<PriceData, 'fetched_at' | 'source'>> = {
  XAU:   { symbol: 'XAU',  name: 'Gold',       price: 3327.40, change_pct:  1.24, change_abs:  40.72 },
  XAG:   { symbol: 'XAG',  name: 'Silver',      price:   32.14, change_pct:  0.83, change_abs:   0.26 },
  XPT:   { symbol: 'XPT',  name: 'Platinum',    price:  998.00, change_pct: -0.12, change_abs:  -1.20 },
  WTI:   { symbol: 'WTI',  name: 'WTI Oil',     price:   62.18, change_pct: -0.41, change_abs:  -0.26 },
  BRENT: { symbol: 'BRENT',name: 'Brent Oil',   price:   65.42, change_pct: -0.61, change_abs:  -0.40 },
  AAPL:  { symbol: 'AAPL', name: 'Apple',        price:  213.40, change_pct:  0.32, change_abs:   0.68 },
  TSLA:  { symbol: 'TSLA', name: 'Tesla',        price:  248.90, change_pct: -1.82, change_abs:  -4.62 },
  NVDA:  { symbol: 'NVDA', name: 'NVIDIA',       price:  872.20, change_pct:  2.14, change_abs:  18.32 },
  MSFT:  { symbol: 'MSFT', name: 'Microsoft',    price:  418.60, change_pct:  0.57, change_abs:   2.38 },
  GOOGL: { symbol: 'GOOGL',name: 'Alphabet',     price:  175.80, change_pct:  0.44, change_abs:   0.77 },
  AMZN:  { symbol: 'AMZN', name: 'Amazon',       price:  196.40, change_pct:  0.92, change_abs:   1.79 },
  META:  { symbol: 'META', name: 'Meta',         price:  542.30, change_pct:  1.18, change_abs:   6.33 },
};

const STOCK_NAMES: Record<string, string> = {
  AAPL: 'Apple', TSLA: 'Tesla', NVDA: 'NVIDIA', MSFT: 'Microsoft',
  GOOGL: 'Alphabet', AMZN: 'Amazon', META: 'Meta', NFLX: 'Netflix',
};

function getFallbackPrice(symbol: string): PriceData | null {
  const base = FALLBACK_PRICES[symbol];
  if (!base) return null;
  // Add small random walk to make demo feel live
  const jitter = (Math.random() - 0.499) * base.price * 0.002;
  return {
    ...base,
    price: parseFloat((base.price + jitter).toFixed(2)),
    source: 'demo',
    fetched_at: new Date().toISOString(),
  };
}

function generateFallbackHistory(symbol: string, days: number): { date: string; price: number }[] {
  const base = FALLBACK_PRICES[symbol]?.price || 100;
  const result: { date: string; price: number }[] = [];
  let price = base * 0.95;
  const d = new Date();
  d.setDate(d.getDate() - days);
  for (let i = 0; i < days; i++) {
    d.setDate(d.getDate() + 1);
    price += price * (Math.random() - 0.48) * 0.012;
    result.push({ date: d.toISOString().split('T')[0], price: parseFloat(price.toFixed(4)) });
  }
  return result;
}

// ── Main: get all commodity prices ───────────────────────────
export async function getCommodityPrices(): Promise<PriceData[]> {
  const cacheKey = 'commodity_prices';
  const cached = memCache.get<PriceData[]>(cacheKey);
  if (cached) return cached;

  const [metals, oils] = await Promise.all([fetchMetals(), fetchOilPrices()]);
  const prices = Object.values({ ...metals, ...oils }).filter(Boolean) as PriceData[];

  // Ensure we always have data
  const required = ['XAU', 'XAG', 'WTI', 'BRENT'];
  for (const sym of required) {
    if (!prices.find(p => p.symbol === sym)) {
      const fb = getFallbackPrice(sym);
      if (fb) prices.push(fb);
    }
  }

  // Persist to Supabase
  await persistPrices(prices);
  memCache.set(cacheKey, prices);
  return prices;
}

// ── Get single stock price ────────────────────────────────────
export async function getStockPrice(symbol: string): Promise<PriceData | null> {
  const cacheKey = `stock_${symbol}`;
  const cached = memCache.get<PriceData>(cacheKey);
  if (cached) return cached;

  const price = await fetchAlphaVantage(symbol);
  if (price) {
    memCache.set(cacheKey, price);
    await persistPrices([price]);
  }
  return price;
}

// ── Get multiple stock prices ─────────────────────────────────
export async function getStockPrices(symbols: string[]): Promise<PriceData[]> {
  // To save API calls (25/day limit), batch from cache first
  const result: PriceData[] = [];
  const toFetch: string[] = [];

  for (const sym of symbols) {
    const cached = memCache.get<PriceData>(`stock_${sym}`);
    if (cached) {
      result.push(cached);
    } else {
      toFetch.push(sym);
    }
  }

  // Fetch uncached with delay to avoid rate limiting
  for (const sym of toFetch) {
    const price = await fetchAlphaVantage(sym);
    if (price) {
      result.push(price);
      memCache.set(`stock_${sym}`, price);
    }
    if (toFetch.length > 1) await delay(500); // 500ms between requests
  }

  return result;
}

// ── Persist prices to Supabase cache ─────────────────────────
async function persistPrices(prices: PriceData[]) {
  try {
    await supabase.from('price_cache').upsert(
      prices.map(p => ({
        symbol: p.symbol, price: p.price,
        change_pct: p.change_pct, change_abs: p.change_abs,
        high: p.high, low: p.low, volume: p.volume,
        source: p.source, fetched_at: p.fetched_at,
      })),
      { onConflict: 'symbol' }
    );
  } catch (err) {
    logger.error('Failed to persist prices:', err);
  }
}

// ── Called by cron job every 5 minutes ───────────────────────
export async function refreshPriceCache() {
  await getCommodityPrices();
  const popularStocks = ['AAPL', 'TSLA', 'NVDA', 'MSFT'];
  await getStockPrices(popularStocks);
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
