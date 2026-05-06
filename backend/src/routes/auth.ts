import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';

export const authRouter = Router();

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'email and password required' });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: error.message });

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', data.user.id).single();

  res.json({ success: true, user: profile, session: data.session });
});

// POST /api/auth/refresh  ← NEW: called automatically by the Axios interceptor
authRouter.post('/refresh', async (req: Request, res: Response) => {
  const { refresh_token } = req.body;
  if (!refresh_token)
    return res.status(400).json({ error: 'refresh_token required' });

  const { data, error } = await supabase.auth.refreshSession({ refresh_token });
  if (error || !data.session)
    return res.status(401).json({ error: error?.message ?? 'Refresh failed' });

  res.json({ success: true, session: data.session });
});

// POST /api/auth/logout
authRouter.post('/logout', async (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) await supabase.auth.admin.signOut(token).catch(() => {});
  res.json({ success: true });
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', req.user!.id).single();
  res.json({ success: true, data: profile });
});
