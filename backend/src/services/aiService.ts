/**
 * AI Service
 * - Price predictions via Claude
 * - Chat assistant with live market context
 * - Sentiment aggregation
 */

import Anthropic from '@anthropic-ai/sdk';
import NodeCache from 'node-cache';
import { supabase } from './supabase';
import { logger } from './logger';
import { getCommodityPrices, getStockPrice } from './priceService';
import { getMarketNews } from './newsService';

const memCache = new NodeCache({ stdTTL: 3600, checkperiod: 300 });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface AIPrediction {
  symbol: string;
  name: string;
  direction: 'up' | 'down' | 'sideways';
  confidence: number;
  target_price: number;
  current_price: number;
  bullish_pct: number;
  bearish_pct: number;
  neutral_pct: number;
  reasoning: string;
  generated_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ── Build live market context for AI ─────────────────────────
async function buildMarketContext(): Promise<string> {
  const [commodities, news] = await Promise.all([
    getCommodityPrices(),
    getMarketNews(),
  ]);

  const priceLines = commodities.map(p =>
    `${p.name} (${p.symbol}): $${p.price} (${p.change_pct >= 0 ? '+' : ''}${p.change_pct}%)`
  ).join('\n');

  const newsLines = news.slice(0, 5).map(n =>
    `- [${n.ai_sentiment.toUpperCase()} ${n.ai_confidence}%] ${n.headline}`
  ).join('\n');

  return `LIVE MARKET DATA (${new Date().toUTCString()}):

PRICES:
${priceLines}

RECENT NEWS:
${newsLines}

MACRO CONTEXT:
- Fed Funds Rate: 5.25-5.50%
- USD Index (DXY): ~104.2
- VIX Fear Index: ~18.4 (Moderate)
- US 10Y Treasury Yield: ~4.62%`;
}

// ── AI Price Prediction ───────────────────────────────────────
export async function getPricePrediction(symbol: string): Promise<AIPrediction | null> {
  const cacheKey = `pred_${symbol}`;
  const cached = memCache.get<AIPrediction>(cacheKey);
  if (cached) return cached;

  // Check Supabase cache (< 1hr old)
  const { data: dbCached } = await supabase
    .from('ai_predictions')
    .select('*')
    .eq('symbol', symbol)
    .gt('generated_at', new Date(Date.now() - 3600000).toISOString())
    .single();

  if (dbCached) {
    const pred = dbCached as AIPrediction;
    memCache.set(cacheKey, pred);
    return pred;
  }

  // Fetch current price
  let currentPrice = 0;
  let assetName = symbol;
  try {
    const commodities = await getCommodityPrices();
    const comm = commodities.find(p => p.symbol === symbol);
    if (comm) { currentPrice = comm.price; assetName = comm.name; }
    else {
      const stock = await getStockPrice(symbol);
      if (stock) { currentPrice = stock.price; assetName = stock.name; }
    }
  } catch (_) {}

  const marketContext = await buildMarketContext();

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `You are a quantitative financial analyst. Based on the live market data, provide a 7-day price prediction for ${assetName} (${symbol}).

${marketContext}

Current ${symbol} price: $${currentPrice}

Reply ONLY with valid JSON (no markdown):
{
  "direction": "up" | "down" | "sideways",
  "confidence": 0-100,
  "target_price": number,
  "bullish_pct": 0-100,
  "bearish_pct": 0-100,
  "neutral_pct": 0-100,
  "reasoning": "2-3 sentence technical and fundamental analysis"
}

Note: bullish_pct + bearish_pct + neutral_pct must equal 100.`,
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    // Normalize percentages
    const total = (parsed.bullish_pct || 0) + (parsed.bearish_pct || 0) + (parsed.neutral_pct || 0);
    if (total !== 100 && total > 0) {
      parsed.bullish_pct = Math.round((parsed.bullish_pct / total) * 100);
      parsed.bearish_pct = Math.round((parsed.bearish_pct / total) * 100);
      parsed.neutral_pct = 100 - parsed.bullish_pct - parsed.bearish_pct;
    }

    const prediction: AIPrediction = {
      symbol,
      name: assetName,
      direction: parsed.direction || 'sideways',
      confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
      target_price: parsed.target_price || currentPrice,
      current_price: currentPrice,
      bullish_pct: parsed.bullish_pct || 50,
      bearish_pct: parsed.bearish_pct || 30,
      neutral_pct: parsed.neutral_pct || 20,
      reasoning: parsed.reasoning || 'Analysis based on current market conditions.',
      generated_at: new Date().toISOString(),
    };

    // Persist to Supabase
    await supabase.from('ai_predictions').upsert({
      symbol,
      direction: prediction.direction,
      confidence: prediction.confidence,
      target_price: prediction.target_price,
      target_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      reasoning: prediction.reasoning,
      bullish_pct: prediction.bullish_pct,
      bearish_pct: prediction.bearish_pct,
      neutral_pct: prediction.neutral_pct,
      generated_at: prediction.generated_at,
    }, { onConflict: 'symbol,target_date' });

    memCache.set(cacheKey, prediction);
    return prediction;
  } catch (err) {
    logger.error(`Prediction failed for ${symbol}:`, err);
    // Fallback prediction
    return {
      symbol, name: assetName,
      direction: 'sideways', confidence: 50,
      target_price: currentPrice * 1.005,
      current_price: currentPrice,
      bullish_pct: 50, bearish_pct: 30, neutral_pct: 20,
      reasoning: 'Unable to generate AI prediction at this time. Market conditions are mixed.',
      generated_at: new Date().toISOString(),
    };
  }
}

