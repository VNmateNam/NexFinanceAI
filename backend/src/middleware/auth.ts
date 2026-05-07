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

  // Log token prefix for debugging (never log the full token)
  const tokenPreview = token.substring(0, 20) + '...';

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) {
      console.error(`[auth] getUser failed — token: ${tokenPreview} — error: ${error.message}`);
      return res.status(401).json({ error: `Token rejected: ${error.message}` });
    }

    if (!user) {
      console.error(`[auth] getUser returned no user — token: ${tokenPreview}`);
      return res.status(401).json({ error: 'No user found for token' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, plan, is_admin')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error(`[auth] profile fetch failed for user ${user.id}: ${profileError.message}`);
      // Profile missing — create it on the fly (handles race condition on first login)
      const { data: newProfile } = await supabase
        .from('profiles')
        .upsert({ id: user.id, email: user.email ?? '', plan: 'free', is_admin: false })
        .select()
        .single();

      if (newProfile) {
        req.user = newProfile;
        return next();
      }
      return res.status(401).json({ error: 'User profile not found' });
    }

    req.user = profile;
    next();
  } catch (err: any) {
    console.error(`[auth] unexpected error: ${err?.message ?? err}`);
    return res.status(401).json({ error: 'Token verification failed' });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user?.is_admin) return res.status(403).json({ error: 'Admin access required' });
  next();
}
