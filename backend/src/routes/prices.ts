import { Router, Request, Response } from 'express';
import { getCommodityPrices, getStockPrice, getStockPrices, fetchCryptoPrices, fetchHistoricalData } from '../services/priceService';

export const pricesRouter = Router();

// All price endpoints are PUBLIC (no auth) so the frontend ticker works without login
pricesRouter.get('/commodities', async (_req: Request, res: Response) => {
  try {
    const prices = await getCommodityPrices();
    res.json({ success: true, data: prices, timestamp: new Date().toISOString() });
  } catch { res.status(500).json({ error: 'Failed to fetch commodity prices' }); }
});

pricesRouter.get('/stocks', async (req: Request, res: Response) => {
  try {
    const symbols = ((req.query.symbols as string) || 'AAPL,TSLA,NVDA,MSFT,META,GOOGL')
      .split(',').map(s => s.trim().toUpperCase()).slice(0, 8);
    const prices = await getStockPrices(symbols);
    res.json({ success: true, data: prices, timestamp: new Date().toISOString() });
  } catch { res.status(500).json({ error: 'Failed to fetch stock prices' }); }
});

pricesRouter.get('/stocks/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const price = await getStockPrice(symbol);
    if (!price) return res.status(404).json({ error: `Symbol ${symbol} not found` });
    res.json({ success: true, data: price });
  } catch { res.status(500).json({ error: 'Failed to fetch stock price' }); }
});

pricesRouter.get('/crypto', async (req: Request, res: Response) => {
  try {
    const symbols = ((req.query.symbols as string) || 'BTC,ETH,SOL,BNB,XRP,DOGE')
      .split(',').map((s: string) => s.trim().toUpperCase()).slice(0, 10);
    const prices = await fetchCryptoPrices(symbols);
    res.json({ success: true, data: prices, timestamp: new Date().toISOString() });
  } catch { res.status(500).json({ error: 'Failed to fetch crypto prices' }); }
});

pricesRouter.get('/history/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const days = Math.min(365, Math.max(7, parseInt(req.query.days as string) || 30));
    const history = await fetchHistoricalData(symbol, days);
    res.json({ success: true, symbol, data: history, count: history.length });
  } catch { res.status(500).json({ error: 'Failed to fetch historical data' }); }
});
