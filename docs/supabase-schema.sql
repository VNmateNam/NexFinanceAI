-- ============================================================
-- NexusAI - Supabase Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- WATCHLIST
-- ============================================================
CREATE TABLE watchlist (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('commodity', 'stock', 'index', 'crypto')),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, symbol)
);

-- ============================================================
-- PORTFOLIO POSITIONS
-- ============================================================
CREATE TABLE portfolio_positions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  quantity DECIMAL(18,6) NOT NULL,
  avg_cost DECIMAL(18,4) NOT NULL,
  current_price DECIMAL(18,4),
  color TEXT DEFAULT '#f5c842',
  notes TEXT,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRICE ALERTS
-- ============================================================
CREATE TABLE price_alerts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN ('above', 'below', 'percent_up', 'percent_down', 'signal_bullish', 'signal_bearish')),
  target_value DECIMAL(18,4) NOT NULL,
  current_value DECIMAL(18,4),
  notify_email BOOLEAN DEFAULT TRUE,
  notify_sms BOOLEAN DEFAULT FALSE,
  contact_email TEXT,
  contact_phone TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ALERT HISTORY (triggered alerts log)
-- ============================================================
CREATE TABLE alert_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  alert_id UUID REFERENCES price_alerts(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  message TEXT NOT NULL,
  price_at_trigger DECIMAL(18,4),
  notification_sent BOOLEAN DEFAULT FALSE,
  channel TEXT, -- 'email' | 'sms' | 'both'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRICE CACHE (avoid hitting APIs too often)
-- ============================================================
CREATE TABLE price_cache (
  symbol TEXT PRIMARY KEY,
  price DECIMAL(18,4) NOT NULL,
  change_pct DECIMAL(8,4),
  change_abs DECIMAL(18,4),
  high DECIMAL(18,4),
  low DECIMAL(18,4),
  volume BIGINT,
  market_cap BIGINT,
  source TEXT,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NEWS CACHE
-- ============================================================
CREATE TABLE news_cache (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  headline TEXT NOT NULL,
  summary TEXT,
  source TEXT,
  url TEXT,
  published_at TIMESTAMPTZ,
  tags TEXT[],
  ai_sentiment TEXT CHECK (ai_sentiment IN ('bullish', 'bearish', 'neutral')),
  ai_confidence INTEGER, -- 0-100
  ai_analysis TEXT,
  cached_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AI PREDICTIONS CACHE
-- ============================================================
CREATE TABLE ai_predictions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  symbol TEXT NOT NULL,
  direction TEXT CHECK (direction IN ('up', 'down', 'sideways')),
  confidence INTEGER, -- 0-100
  target_price DECIMAL(18,4),
  target_date DATE,
  reasoning TEXT,
  bullish_pct INTEGER,
  bearish_pct INTEGER,
  neutral_pct INTEGER,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, target_date)
);

-- ============================================================
-- CHAT HISTORY (per user)
-- ============================================================
CREATE TABLE chat_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SUBSCRIPTIONS (SaaS plans)
-- ============================================================
CREATE TABLE subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due')),
  price_usd DECIMAL(8,2) DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

-- Watchlist: own data only
CREATE POLICY "Watchlist own data" ON watchlist FOR ALL USING (auth.uid() = user_id);

-- Portfolio: own data only
CREATE POLICY "Portfolio own data" ON portfolio_positions FOR ALL USING (auth.uid() = user_id);

-- Alerts: own data only
CREATE POLICY "Alerts own data" ON price_alerts FOR ALL USING (auth.uid() = user_id);

-- Alert history: own data only
CREATE POLICY "Alert history own data" ON alert_history FOR ALL USING (auth.uid() = user_id);

-- Chat history: own data only
CREATE POLICY "Chat own data" ON chat_history FOR ALL USING (auth.uid() = user_id);

-- Subscriptions: own data only
CREATE POLICY "Subscriptions own data" ON subscriptions FOR ALL USING (auth.uid() = user_id);

-- Price/news cache: readable by all authenticated users
ALTER TABLE price_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Price cache readable" ON price_cache FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "News cache readable" ON news_cache FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Predictions readable" ON ai_predictions FOR SELECT TO authenticated USING (TRUE);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_portfolio_user ON portfolio_positions(user_id);
CREATE INDEX idx_alerts_user ON price_alerts(user_id);
CREATE INDEX idx_alerts_active ON price_alerts(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_news_cache_published ON news_cache(published_at DESC);
CREATE INDEX idx_chat_user ON chat_history(user_id, created_at DESC);
CREATE INDEX idx_price_cache_symbol ON price_cache(symbol);

-- ============================================================
-- SAMPLE DATA (optional - for testing)
-- ============================================================
INSERT INTO price_cache (symbol, price, change_pct, change_abs, source) VALUES
  ('XAU', 3327.40, 1.24, 40.72, 'metals.live'),
  ('XAG', 32.14, 0.83, 0.26, 'metals.live'),
  ('WTI', 62.18, -0.41, -0.26, 'alpha_vantage'),
  ('BRENT', 65.42, -0.61, -0.40, 'alpha_vantage')
ON CONFLICT (symbol) DO UPDATE SET price = EXCLUDED.price, fetched_at = NOW();
