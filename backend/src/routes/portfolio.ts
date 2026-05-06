import { Router, Response } from 'express';
import { supabase } from '../services/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getCommodityPrices, getStockPrice } from '../services/priceService';

export const portfolioRouter = Router();
portfolioRouter.use(requireAuth);

// GET /api/portfolio — positions with live P&L
portfolioRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { data: positions, error } = await supabase
    .from('portfolio_positions')
    .select('*')
    .eq('user_id', req.user!.id)
    .order('opened_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  // Enrich with live prices
  const commodities = await getCommodityPrices();
  const priceMap: Record<string, number> = {};
  for (const c of commodities) priceMap[c.symbol] = c.price;

  const enriched = await Promise.all((positions || []).map(async (pos: any) => {
    let currentPrice = priceMap[pos.symbol];
    if (!currentPrice) {
      const stock = await getStockPrice(pos.symbol);
      currentPrice = stock?.price || pos.avg_cost;
    }
    const marketValue = currentPrice * pos.quantity;
    const costBasis = pos.avg_cost * pos.quantity;
    const pnl = marketValue - costBasis;
    const pnlPct = ((pnl / costBasis) * 100);
    return { ...pos, current_price: currentPrice, market_value: marketValue, pnl, pnl_pct: pnlPct };
  }));

  const totalValue = enriched.reduce((s, p) => s + p.market_value, 0);
  const totalCost = enriched.reduce((s, p) => s + (p.avg_cost * p.quantity), 0);
  const totalPnl = totalValue - totalCost;

  res.json({
    success: true,
    data: {
      positions: enriched,
      summary: { total_value: totalValue, total_cost: totalCost, total_pnl: totalPnl, total_pnl_pct: (totalPnl / totalCost) * 100 },
    },
  });
});

// POST /api/portfolio — add position
portfolioRouter.post('/', async (req: AuthRequest, res: Response) => {
  const { symbol, name, asset_type, quantity, avg_cost, color, notes } = req.body;
  if (!symbol || !name || !asset_type || !quantity || !avg_cost) {
    return res.status(400).json({ error: 'symbol, name, asset_type, quantity, avg_cost required' });
  }
  const { data, error } = await supabase.from('portfolio_positions').insert({
    user_id: req.user!.id,
    symbol: symbol.toUpperCase(),
    name, asset_type, quantity, avg_cost, color: color || '#f5c842', notes,
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ success: true, data });
});

// DELETE /api/portfolio/:id — close position
portfolioRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const { error } = await supabase.from('portfolio_positions')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// GET /api/portfolio/watchlist
portfolioRouter.get('/watchlist', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase
    .from('watchlist')
    .select('*')
    .eq('user_id', req.user!.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// POST /api/portfolio/watchlist
portfolioRouter.post('/watchlist', async (req: AuthRequest, res: Response) => {
  const { symbol, name, asset_type } = req.body;
  const { data, error } = await supabase.from('watchlist').insert({
    user_id: req.user!.id, symbol: symbol.toUpperCase(), name, asset_type,
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ success: true, data });
});