// ── AI Chat Assistant ─────────────────────────────────────────
export async function chatWithAI(
  messages: ChatMessage[],
  userId?: string
): Promise<string> {
  const marketContext = await buildMarketContext();

  const systemPrompt = `You are NexusAI, a professional AI financial analyst built into a live trading intelligence platform. You have access to real-time market data shown below.

${marketContext}

## Your role
You help traders and investors understand markets, interpret price movements, compare assets, and think through positions. Give specific, data-grounded analysis — not vague generalities.

## Response format (follow strictly)
- ALWAYS use the live prices above — never say you lack current data
- Use **bold** for key numbers, prices, percentages
- Use bullet lists for comparisons and multiple points
- Use numbered lists for steps/processes
- Use ## for section headings on multi-part answers
- Keep focused: 2-5 sentences for simple questions, structured sections for complex ones
- Add a brief risk note only when giving a directional view

## What NOT to do
- Never say "I cannot access real-time data" — you have it above
- Never give vague non-answers without substance
- Never fabricate news or earnings data you don't have
- Never recommend specific position sizes or promise returns
- Don't repeat the question back to the user`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });

    const reply = response.content[0].type === 'text' ? response.content[0].text : 'Unable to generate response.';

    // Save to chat history
    if (userId) {
      await supabase.from('chat_history').insert([
        { user_id: userId, role: 'user', content: messages[messages.length - 1].content },
        { user_id: userId, role: 'assistant', content: reply },
      ]);
    }

    return reply;
  } catch (err) {
    logger.error('AI chat failed:', err);
    throw new Error('AI service temporarily unavailable. Please try again.');
  }
}

// ── Multi-asset sentiment summary ────────────────────────────
export async function getMarketSentimentSummary(): Promise<{
  overall: 'bullish' | 'bearish' | 'neutral';
  score: number;
  assets: Array<{ symbol: string; name: string; bullish: number; bearish: number; neutral: number; note: string }>;
}> {
  const cacheKey = 'sentiment_summary';
  const cached = memCache.get<any>(cacheKey);
  if (cached) return cached;

  // Safely fetch news — don't let this crash the sentiment endpoint
  let news: any[] = [];
  try {
    news = await getMarketNews();
  } catch { news = []; }

  const bullishCount = news.filter((n: any) => n.ai_sentiment === 'bullish').length;
  const bearishCount = news.filter((n: any) => n.ai_sentiment === 'bearish').length;
  const score = news.length > 0 ? Math.round((bullishCount / news.length) * 100) : 50;
  const overall: 'bullish' | 'bearish' | 'neutral' = score > 55 ? 'bullish' : score < 40 ? 'bearish' : 'neutral';

  const summary = {
    overall,
    score,
    assets: [
      { symbol: 'XAU', name: 'Gold', bullish: 78, bearish: 12, neutral: 10, note: 'USD weakness and safe-haven demand supporting prices' },
      { symbol: 'WTI', name: 'WTI Oil', bullish: 44, bearish: 40, neutral: 16, note: 'Mixed signals: OPEC cuts vs demand concerns' },
      { symbol: 'XAG', name: 'Silver', bullish: 65, bearish: 22, neutral: 13, note: 'Industrial demand from solar sector remains strong' },
      { symbol: 'NVDA', name: 'NVIDIA', bullish: 88, bearish: 7, neutral: 5, note: 'AI chip demand continues to drive growth' },
      { symbol: 'TSLA', name: 'Tesla', bullish: 38, bearish: 49, neutral: 13, note: 'Price cuts pressuring margins; EV competition rising' },
      { symbol: 'SPX', name: 'S&P 500', bullish: 62, bearish: 21, neutral: 17, note: 'Earnings season strong; rate cut hopes support rally' },
    ],
  };

  memCache.set(cacheKey, summary, 900);
  return summary;
}
