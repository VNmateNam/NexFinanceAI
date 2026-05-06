# ⚡ NexusAI — AI-Powered Financial Intelligence Dashboard

A full-stack SaaS platform for real-time commodity & stock analytics with AI predictions, smart alerts, and an AI chat assistant.

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript + TailwindCSS + Recharts |
| Backend | Node.js + Express + TypeScript |
| Database | Supabase (PostgreSQL + Auth + Realtime) |
| AI | Anthropic Claude API |
| Notifications | Resend (email) + Twilio (SMS) |
| Deployment | Vercel (frontend) + Railway (backend) |

## 📡 Free APIs Used

| API | What For | Free Tier |
|-----|----------|-----------|
| [Alpha Vantage](https://www.alphavantage.co) | Stock prices & historical data | 25 req/day |
| [Metals.live](https://metals.live) | Gold/Silver spot prices | Unlimited |
| [Open Exchange Rates](https://openexchangerates.org) | Currency / USD index | 1000 req/month |
| [NewsAPI](https://newsapi.org) | Financial news headlines | 100 req/day |
| [GNews](https://gnews.io) | Backup news source | 100 req/day |
| [Frankfurter](https://www.frankfurter.app) | Exchange rates (no key needed) | Unlimited |
| [Anthropic Claude](https://anthropic.com) | AI chat + sentiment analysis | Pay-as-you-go |
| [Supabase](https://supabase.com) | Database + Auth + Realtime | 500MB free |
| [Resend](https://resend.com) | Email alerts | 3000/month free |
| [Twilio](https://twilio.com) | SMS alerts | Trial credit |

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone <your-repo>
cd nexusai

# Install backend deps
cd backend && npm install

# Install frontend deps
cd ../frontend && npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` in both `/backend` and `/frontend`:

**Backend `.env`:**
```env
PORT=4000
NODE_ENV=development

# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Free Market APIs
ALPHA_VANTAGE_KEY=your_key          # alphavantage.co - FREE
NEWSAPI_KEY=your_key                # newsapi.org - FREE
GNEWS_KEY=your_key                  # gnews.io - FREE

# AI
ANTHROPIC_API_KEY=your_key

# Notifications
RESEND_API_KEY=your_key             # resend.com - FREE 3000/mo
TWILIO_ACCOUNT_SID=your_sid         # twilio.com - trial
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE=+1234567890

# Security
JWT_SECRET=your_super_secret_jwt_key_min_32_chars
FRONTEND_URL=http://localhost:5173
```

**Frontend `.env`:**
```env
VITE_API_URL=http://localhost:4000
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Supabase Setup

Run the SQL in `docs/supabase-schema.sql` in your Supabase SQL editor.

### 4. Run Development

```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

Frontend: http://localhost:5173  
Backend API: http://localhost:4000

## 📁 Project Structure

```
nexusai/
├── frontend/               # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Dashboard, Markets, Portfolio, etc.
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API calls
│   │   ├── store/          # Zustand state management
│   │   └── types/          # TypeScript types
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic + external APIs
│   │   ├── middleware/      # Auth, rate limiting, validation
│   │   └── types/          # TypeScript types
│   ├── package.json
│   └── tsconfig.json
│
└── docs/
    └── supabase-schema.sql # Full database schema
```

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/prices/commodities` | Gold, Silver, Oil prices |
| GET | `/api/prices/stocks/:symbol` | Stock quote |
| GET | `/api/prices/history/:symbol` | Historical data |
| GET | `/api/news` | Market news + AI sentiment |
| GET | `/api/ai/prediction/:symbol` | AI price prediction |
| POST | `/api/ai/chat` | AI assistant chat |
| GET | `/api/portfolio` | User portfolio |
| POST | `/api/portfolio/trade` | Add position |
| GET | `/api/alerts` | User alerts |
| POST | `/api/alerts` | Create alert |
| DELETE | `/api/alerts/:id` | Delete alert |
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login |
| GET | `/api/admin/stats` | Admin dashboard stats |

## 🚢 Deployment

### Backend → Railway
```bash
cd backend
railway login
railway init
railway up
```

### Frontend → Vercel
```bash
cd frontend
vercel --prod
```

## 📊 Features

- ✅ Live prices (Gold, Silver, WTI Oil, Brent, Stocks)
- ✅ Interactive charts (line, candlestick, multi-asset)
- ✅ AI sentiment analysis on news
- ✅ 7-day AI price predictions
- ✅ Smart price alerts (email + SMS)
- ✅ AI chat assistant with live context
- ✅ Portfolio tracker with P&L
- ✅ Admin dashboard
- ✅ JWT authentication
- ✅ Real-time updates via polling
- ✅ Rate limiting & caching
