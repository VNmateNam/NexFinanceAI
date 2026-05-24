import { Router, Request, Response } from 'express';
import { getPricePrediction, chatWithAI, getMarketSentimentSummary } from '../services/aiService';
import { requireAuth, AuthRequest } from '../middleware/auth';

export const aiRouter = Router();

// PUBLIC — sentiment & prediction (no auth, rate-limited at Express level)
aiRouter.get('/sentiment', async (_req: Request, res: Response) => {
  try {
    const summary = await getMarketSentimentSummary();
    res.json({ success: true, data: summary });
  } catch (err: any) {
    console.error('[AI] sentiment error:', err?.message);
    // Return a safe fallback instead of 500
    res.json({
      success: true,
      data: {
        overall: 'neutral',
        score: 50,
        assets: [
          { symbol: 'XAU', name: 'Gold', bullish: 60, bearish: 25, neutral: 15, note: 'Safe-haven demand remains elevated' },
          { symbol: 'WTI', name: 'WTI Oil', bullish: 45, bearish: 40, neutral: 15, note: 'Awaiting OPEC+ guidance' },
          { symbol: 'XAG', name: 'Silver', bullish: 58, bearish: 28, neutral: 14, note: 'Industrial demand from solar sector' },
          { symbol: 'NVDA', name: 'NVIDIA', bullish: 75, bearish: 15, neutral: 10, note: 'AI chip demand driving growth' },
          { symbol: 'TSLA', name: 'Tesla', bullish: 42, bearish: 45, neutral: 13, note: 'EV competition and margin pressure' },
          { symbol: 'SPX', name: 'S&P 500', bullish: 58, bearish: 25, neutral: 17, note: 'Earnings season supporting rally' },
        ],
      },
      _fallback: true,
    });
  }
});

aiRouter.get('/prediction/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const prediction = await getPricePrediction(symbol);
    if (!prediction) return res.status(404).json({ error: 'Could not generate prediction' });
    res.json({ success: true, data: prediction });
  } catch (err: any) {
    console.error('[AI] prediction error:', err?.message);
    res.status(404).json({ error: 'Prediction temporarily unavailable' });
  }
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
    console.error('[AI] chat error:', err?.message);
    res.status(500).json({ error: err.message || 'AI chat unavailable' });
  }
});

