/**
 * demoData.ts
 * All static fallback/demo data used when the backend is unavailable.
 * Also generates realistic price history with a random walk.
 */

import type { PriceData, NewsItem, MarketSentiment, AIPrediction, HistoricalPoint } from '../types';

// ── Prices ────────────────────────────────────────────────────
export const DEMO_COMMODITIES: PriceData[] = [
  { symbol: 'XAU',   name: 'Gold',       price: 3327.40, change_pct:  1.24, change_abs:  40.72, source: 'demo', fetched_at: new Date().toISOString() },
  { symbol: 'XAG',   name: 'Silver',     price:   32.14, change_pct:  0.83, change_abs:   0.26, source: 'demo', fetched_at: new Date().toISOString() },
  { symbol: 'WTI',   name: 'WTI Oil',    price:   62.18, change_pct: -0.41, change_abs:  -0.26, source: 'demo', fetched_at: new Date().toISOString() },
  { symbol: 'BRENT', name: 'Brent Oil',  price:   65.42, change_pct: -0.61, change_abs:  -0.40, source: 'demo', fetched_at: new Date().toISOString() },
  { symbol: 'XPT',   name: 'Platinum',   price:  998.00, change_pct: -0.12, change_abs:  -1.20, source: 'demo', fetched_at: new Date().toISOString() },
];

export const DEMO_STOCKS: PriceData[] = [
  { symbol: 'AAPL',  name: 'Apple',      price:  213.40, change_pct:  0.32, change_abs:   0.68, source: 'demo', fetched_at: new Date().toISOString() },
  { symbol: 'TSLA',  name: 'Tesla',      price:  248.90, change_pct: -1.82, change_abs:  -4.62, source: 'demo', fetched_at: new Date().toISOString() },
  { symbol: 'NVDA',  name: 'NVIDIA',     price:  872.20, change_pct:  2.14, change_abs:  18.32, source: 'demo', fetched_at: new Date().toISOString() },
  { symbol: 'MSFT',  name: 'Microsoft',  price:  418.60, change_pct:  0.57, change_abs:   2.38, source: 'demo', fetched_at: new Date().toISOString() },
  { symbol: 'META',  name: 'Meta',       price:  542.30, change_pct:  1.18, change_abs:   6.33, source: 'demo', fetched_at: new Date().toISOString() },
  { symbol: 'GOOGL', name: 'Alphabet',   price:  175.80, change_pct:  0.44, change_abs:   0.77, source: 'demo', fetched_at: new Date().toISOString() },
];

export const DEMO_CRYPTO: PriceData[] = [
  { symbol: 'BTC',  name: 'Bitcoin',   price: 67420.00, change_pct:  2.14, change_abs: 1418.00, source: 'demo', fetched_at: new Date().toISOString() },
  { symbol: 'ETH',  name: 'Ethereum',  price:  3512.00, change_pct:  1.88, change_abs:   64.90, source: 'demo', fetched_at: new Date().toISOString() },
  { symbol: 'SOL',  name: 'Solana',    price:   168.40, change_pct:  3.21, change_abs:    5.24, source: 'demo', fetched_at: new Date().toISOString() },
  { symbol: 'BNB',  name: 'BNB',       price:   598.20, change_pct:  0.74, change_abs:    4.40, source: 'demo', fetched_at: new Date().toISOString() },
  { symbol: 'XRP',  name: 'XRP',       price:     0.62, change_pct: -0.48, change_abs:  -0.003, source: 'demo', fetched_at: new Date().toISOString() },
  { symbol: 'DOGE', name: 'Dogecoin',  price:    0.087, change_pct:  1.16, change_abs:   0.001, source: 'demo', fetched_at: new Date().toISOString() },
];

// Return a live-jittered copy so prices "move" every call
export function getLivePrices(base: PriceData[]): PriceData[] {
  return base.map(p => {
    const jitter = p.price * (Math.random() - 0.499) * 0.0015;
    return { ...p, price: parseFloat((p.price + jitter).toFixed(2)), fetched_at: new Date().toISOString() };
  });
}

