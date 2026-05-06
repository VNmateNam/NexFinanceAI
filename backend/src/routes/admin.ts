import { Router, Response } from 'express';
import { supabase } from '../services/supabase';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

// GET /api/admin/stats
adminRouter.get('/stats', async (_req: AuthRequest, res: Response) => {
  const [
    { count: totalUsers },
    { count: proUsers },
    { count: totalAlerts },
    { data: recentSignups },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'pro'),
    supabase.from('price_alerts').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('profiles').select('id,created_at').gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
  ]);

  res.json({
    success: true,
    data: {
      total_users: totalUsers || 0,
      pro_users: proUsers || 0,
      active_alerts: totalAlerts || 0,
      new_users_7d: recentSignups?.length || 0,
      mrr: ((proUsers || 0) * 20 + (0 * 99)), // $20/mo pro, $99/mo enterprise
    },
  });
});

// GET /api/admin/users
adminRouter.get('/users', async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = 20;
  const { data, error, count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data, total: count, page, limit });
});

// PATCH /api/admin/users/:id/plan
adminRouter.patch('/users/:id/plan', async (req: AuthRequest, res: Response) => {
  const { plan } = req.body;
  const { data, error } = await supabase.from('profiles')
    .update({ plan }).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});
