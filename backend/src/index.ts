import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import { logger } from './services/logger';
import { supabase } from './services/supabase';
import { pricesRouter } from './routes/prices';
import { newsRouter } from './routes/news';
import { aiRouter } from './routes/ai';
import { alertsRouter } from './routes/alerts';
import { portfolioRouter } from './routes/portfolio';
import { authRouter } from './routes/auth';
import { adminRouter } from './routes/admin';
import { stripeRouter, stripeWebhookHandler } from './routes/stripe';
import { checkAlerts } from './services/alertChecker';
import { refreshPriceCache } from './services/priceService';


const app = express();
const PORT = process.env.PORT || 4000;

// ── CORS — must come BEFORE helmet and all routes ─────────────
// Reads FRONTEND_URL from env; supports comma-separated list for multiple origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  ...(process.env.FRONTEND_URL || '')
    .split(',')
    .map(u => u.trim())
    .filter(Boolean),
];

logger.info(`Allowed CORS origins: ${allowedOrigins.join(', ')}`);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    logger.warn(`CORS blocked origin: ${origin}`);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Authorization'],
}));

// Handle OPTIONS preflight for all routes
app.options('*', cors());

// ── Security (after CORS so helmet doesn't strip auth headers) ─
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: false,
}));
app.use(express.json({ limit: '10mb' }));

// ── Rate limiting ─────────────────────────────────────────────
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));
// Stricter limit for AI endpoints
app.use('/api/ai/chat', rateLimit({ windowMs: 60 * 1000, max: 20 }));
app.use('/api/ai/prediction', rateLimit({ windowMs: 60 * 1000, max: 30 }));

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/prices', pricesRouter);
app.use('/api/news', newsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/admin', adminRouter);

// Stripe webhook needs raw body — register BEFORE express.json is applied to this path
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);
app.use('/api/stripe', stripeRouter);

// ── Health ────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '3.0.0',
    supabase_configured: !!process.env.SUPABASE_URL,
    frontend_url: process.env.FRONTEND_URL || 'NOT SET',
  });
});

// ── Debug: test token validation (use this to diagnose 401s) ──
// Visit: https://your-railway-url.up.railway.app/debug/auth
// With header: Authorization: Bearer <your-token>
app.get('/debug/auth', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.json({
      result: 'NO TOKEN',
      hint: 'Send Authorization: Bearer <token> header',
    });
  }
  const token = authHeader.split(' ')[1];
  try {
    const { data, error } = await supabase.auth.getUser(token);
    res.json({
      result: error ? 'REJECTED' : 'ACCEPTED',
      user_id: data?.user?.id ?? null,
      user_email: data?.user?.email ?? null,
      error: error?.message ?? null,
      token_prefix: token.substring(0, 20) + '...',
      supabase_url: process.env.SUPABASE_URL?.substring(0, 35) + '...',
    });
  } catch (err: any) {
    res.json({ result: 'ERROR', message: err?.message });
  }
});

// ── 404 ───────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Error handler ─────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Cron jobs ─────────────────────────────────────────────────
cron.schedule('*/5 * * * *', async () => {
  logger.info('[cron] Refreshing price cache');
  await refreshPriceCache().catch(logger.error);
});

cron.schedule('*/3 * * * *', async () => {
  logger.info('[cron] Checking price alerts');
  await checkAlerts().catch(logger.error);
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`🚀 NexusAI API v3 running on port ${PORT}`);
  logger.info(`   ENV: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`   CORS origin: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  refreshPriceCache().catch(logger.error);
});

export default app;