// Base prices for history generation
const BASE_PRICES: Record<string, number> = {
  XAU: 3200, XAG: 30.5, WTI: 65, BRENT: 68, XPT: 1010,
  AAPL: 200, TSLA: 260, NVDA: 800, MSFT: 408, META: 510, GOOGL: 170,
  BTC: 60000, ETH: 3200, SOL: 140, BNB: 560, XRP: 0.55, DOGE: 0.08,
};

export function generateHistory(symbol: string, days: number): HistoricalPoint[] {
  const base = BASE_PRICES[symbol] ?? 100;
  const result: HistoricalPoint[] = [];
  let price = base * (0.92 + Math.random() * 0.08);
  const d = new Date();
  d.setDate(d.getDate() - days);
  for (let i = 0; i < days; i++) {
    d.setDate(d.getDate() + 1);
    price += price * (Math.random() - 0.47) * 0.013;
    result.push({ date: new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), price: parseFloat(price.toFixed(2)) });
  }
  return result;
}

// ── News ──────────────────────────────────────────────────────
export const DEMO_NEWS: NewsItem[] = [
  { id: 'n1', headline: 'OPEC+ signals potential output reduction amid falling oil prices', summary: 'OPEC and allies are considering further output cuts as crude prices face demand-side pressure.', source: 'Reuters', url: '#', published_at: new Date(Date.now() - 7200000).toISOString(), tags: ['oil', 'opec'], ai_sentiment: 'bullish', ai_confidence: 72, ai_analysis: 'Supply reduction would support oil prices' },
  { id: 'n2', headline: 'Gold hits multi-week high as US dollar weakens following CPI data', summary: 'Softer-than-expected US inflation weakened the dollar, pushing gold to its highest level in weeks.', source: 'Bloomberg', url: '#', published_at: new Date(Date.now() - 10800000).toISOString(), tags: ['gold', 'macro'], ai_sentiment: 'bullish', ai_confidence: 84, ai_analysis: 'USD weakness directly boosts gold demand' },
  { id: 'n3', headline: 'Fed officials hint at rate cuts if inflation continues to moderate', summary: 'Several Federal Reserve officials signaled the central bank may be closer to easing policy.', source: 'WSJ', url: '#', published_at: new Date(Date.now() - 18000000).toISOString(), tags: ['fed', 'rates'], ai_sentiment: 'bullish', ai_confidence: 68, ai_analysis: 'Rate cuts positive for equities and gold' },
  { id: 'n4', headline: 'Tesla deliveries miss Q1 estimates; shares slide pre-market', summary: 'Tesla reported first-quarter vehicle deliveries below Wall Street expectations.', source: 'CNBC', url: '#', published_at: new Date(Date.now() - 36000000).toISOString(), tags: ['tesla', 'stocks'], ai_sentiment: 'bearish', ai_confidence: 79, ai_analysis: 'Delivery miss signals slowing demand' },
  { id: 'n5', headline: 'NVIDIA announces next-gen Blackwell Ultra GPUs for AI workloads', summary: 'NVIDIA unveiled its next generation GPU architecture for large-scale AI training.', source: 'TechCrunch', url: '#', published_at: new Date(Date.now() - 50400000).toISOString(), tags: ['nvidia', 'ai'], ai_sentiment: 'bullish', ai_confidence: 91, ai_analysis: 'Product leadership reinforces dominant market position' },
  { id: 'n6', headline: 'Silver demand surges as solar panel production hits record levels', summary: 'Silver consumption in the solar industry reached an all-time high globally.', source: 'FT', url: '#', published_at: new Date(Date.now() - 64800000).toISOString(), tags: ['silver', 'energy'], ai_sentiment: 'bullish', ai_confidence: 76, ai_analysis: 'Industrial demand provides strong price floor' },
];

