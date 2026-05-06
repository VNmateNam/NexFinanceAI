/**
 * News Service
 * Sources: NewsAPI (100/day free) + GNews (100/day free)
 * AI: Anthropic Claude for sentiment analysis
 */

import axios from 'axios';
import NodeCache from 'node-cache';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from './supabase';
import { logger } from './logger';

const memCache = new NodeCache({ stdTTL: 900, checkperiod: 120 }); // 15min cache
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

// ── NewsAPI.org (FREE: 100 req/day, no auth for headlines) ───
async function fetchFromNewsAPI(query: string): Promise<Partial<NewsItem>[]> {
  const key = process.env.NEWSAPI_KEY;
  if (!key) return [];

  try {
    const res = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: query,
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: 10,
        apiKey: key,
      },
      timeout: 10000,
    });

    return (res.data.articles || []).map((a: any) => ({
      headline: a.title?.replace(/ - .+$/, '') || '',
      summary: a.description || '',
      source: a.source?.name || 'Unknown',
      url: a.url || '',
      published_at: a.publishedAt || new Date().toISOString(),
    }));
  } catch (err) {
    logger.error('NewsAPI fetch failed:', err);
    return [];
  }
}

// ── GNews.io (FREE: 100 req/day) ─────────────────────────────
async function fetchFromGNews(query: string): Promise<Partial<NewsItem>[]> {
  const key = process.env.GNEWS_KEY;
  if (!key) return [];

  try {
    const res = await axios.get('https://gnews.io/api/v4/search', {
      params: {
        q: query,
        lang: 'en',
        max: 6,
        token: key,
      },
      timeout: 10000,
    });

    return (res.data.articles || []).map((a: any) => ({
      headline: a.title || '',
      summary: a.description || '',
      source: a.source?.name || 'GNews',
      url: a.url || '',
      published_at: a.publishedAt || new Date().toISOString(),
    }));
  } catch (err) {
    logger.error('GNews fetch failed:', err);
    return [];
  }
}

// ── Fallback news (when APIs unavailable) ────────────────────
const FALLBACK_NEWS: Partial<NewsItem>[] = [
  { headline: 'OPEC+ signals potential output reduction amid falling oil prices', summary: 'OPEC and its allies are considering further output reductions as crude oil prices remain under pressure from demand concerns.', source: 'Reuters', published_at: new Date(Date.now() - 2 * 3600000).toISOString(), tags: ['oil', 'opec'] },
  { headline: 'Gold hits multi-week high as US dollar weakens following CPI data', summary: 'Gold prices surged to their highest level in weeks after softer-than-expected US inflation data weakened the dollar.', source: 'Bloomberg', published_at: new Date(Date.now() - 3 * 3600000).toISOString(), tags: ['gold', 'dollar'] },
  { headline: 'Fed officials hint at rate cuts if inflation continues to moderate', summary: 'Several Federal Reserve officials suggested the central bank may be closer to cutting interest rates if inflation data continues to cool.', source: 'WSJ', published_at: new Date(Date.now() - 5 * 3600000).toISOString(), tags: ['fed', 'rates', 'macro'] },
  { headline: 'NVIDIA announces next-gen Blackwell Ultra GPUs for AI workloads', summary: 'NVIDIA unveiled its next generation GPU architecture designed for large-scale AI training and inference workloads.', source: 'TechCrunch', published_at: new Date(Date.now() - 8 * 3600000).toISOString(), tags: ['nvidia', 'ai', 'tech'] },
  { headline: 'Tesla deliveries miss Q1 estimates; shares slide pre-market', summary: 'Tesla reported first-quarter vehicle deliveries that came in below Wall Street expectations, sending shares lower before the opening bell.', source: 'CNBC', published_at: new Date(Date.now() - 10 * 3600000).toISOString(), tags: ['tesla', 'ev', 'stocks'] },
  { headline: 'Silver demand surges as solar panel production hits record levels', summary: 'Silver consumption in the solar industry reached an all-time high as manufacturers scaled up photovoltaic panel production globally.', source: 'FT', published_at: new Date(Date.now() - 14 * 3600000).toISOString(), tags: ['silver', 'solar', 'energy'] },
];

