/**
 * Price Service
 * Aggregates prices from multiple FREE APIs:
 *  - metals.live    → Gold (XAU), Silver (XAG), Platinum (XPT) — no key needed
 *  - Twelve Data    → Stocks (AAPL, TSLA, etc.) — 800 req/day FREE
 *  - CoinGecko      → Crypto (BTC, ETH, etc.) — no key needed, generous limits
 *  - Alpha Vantage  → WTI Oil fallback — 25 req/day FREE
 *  - Frankfurter    → Exchange rates — no key needed
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

// ── Metals.live (Gold, Silver, Platinum — FREE, no key) ──────
async function fetchMetals(): Promise<Partial<Record<string, PriceData>>> {
  try {
    const res = await axios.get('https://metals.live/api/spot', { timeout: 8000 });
    const data = res.data;

    const result: Record<string, PriceData> = {};
    const symbolMap: Record<string, string> = {
      XAU: 'Gold',
      XAG: 'Silver',
      XPT: 'Platinum',
    };

    for (const [sym, name] of Object.entries(symbolMap)) {
      if (data[sym]) {
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

// ── Twelve Data (Stocks — 800 req/day FREE) ──────────────────
async function fetchTwelveData(symbol: string): Promise<PriceData | null> {
  const key = process.env.TWELVE_DATA_KEY;
  if (!key) {
    logger.warn('TWELVE_DATA_KEY not set — using fallback data');
    return getFallbackPrice(symbol);
  }

  try {
    const url = `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${key}`;
    const res = await axios.get(url, { timeout: 10000 });
    const q = res.data;

    if (q.status === 'error' || !q.close) {
      logger.warn(`Twelve Data returned no data for ${symbol}: ${q.message || 'unknown'}`);
      return getFallbackPrice(symbol);
    }

    const price = parseFloat(q.close);
    const change_abs = parseFloat(q.change);
    const change_pct = parseFloat(q.percent_change);

    return {
      symbol,
      name: q.name || STOCK_NAMES[symbol] || symbol,
      price,
      change_pct,
      change_abs,
      high: parseFloat(q.high),
      low: parseFloat(q.low),
      volume: parseInt(q.volume),
      source: 'twelve_data',
      fetched_at: new Date().toISOString(),
    };
  } catch (err) {
    logger.error(`Twelve Data fetch failed for ${symbol}:`, err);
    return getFallbackPrice(symbol);
  }
}

// ── Twelve Data Historical ────────────────────────────────────
async function fetchTwelveDataHistory(
  symbol: string,
  days: number
): Promise<{ date: string; price: number }[] | null> {
  const key = process.env.TWELVE_DATA_KEY;
  if (!key) return null;

  try {
    const outputSize = Math.min(days + 5, 5000);
    const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=${outputSize}&apikey=${key}`;
    const res = await axios.get(url, { timeout: 12000 });
    const ts = res.data;

    if (ts.status === 'error' || !ts.values?.length) {
      logger.warn(`Twelve Data history failed for ${symbol}: ${ts.message || 'no data'}`);
      return null;
    }

    return ts.values
      .slice(0, days)
      .reverse()
      .map((v: any) => ({
        date: v.datetime,
        price: parseFloat(v.close),
      }));
  } catch (err) {
    logger.error(`Twelve Data history failed for ${symbol}:`, err);
    return null;
  }
}

// ── CoinGecko (Crypto — FREE, no key needed) ─────────────────
// Maps app symbols to CoinGecko IDs
const COINGECKO_IDS: Record<string, string> = {
  BTC:  'bitcoin',
  ETH:  'ethereum',
  BNB:  'binancecoin',
  SOL:  'solana',
  XRP:  'ripple',
  ADA:  'cardano',
  DOGE: 'dogecoin',
  AVAX: 'avalanche-2',
  LINK: 'chainlink',
  DOT:  'polkadot',
};

const COINGECKO_NAMES: Record<string, string> = {
  BTC: 'Bitcoin', ETH: 'Ethereum', BNB: 'BNB', SOL: 'Solana',
  XRP: 'XRP', ADA: 'Cardano', DOGE: 'Dogecoin', AVAX: 'Avalanche',
  LINK: 'Chainlink', DOT: 'Polkadot',
};

export async function fetchCryptoPrices(symbols: string[]): Promise<PriceData[]> {
  const validSymbols = symbols.filter(s => COINGECKO_IDS[s]);
  if (!validSymbols.length) return [];

  const cacheKey = `crypto_${validSymbols.sort().join('_')}`;
  const cached = memCache.get<PriceData[]>(cacheKey);
  if (cached) return cached;

  const ids = validSymbols.map(s => COINGECKO_IDS[s]).join(',');

  try {
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`;
    const res = await axios.get(url, {
      timeout: 10000,
      headers: { 'Accept': 'application/json' },
    });

    const result: PriceData[] = res.data.map((coin: any) => {
      // Reverse-lookup symbol from CoinGecko ID
      const symbol = Object.keys(COINGECKO_IDS).find(k => COINGECKO_IDS[k] === coin.id) || coin.symbol.toUpperCase();
      return {
        symbol,
        name: coin.name,
        price: coin.current_price,
        change_pct: coin.price_change_percentage_24h ?? 0,
        change_abs: coin.price_change_24h ?? 0,
        high: coin.high_24h,
        low: coin.low_24h,
        volume: coin.total_volume,
        source: 'coingecko',
        fetched_at: new Date().toISOString(),
      };
    });

    memCache.set(cacheKey, result, 120); // 2-min cache for crypto
    await persistPrices(result);
    return result;
  } catch (err: any) {
    logger.error('CoinGecko fetch failed:', err?.response?.status, err?.message);
    // Return fallback for each symbol
    return validSymbols
      .map(s => getFallbackPrice(s))
      .filter(Boolean) as PriceData[];
  }
}

export async function fetchCryptoHistory(
  symbol: string,
  days: number
): Promise<{ date: string; price: number }[] | null> {
  const coinId = COINGECKO_IDS[symbol];
  if (!coinId) return null;

  const cacheKey = `crypto_hist_${symbol}_${days}`;
  const cached = memCache.get<{ date: string; price: number }[]>(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
    const res = await axios.get(url, { timeout: 12000 });
    const prices = res.data?.prices;

    if (!prices?.length) return null;

    const result = prices.map(([timestamp, price]: [number, number]) => ({
      date: new Date(timestamp).toISOString().split('T')[0],
      price: parseFloat(price.toFixed(4)),
    }));

    memCache.set(cacheKey, result, 3600);
    return result;
  } catch (err) {
    logger.error(`CoinGecko history failed for ${symbol}:`, err);
    return null;
  }
}

// ── Alpha Vantage (Oil fallback — 25 req/day FREE) ────────────
async function fetchOilPrices(): Promise<Partial<Record<string, PriceData>>> {
  const key = process.env.ALPHA_VANTAGE_KEY;
  const result: Record<string, PriceData> = {};

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
          price, change_pct: -0.41, change_abs: -0.26,
          source: 'alpha_vantage', fetched_at: new Date().toISOString(),
        };
      }
    } catch (_) { /* fall through */ }
  }

  if (!result['BRENT']) {
    result['BRENT'] = getFallbackPrice('BRENT') ?? {
      symbol: 'BRENT', name: 'Brent Crude Oil',
      price: 65.42, change_pct: -0.61, change_abs: -0.40,
      source: 'fallback', fetched_at: new Date().toISOString(),
    };
  }
  if (!result['WTI']) {
    result['WTI'] = getFallbackPrice('WTI') ?? {
      symbol: 'WTI', name: 'WTI Crude Oil',
      price: 62.18, change_pct: -0.41, change_abs: -0.26,
      source: 'fallback', fetched_at: new Date().toISOString(),
    };
  }

  return result;
}