// ── Sentiment ─────────────────────────────────────────────────
export const DEMO_SENTIMENT: MarketSentiment = {
  overall: 'bullish',
  score: 68,
  assets: [
    { symbol: 'XAU',  name: 'Gold',    bullish: 78, bearish: 12, neutral: 10, note: 'USD weakness and safe-haven demand' },
    { symbol: 'WTI',  name: 'WTI Oil', bullish: 44, bearish: 40, neutral: 16, note: 'Mixed OPEC signals vs demand concern' },
    { symbol: 'XAG',  name: 'Silver',  bullish: 65, bearish: 22, neutral: 13, note: 'Solar industrial demand remains strong' },
    { symbol: 'NVDA', name: 'NVIDIA',  bullish: 88, bearish:  7, neutral:  5, note: 'AI chip demand dominates narrative' },
    { symbol: 'TSLA', name: 'Tesla',   bullish: 38, bearish: 49, neutral: 13, note: 'Price cuts pressuring margins' },
    { symbol: 'SPX',  name: 'S&P 500', bullish: 62, bearish: 21, neutral: 17, note: 'Earnings season broadly positive' },
  ],
};

// ── Predictions ───────────────────────────────────────────────
const PRED_DEFAULTS: Record<string, Partial<AIPrediction>> = {
  XAU:   { direction: 'up',       confidence: 74, bullish_pct: 74, bearish_pct: 16, neutral_pct: 10, reasoning: 'Dollar weakness + geopolitical tensions support gold. Technical breakout above $3,300 resistance.' },
  WTI:   { direction: 'down',     confidence: 52, bullish_pct: 38, bearish_pct: 48, neutral_pct: 14, reasoning: 'OPEC cuts partially offset by weak demand from China. Watch $60 support level.' },
  BRENT: { direction: 'down',     confidence: 50, bullish_pct: 40, bearish_pct: 45, neutral_pct: 15, reasoning: 'Brent follows WTI lower; inventory builds weigh on price.' },
  XAG:   { direction: 'up',       confidence: 68, bullish_pct: 68, bearish_pct: 18, neutral_pct: 14, reasoning: 'Solar panel boom drives industrial demand. Silver undervalued vs gold ratio.' },
  NVDA:  { direction: 'up',       confidence: 85, bullish_pct: 85, bearish_pct:  8, neutral_pct:  7, reasoning: 'AI infrastructure buildout continues at pace. Blackwell GPUs exceed supply expectations.' },
  TSLA:  { direction: 'down',     confidence: 55, bullish_pct: 38, bearish_pct: 49, neutral_pct: 13, reasoning: 'Margin pressure from price cuts and rising EV competition from Chinese manufacturers.' },
  AAPL:  { direction: 'up',       confidence: 65, bullish_pct: 65, bearish_pct: 20, neutral_pct: 15, reasoning: 'Services revenue growth offsets hardware slowdown. India manufacturing ramp on track.' },
  MSFT:  { direction: 'up',       confidence: 70, bullish_pct: 70, bearish_pct: 15, neutral_pct: 15, reasoning: 'Azure AI services driving cloud growth. Copilot monetisation exceeding expectations.' },
  META:  { direction: 'up',       confidence: 66, bullish_pct: 66, bearish_pct: 20, neutral_pct: 14, reasoning: 'Ad revenue resilient; AI-powered Reels engagement up 25% YoY.' },
  GOOGL: { direction: 'sideways', confidence: 55, bullish_pct: 50, bearish_pct: 28, neutral_pct: 22, reasoning: 'Search monopoly under regulatory pressure; Gemini AI competing against ChatGPT.' },
};

export function getDemoPrediction(symbol: string, currentPrice: number): AIPrediction {
  const defaults = PRED_DEFAULTS[symbol] ?? { direction: 'sideways', confidence: 50, bullish_pct: 50, bearish_pct: 30, neutral_pct: 20, reasoning: 'Insufficient data for a high-confidence prediction.' };
  const multiplier = defaults.direction === 'up' ? 1.015 : defaults.direction === 'down' ? 0.985 : 1.002;
  return {
    symbol,
    name: [...DEMO_COMMODITIES, ...DEMO_STOCKS].find(p => p.symbol === symbol)?.name ?? symbol,
    direction: defaults.direction as 'up' | 'down' | 'sideways',
    confidence: defaults.confidence!,
    target_price: parseFloat((currentPrice * multiplier).toFixed(2)),
    current_price: currentPrice,
    bullish_pct: defaults.bullish_pct!,
    bearish_pct: defaults.bearish_pct!,
    neutral_pct: defaults.neutral_pct!,
    reasoning: defaults.reasoning!,
    generated_at: new Date().toISOString(),
  };
}
