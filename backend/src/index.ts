import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import { logger } from './services/logger';
import { pricesRouter } from './routes/prices';
import { newsRouter } from './routes/news';
import { aiRouter } from './routes/ai';
import { alertsRouter } from './routes/alerts';
import { portfolioRouter } from './routes/portfolio';
import { authRouter } from './routes/auth';
import { adminRouter } from './routes/admin';
import { checkAlerts } from './services/alertChecker';
import { refreshPriceCache } from './services/priceService';

const app = express();
const PORT = process.env.PORT || 4000;

// ── Security ─────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map(u => u.trim()),
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// ── Rate limiting ─────────────────────────────────────────────
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));
// Stricter limit for AI endpoints
app.use('/api/ai/chat', rateLimit({ windowMs: 60 * 1000, max: 20 }));
app.use('/api/ai/prediction', rateLimit({ windowMs: 60 * 1000, max: 30 }));

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',      authRouter);
app.use('/api/prices',    pricesRouter);
app.use('/api/news',      newsRouter);
app.use('/api/ai',        aiRouter);
app.use('/api/alerts',    alertsRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/admin',     adminRouter);

// ── Health ────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '3.0.0' });
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
