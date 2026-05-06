import { Request, Response, NextFunction } from 'express';
import { supabase } from '../services/supabase';

export interface AuthRequest extends Request {
  user?: { id: string; email: string; plan: string; is_admin: boolean };
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No authorization token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' });

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, plan, is_admin')
      .eq('id', user.id)
      .single();

    if (!profile) return res.status(401).json({ error: 'User profile not found' });
    req.user = profile;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token verification failed' });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user?.is_admin) return res.status(403).json({ error: 'Admin access required' });
  next();
}