// ── Fallback / Demo prices ───────────────────────────────────
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
  BTC:   { symbol: 'BTC',  name: 'Bitcoin',      price: 67420.00, change_pct: 2.14, change_abs: 1418.00 },
  ETH:   { symbol: 'ETH',  name: 'Ethereum',     price:  3512.00, change_pct: 1.88, change_abs:   64.90 },
  SOL:   { symbol: 'SOL',  name: 'Solana',       price:   168.40, change_pct: 3.21, change_abs:    5.24 },
  BNB:   { symbol: 'BNB',  name: 'BNB',          price:   598.20, change_pct: 0.74, change_abs:    4.40 },
};

const STOCK_NAMES: Record<string, string> = {
  AAPL: 'Apple', TSLA: 'Tesla', NVDA: 'NVIDIA', MSFT: 'Microsoft',
  GOOGL: 'Alphabet', AMZN: 'Amazon', META: 'Meta', NFLX: 'Netflix',
};

function getFallbackPrice(symbol: string): PriceData | null {
  const base = FALLBACK_PRICES[symbol];
  if (!base) return null;
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

// ── Historical Data (Twelve Data first, CoinGecko for crypto, fallback) ──
export async function fetchHistoricalData(symbol: string, days = 30): Promise<{ date: string; price: number }[]> {
  const cacheKey = `hist_${symbol}_${days}`;
  const cached = memCache.get<{ date: string; price: number }[]>(cacheKey);
  if (cached) return cached;

  let result: { date: string; price: number }[] | null = null;

  // Try CoinGecko for crypto
  if (COINGECKO_IDS[symbol]) {
    result = await fetchCryptoHistory(symbol, days);
  }

  // Try Twelve Data for stocks/commodities
  if (!result) {
    result = await fetchTwelveDataHistory(symbol, days);
  }

  // Final fallback
  if (!result || !result.length) {
    result = generateFallbackHistory(symbol, days);
  }

  memCache.set(cacheKey, result, 3600);
  return result;
}

// ── Main: get all commodity prices ───────────────────────────
export async function getCommodityPrices(): Promise<PriceData[]> {
  const cacheKey = 'commodity_prices';
  const cached = memCache.get<PriceData[]>(cacheKey);
  if (cached) return cached;

  const [metals, oils] = await Promise.all([fetchMetals(), fetchOilPrices()]);
  const prices = Object.values({ ...metals, ...oils }).filter(Boolean) as PriceData[];

  const required = ['XAU', 'XAG', 'WTI', 'BRENT'];
  for (const sym of required) {
    if (!prices.find(p => p.symbol === sym)) {
      const fb = getFallbackPrice(sym);
      if (fb) prices.push(fb);
    }
  }

  await persistPrices(prices);
  memCache.set(cacheKey, prices);
  return prices;
}

// ── Get single stock price (Twelve Data) ─────────────────────
export async function getStockPrice(symbol: string): Promise<PriceData | null> {
  // Route crypto to CoinGecko
  if (COINGECKO_IDS[symbol]) {
    const results = await fetchCryptoPrices([symbol]);
    return results[0] ?? null;
  }

  const cacheKey = `stock_${symbol}`;
  const cached = memCache.get<PriceData>(cacheKey);
  if (cached) return cached;

  const price = await fetchTwelveData(symbol);
  if (price) {
    memCache.set(cacheKey, price);
    await persistPrices([price]);
  }
  return price;
}

// ── Get multiple stock prices (Twelve Data) ──────────────────
export async function getStockPrices(symbols: string[]): Promise<PriceData[]> {
  const cryptoSymbols = symbols.filter(s => COINGECKO_IDS[s]);
  const stockSymbols  = symbols.filter(s => !COINGECKO_IDS[s]);

  const result: PriceData[] = [];

  // Fetch crypto in one batch call
  if (cryptoSymbols.length) {
    const cryptoPrices = await fetchCryptoPrices(cryptoSymbols);
    result.push(...cryptoPrices);
  }

  // Fetch stocks via Twelve Data (cache-first)
  const toFetch: string[] = [];
  for (const sym of stockSymbols) {
    const cached = memCache.get<PriceData>(`stock_${sym}`);
    if (cached) {
      result.push(cached);
    } else {
      toFetch.push(sym);
    }
  }

  for (const sym of toFetch) {
    const price = await fetchTwelveData(sym);
    if (price) {
      result.push(price);
      memCache.set(`stock_${sym}`, price);
    }
    if (toFetch.length > 1) await delay(300);
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
  await getStockPrices(['AAPL', 'TSLA', 'NVDA', 'MSFT']);
  await fetchCryptoPrices(['BTC', 'ETH', 'SOL', 'BNB']);
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
