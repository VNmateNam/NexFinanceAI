import { Router, Request, Response } from 'express';
import { getPricePrediction, chatWithAI, getMarketSentimentSummary } from '../services/aiService';
import { requireAuth, AuthRequest } from '../middleware/auth';

export const aiRouter = Router();

// PUBLIC — sentiment & prediction (no auth, rate-limited at Express level)
aiRouter.get('/sentiment', async (_req: Request, res: Response) => {
  try {
    const summary = await getMarketSentimentSummary();
    res.json({ success: true, data: summary });
  } catch { res.status(500).json({ error: 'Sentiment service unavailable' }); }
});

aiRouter.get('/prediction/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const prediction = await getPricePrediction(symbol);
    if (!prediction) return res.status(404).json({ error: 'Could not generate prediction' });
    res.json({ success: true, data: prediction });
  } catch { res.status(500).json({ error: 'Prediction service unavailable' }); }
});

// PROTECTED — chat requires auth
aiRouter.post('/chat', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required' });
    }
    const reply = await chatWithAI(messages, req.user?.id);
    res.json({ success: true, reply });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'AI chat unavailable' });
  }
});
