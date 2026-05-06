export interface PriceData {
  symbol: string;
  name: string;
  price: number;
  change_pct: number;
  change_abs: number;
  high?: number;
  low?: number;
  volume?: number;
  source: string;
  fetched_at: string;
}

export interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  source: string;
  url: string;
  published_at: string;
  tags: string[];
  ai_sentiment: 'bullish' | 'bearish' | 'neutral';
  ai_confidence: number;
  ai_analysis: string;
}

export interface AIPrediction {
  symbol: string;
  name: string;
  direction: 'up' | 'down' | 'sideways';
  confidence: number;
  target_price: number;
  current_price: number;
  bullish_pct: number;
  bearish_pct: number;
  neutral_pct: number;
  reasoning: string;
  generated_at: string;
}

export interface SentimentAsset {
  symbol: string;
  name: string;
  bullish: number;
  bearish: number;
  neutral: number;
  note: string;
}

export interface MarketSentiment {
  overall: 'bullish' | 'bearish' | 'neutral';
  score: number;
  assets: SentimentAsset[];
}

export interface PortfolioPosition {
  id: string;
  symbol: string;
  name: string;
  asset_type: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  market_value: number;
  pnl: number;
  pnl_pct: number;
  color: string;
  opened_at: string;
}

export interface PortfolioSummary {
  total_value: number;
  total_cost: number;
  total_pnl: number;
  total_pnl_pct: number;
}

export interface PriceAlert {
  id: string;
  symbol: string;
  asset_name: string;
  condition: 'above' | 'below' | 'percent_up' | 'percent_down' | 'signal_bullish' | 'signal_bearish';
  target_value: number;
  current_value?: number;
  notify_email: boolean;
  notify_sms: boolean;
  contact_email?: string;
  contact_phone?: string;
  is_active: boolean;
  triggered_at?: string;
  created_at: string;
}

export interface AlertHistoryItem {
  id: string;
  symbol: string;
  message: string;
  price_at_trigger: number;
  notification_sent: boolean;
  channel: string;
  created_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  plan: 'free' | 'pro' | 'enterprise';
  is_admin: boolean;
  created_at: string;
}

export interface AdminStats {
  total_users: number;
  pro_users: number;
  active_alerts: number;
  new_users_7d: number;
  mrr: number;
}

export interface HistoricalPoint {
  date: string;
  price: number;
}
