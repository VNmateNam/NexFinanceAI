import { Router, Request, Response } from 'express';
import { getMarketNews } from '../services/newsService';

export const newsRouter = Router();

// PUBLIC — no auth needed
newsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const news = await getMarketNews(forceRefresh);
    res.json({ success: true, data: news, count: news.length, timestamp: new Date().toISOString() });
  } catch (err: any) {
    // Never return 500 to client — always return fallback data
    console.error('[News] route error:', err?.message);
    res.json({
      success: true,
      data: [],
      count: 0,
      timestamp: new Date().toISOString(),
      _fallback: true,
    });
  }
});

