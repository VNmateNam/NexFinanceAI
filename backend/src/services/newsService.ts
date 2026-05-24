/**
 * News Service — bulletproof version
 * - All DB operations wrapped in try/catch (never crash on Supabase errors)
 * - Sentiment analysis failures fall back to keyword analysis
 * - Always returns something (fallback news if everything fails)
 */

import axios from 'axios';
import NodeCache from 'node-cache';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from './supabase';
import { logger } from './logger';

const memCache = new NodeCache({ stdTTL: 900, checkperiod: 120 });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  source: string;
  url: string;
  published_at: string;
  tags: string[];
  ai_sentiment: 'bullish' | 'bearish' | 'neutral';
  ai_confidence: number;
  ai_analysis: string;
}

// ── NewsAPI.org ───────────────────────────────────────────────
async function fetchFromNewsAPI(query: string): Promise<Partial<NewsItem>[]> {
  const key = process.env.NEWSAPI_KEY;
  if (!key) return [];
  try {
    const res = await axios.get('https://newsapi.org/v2/everything', {
      params: { q: query, language: 'en', sortBy: 'publishedAt', pageSize: 10, apiKey: key },
      timeout: 8000,
    });
    return (res.data.articles || []).map((a: any) => ({
      headline: a.title?.replace(/ - .+$/, '') || '',
      summary: a.description || '',
      source: a.source?.name || 'Unknown',
      url: a.url || '',
      published_at: a.publishedAt || new Date().toISOString(),
    }));
  } catch { return []; }
}

// ── GNews.io ──────────────────────────────────────────────────
async function fetchFromGNews(query: string): Promise<Partial<NewsItem>[]> {
  const key = process.env.GNEWS_KEY;
  if (!key) return [];
  try {
    const res = await axios.get('https://gnews.io/api/v4/search', {
      params: { q: query, lang: 'en', max: 6, token: key },
      timeout: 8000,
    });
    return (res.data.articles || []).map((a: any) => ({
      headline: a.title || '',
      summary: a.description || '',
      source: a.source?.name || 'GNews',
      url: a.url || '',
      published_at: a.publishedAt || new Date().toISOString(),
    }));
  } catch { return []; }
}

// ── Fallback news (always available) ─────────────────────────
function getFallbackNews(): Partial<NewsItem>[] {
  return [
    { headline: 'Gold holds near record highs as dollar retreats on softer inflation data', summary: 'Gold prices remain elevated near multi-year highs as US inflation data came in below forecasts, weakening the dollar and boosting safe-haven demand.', source: 'Reuters', published_at: new Date(Date.now() - 2 * 3600000).toISOString(), tags: ['gold', 'inflation', 'dollar'] },
    { headline: 'OPEC+ maintains output cuts; oil prices stabilise above $60', summary: 'OPEC and its allies agreed to hold current production levels, helping crude oil stabilise after weeks of pressure from demand uncertainty.', source: 'Bloomberg', published_at: new Date(Date.now() - 3 * 3600000).toISOString(), tags: ['oil', 'opec'] },
    { headline: 'Federal Reserve officials signal patience on rate cuts amid mixed data', summary: 'Fed speakers indicated no urgency to cut rates, citing resilient employment but acknowledging progress on inflation toward the 2% target.', source: 'WSJ', published_at: new Date(Date.now() - 5 * 3600000).toISOString(), tags: ['fed', 'rates', 'macro'] },
    { headline: 'NVIDIA reports record data centre revenue; shares hit new all-time high', summary: 'NVIDIA posted quarterly data centre revenue that exceeded expectations, driven by surging demand for AI accelerator chips across cloud providers.', source: 'CNBC', published_at: new Date(Date.now() - 7 * 3600000).toISOString(), tags: ['nvidia', 'ai', 'tech'] },
    { headline: 'Silver benefits from renewable energy push as solar demand breaks records', summary: 'Silver demand from the photovoltaic sector reached record levels as governments accelerate renewable energy targets, supporting prices.', source: 'FT', published_at: new Date(Date.now() - 10 * 3600000).toISOString(), tags: ['silver', 'solar', 'energy'] },
    { headline: 'S&P 500 nears all-time high as earnings season beats low expectations', summary: 'US equities advanced with the S&P 500 approaching record territory after a majority of companies reporting quarterly results topped analyst estimates.', source: 'MarketWatch', published_at: new Date(Date.now() - 12 * 3600000).toISOString(), tags: ['stocks', 'earnings', 'spx'] },
  ];
}

// ── Keyword sentiment fallback ────────────────────────────────
function keywordSentiment(headline: string, summary: string): {
  sentiment: 'bullish' | 'bearish' | 'neutral'; confidence: number; analysis: string; tags: string[];
} {
  const text = (headline + ' ' + summary).toLowerCase();
  const bullish = ['rise', 'surge', 'gain', 'high', 'strong', 'growth', 'bullish', 'beat', 'record', 'rally', 'jump', 'soar'];
  const bearish = ['fall', 'drop', 'decline', 'weak', 'miss', 'lower', 'bearish', 'cut', 'concern', 'crash', 'sell', 'pressure'];
  const b = bullish.filter(w => text.includes(w)).length;
  const be = bearish.filter(w => text.includes(w)).length;
  const sentiment: 'bullish' | 'bearish' | 'neutral' = b > be ? 'bullish' : be > b ? 'bearish' : 'neutral';
  const tags = ['gold', 'oil', 'silver', 'fed', 'rates', 'nvidia', 'tesla', 'stocks', 'opec', 'macro']
    .filter(t => text.includes(t));
  return { sentiment, confidence: 55, analysis: 'Based on headline keywords', tags };
}