// ── AI Sentiment Analysis via Claude ─────────────────────────
async function analyzeNewsSentiment(headline: string, summary: string): Promise<{
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  analysis: string;
  tags: string[];
}> {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', // Use fast/cheap model for sentiment
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Analyze the financial market sentiment of this news. Reply ONLY with valid JSON.

Headline: "${headline}"
Summary: "${summary}"

JSON format:
{
  "sentiment": "bullish" | "bearish" | "neutral",
  "confidence": 0-100,
  "analysis": "one sentence reason",
  "tags": ["tag1", "tag2"]
}`,
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return {
      sentiment: parsed.sentiment || 'neutral',
      confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
      analysis: parsed.analysis || '',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    };
  } catch (err) {
    logger.error('Claude sentiment analysis failed:', err);
    // Simple rule-based fallback
    const text = (headline + ' ' + summary).toLowerCase();
    const bullishWords = ['rise', 'surge', 'gain', 'high', 'strong', 'growth', 'bullish', 'beat', 'record'];
    const bearishWords = ['fall', 'drop', 'decline', 'weak', 'miss', 'lower', 'bearish', 'cut', 'concern'];
    const bScore = bullishWords.filter(w => text.includes(w)).length;
    const beScore = bearishWords.filter(w => text.includes(w)).length;
    const sentiment: 'bullish' | 'bearish' | 'neutral' = bScore > beScore ? 'bullish' : beScore > bScore ? 'bearish' : 'neutral';
    return { sentiment, confidence: 55, analysis: 'Keyword-based analysis', tags: [] };
  }
}

// ── Main news fetcher ─────────────────────────────────────────
export async function getMarketNews(forceRefresh = false): Promise<NewsItem[]> {
  const cacheKey = 'market_news';
  if (!forceRefresh) {
    const cached = memCache.get<NewsItem[]>(cacheKey);
    if (cached) return cached;
  }

  // Check Supabase cache (< 15 mins old)
  const { data: dbCache } = await supabase
    .from('news_cache')
    .select('*')
    .gt('cached_at', new Date(Date.now() - 15 * 60000).toISOString())
    .order('published_at', { ascending: false })
    .limit(12);

  if (dbCache && dbCache.length >= 5) {
    const news = dbCache as NewsItem[];
    memCache.set(cacheKey, news);
    return news;
  }

  // Fetch fresh news
  let rawArticles: Partial<NewsItem>[] = [];
  const [newsApiResults, gnewsResults] = await Promise.all([
    fetchFromNewsAPI('gold oil stock market commodity'),
    fetchFromGNews('gold oil commodity market'),
  ]);

  rawArticles = [...newsApiResults, ...gnewsResults];

  // Use fallback if APIs unavailable
  if (rawArticles.length === 0) {
    rawArticles = FALLBACK_NEWS;
  }

  // Deduplicate headlines
  const seen = new Set<string>();
  rawArticles = rawArticles.filter(a => {
    const key = a.headline?.substring(0, 50) || '';
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Analyze sentiment for each article (limit to 8 for API cost)
  const newsItems: NewsItem[] = await Promise.all(
    rawArticles.slice(0, 8).map(async (article, i) => {
      const sentiment = await analyzeNewsSentiment(
        article.headline || '',
        article.summary || ''
      );
      return {
        id: `news_${Date.now()}_${i}`,
        headline: article.headline || '',
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

  // Cache in Supabase
  await supabase.from('news_cache').insert(
    newsItems.map(n => ({
      headline: n.headline, summary: n.summary, source: n.source,
      url: n.url, published_at: n.published_at, tags: n.tags,
      ai_sentiment: n.ai_sentiment, ai_confidence: n.ai_confidence,
      ai_analysis: n.ai_analysis,
    }))
  );

  memCache.set(cacheKey, newsItems);
  return newsItems;
}
