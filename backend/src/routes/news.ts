import { Router, Request, Response } from 'express';
import { getMarketNews } from '../services/newsService';

export const newsRouter = Router();

// PUBLIC — no auth needed
newsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const news = await getMarketNews(forceRefresh);
    res.json({ success: true, data: news, count: news.length, timestamp: new Date().toISOString() });
  } catch { res.status(500).json({ error: 'Failed to fetch news' }); }
});