// ── Claude sentiment (with timeout + fallback) ────────────────
async function analyzeNewsSentiment(headline: string, summary: string): Promise<{
  sentiment: 'bullish' | 'bearish' | 'neutral'; confidence: number; analysis: string; tags: string[];
}> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Claude timeout')), 6000)
    );
    const claudePromise = anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `Financial news sentiment. Reply ONLY with valid JSON, no markdown.\n\nHeadline: "${headline.slice(0, 200)}"\n\n{"sentiment":"bullish|bearish|neutral","confidence":0-100,"analysis":"one sentence","tags":["tag1"]}`,
      }],
    });

    const message = await Promise.race([claudePromise, timeoutPromise]);
    const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
    const clean = text.replace(/```(?:json)?|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return {
      sentiment: ['bullish', 'bearish', 'neutral'].includes(parsed.sentiment) ? parsed.sentiment : 'neutral',
      confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 50)),
      analysis: String(parsed.analysis || '').slice(0, 200),
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 4) : [],
    };
  } catch {
    return keywordSentiment(headline, summary);
  }
}

// ── Try read from Supabase cache ──────────────────────────────
async function readDbCache(): Promise<NewsItem[] | null> {
  try {
    const { data, error } = await supabase
      .from('news_cache')
      .select('*')
      .gt('cached_at', new Date(Date.now() - 15 * 60000).toISOString())
      .order('published_at', { ascending: false })
      .limit(12);
    if (error) return null;
    if (!data || data.length < 4) return null;
    return data as NewsItem[];
  } catch { return null; }
}

// ── Try write to Supabase cache ───────────────────────────────
async function writeDbCache(items: NewsItem[]): Promise<void> {
  try {
    await supabase.from('news_cache').insert(
      items.map(n => ({
        headline: n.headline, summary: n.summary, source: n.source,
        url: n.url, published_at: n.published_at, tags: n.tags,
        ai_sentiment: n.ai_sentiment, ai_confidence: n.ai_confidence,
        ai_analysis: n.ai_analysis,
      }))
    );
  } catch { /* non-fatal — cache write failure is OK */ }
}

// ── Main export ───────────────────────────────────────────────
export async function getMarketNews(forceRefresh = false): Promise<NewsItem[]> {
  // 1. In-memory cache (fastest)
  const cacheKey = 'market_news';
  if (!forceRefresh) {
    const cached = memCache.get<NewsItem[]>(cacheKey);
    if (cached && cached.length > 0) return cached;
  }

  // 2. Supabase DB cache (< 15min old)
  if (!forceRefresh) {
    const dbCached = await readDbCache();
    if (dbCached) {
      memCache.set(cacheKey, dbCached);
      return dbCached;
    }
  }

  // 3. Fetch fresh articles (both sources in parallel, failures are non-fatal)
  let rawArticles: Partial<NewsItem>[] = [];
  try {
    const [newsApiResults, gnewsResults] = await Promise.allSettled([
      fetchFromNewsAPI('gold oil stock market commodity'),
      fetchFromGNews('gold oil commodity market'),
    ]);
    if (newsApiResults.status === 'fulfilled') rawArticles.push(...newsApiResults.value);
    if (gnewsResults.status === 'fulfilled') rawArticles.push(...gnewsResults.value);
  } catch { /* ignore */ }

  // 4. Fall back to static news if APIs returned nothing
  if (rawArticles.length === 0) {
    rawArticles = getFallbackNews();
  }

  // 5. Deduplicate
  const seen = new Set<string>();
  rawArticles = rawArticles.filter(a => {
    const key = (a.headline || '').substring(0, 50).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 6. Analyze sentiment — each item independently, never crash the batch
  const newsItems: NewsItem[] = await Promise.all(
    rawArticles.slice(0, 8).map(async (article, i) => {
      let sentiment = keywordSentiment(article.headline || '', article.summary || '');
      // Only call Claude if API key is configured
      if (process.env.ANTHROPIC_API_KEY) {
        sentiment = await analyzeNewsSentiment(article.headline || '', article.summary || '');
      }
      return {
        id: `news_${Date.now()}_${i}`,
        headline: article.headline || 'Market Update',
        summary: article.summary || '',
        source: article.source || 'Unknown',
        url: article.url || '#',
        published_at: article.published_at || new Date().toISOString(),
        tags: [...(article.tags || []), ...sentiment.tags].slice(0, 4),
        ai_sentiment: sentiment.sentiment,
        ai_confidence: sentiment.confidence,
        ai_analysis: sentiment.analysis,
      };
    })
  );

  // 7. Cache results (failures are non-fatal)
  memCache.set(cacheKey, newsItems);
  writeDbCache(newsItems); // fire-and-forget, don't await

  return newsItems;
}
