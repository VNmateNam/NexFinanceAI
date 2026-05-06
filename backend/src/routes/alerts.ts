import { Router, Response } from 'express';
import { supabase } from '../services/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';

export const alertsRouter = Router();
alertsRouter.use(requireAuth);

// GET /api/alerts
alertsRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase
    .from('price_alerts')
    .select('*')
    .eq('user_id', req.user!.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// GET /api/alerts/history
alertsRouter.get('/history', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase
    .from('alert_history')
    .select('*')
    .eq('user_id', req.user!.id)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// POST /api/alerts
alertsRouter.post('/', async (req: AuthRequest, res: Response) => {
  const { symbol, asset_name, condition, target_value, notify_email, notify_sms, contact_email, contact_phone } = req.body;
  if (!symbol || !asset_name || !condition || target_value == null) {
    return res.status(400).json({ error: 'symbol, asset_name, condition, target_value are required' });
  }
  const { data, error } = await supabase.from('price_alerts').insert({
    user_id: req.user!.id,
    symbol: symbol.toUpperCase(),
    asset_name, condition,
    target_value: parseFloat(target_value),
    notify_email: notify_email ?? true,
    notify_sms: notify_sms ?? false,
    contact_email: contact_email || null,
    contact_phone: contact_phone || null,
    is_active: true,
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ success: true, data });
});

// PUT /api/alerts/:id
alertsRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  const allowed = ['is_active', 'target_value', 'notify_email', 'notify_sms', 'contact_email', 'contact_phone'];
  const patch: Record<string, any> = {};
  for (const k of allowed) if (req.body[k] !== undefined) patch[k] = req.body[k];
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'No valid fields to update' });
  const { data, error } = await supabase.from('price_alerts')
    .update(patch)
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// DELETE /api/alerts/:id
alertsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const { error } = await supabase.from('price_alerts')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});
