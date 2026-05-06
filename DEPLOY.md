# 🚀 Deployment Guide — NexusAI v3

## Prerequisites
- Supabase project created + schema applied (`docs/supabase-schema.sql`)
- All API keys ready (see table below)

## Step 1 — Backend → Railway

```bash
cd backend
npm install -g @railway/cli
railway login
railway init          # creates a new project
railway up            # deploys

# Set env vars in Railway dashboard or CLI:
railway variables set SUPABASE_URL=https://xxx.supabase.co
railway variables set SUPABASE_ANON_KEY=eyJ...
railway variables set SUPABASE_SERVICE_ROLE_KEY=eyJ...
railway variables set ANTHROPIC_API_KEY=sk-ant-...
railway variables set ALPHA_VANTAGE_KEY=YOUR_KEY
railway variables set NEWSAPI_KEY=YOUR_KEY
railway variables set GNEWS_KEY=YOUR_KEY
railway variables set RESEND_API_KEY=re_...
railway variables set TWILIO_ACCOUNT_SID=AC...
railway variables set TWILIO_AUTH_TOKEN=...
railway variables set TWILIO_PHONE=+1234567890
railway variables set NODE_ENV=production
railway variables set FRONTEND_URL=https://your-app.vercel.app

# Get your backend URL from Railway dashboard, e.g.:
# https://nexusai-backend-production.up.railway.app
```

## Step 2 — Frontend → Vercel

```bash
cd frontend
npm install -g vercel
vercel login
vercel --prod

# Set env vars in Vercel dashboard → Settings → Environment Variables:
VITE_API_URL=https://nexusai-backend-production.up.railway.app
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## Step 3 — Update CORS

After getting your Vercel URL, update the Railway env var:
```bash
railway variables set FRONTEND_URL=https://your-app.vercel.app
```

## API Keys Reference

| Service | URL | Free Tier | Used For |
|---------|-----|-----------|----------|
| Supabase | supabase.com | 500MB forever | DB + Auth |
| Alpha Vantage | alphavantage.co/support | 25 req/day | Stock prices + Oil |
| Metals.live | metals.live | Unlimited | Gold + Silver |
| NewsAPI | newsapi.org/register | 100 req/day | Market news |
| GNews | gnews.io | 100 req/day | Backup news |
| Frankfurter | frankfurter.app | Unlimited, no key | Exchange rates |
| Anthropic | console.anthropic.com | Pay per use | AI chat + predictions |
| Resend | resend.com | 3000 emails/month | Alert emails |
| Twilio | twilio.com | Trial credit | Alert SMS |
| Railway | railway.app | $5/month | Backend hosting |
| Vercel | vercel.com | Free | Frontend hosting |

## Supabase Setup

1. Create project at supabase.com
2. Go to SQL Editor → paste contents of `docs/supabase-schema.sql` → Run
3. Go to Settings → API → copy URL, anon key, service_role key
4. Go to Authentication → URL Configuration → add your Vercel URL to Site URL

## Local Development

```bash
# Backend
cd backend
cp .env.example .env   # fill in your keys
npm install
npm run dev            # runs on http://localhost:4000

# Frontend (new terminal)
cd frontend
cp .env.example .env   # set VITE_API_URL=http://localhost:4000
npm install
npm run dev            # runs on http://localhost:5173
```
