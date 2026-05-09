/**
 * api.ts
 *
 * Uses Supabase's own session management — no manual localStorage reads,
 * no custom token storage, no custom refresh logic.
 *
 * supabase.auth.getSession() always returns the current valid token,
 * refreshing it automatically if it has expired.
 */
import axios from 'axios';
import { supabase } from './supabase';
import { useAuthStore } from '../store/authStore';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');

export const api = axios.create({ baseURL: API_BASE, timeout: 15000 });

// ── Request: get fresh token from Supabase on every request ───
api.interceptors.request.use(async config => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return config;
});

// ── Response: on 401, force a session refresh then retry once ─
api.interceptors.response.use(
  res => res,
  async (err) => {
    const cfg = err.config;
    if (err.response?.status !== 401 || cfg?._retried) return Promise.reject(err);
    if (cfg?.url?.includes('/api/auth/')) return Promise.reject(err);
    cfg._retried = true;

    // Ask Supabase to refresh the session
    const { data: { session } } = await supabase.auth.refreshSession();
    if (session?.access_token) {
      cfg.headers['Authorization'] = `Bearer ${session.access_token}`;
      return api(cfg);
    }

    // Refresh failed — sign out everywhere
    await supabase.auth.signOut();
    useAuthStore.getState().logout();
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────
export const authApi = {
  // Login goes straight to Supabase — no backend call needed
  login: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },
  logout: async () => {
    await supabase.auth.signOut();
    await api.post('/api/auth/logout').catch(() => { });
  },
  me: () => api.get('/api/auth/me').then(r => r.data.data),
};

// ── Prices (PUBLIC) ───────────────────────────────────────────
export const pricesApi = {
  getCommodities: () => api.get('/api/prices/commodities').then(r => r.data.data),
  getStocks: (symbols: string[]) =>
    api.get(`/api/prices/stocks?symbols=${symbols.join(',')}`).then(r => r.data.data),
  getHistory: (symbol: string, days = 30) =>
    api.get(`/api/prices/history/${symbol}?days=${days}`).then(r => r.data.data),
};

// ── News (PUBLIC) ─────────────────────────────────────────────
export const newsApi = {
  getNews: (refresh = false) =>
    api.get(`/api/news${refresh ? '?refresh=true' : ''}`).then(r => r.data.data),
};

// ── AI ────────────────────────────────────────────────────────
export const aiApi = {
  getSentiment: () => api.get('/api/ai/sentiment').then(r => r.data.data),
  getPrediction: (symbol: string) =>
    api.get(`/api/ai/prediction/${symbol}`).then(r => r.data.data),
  chat: (messages: { role: string; content: string }[]) =>
    api.post('/api/ai/chat', { messages }).then(r => r.data.reply),
};

// ── Alerts (PROTECTED) ────────────────────────────────────────
export const alertsApi = {
  getAlerts: () => api.get('/api/alerts').then(r => r.data.data),
  getHistory: () => api.get('/api/alerts/history').then(r => r.data.data),
  createAlert: (d: any) => api.post('/api/alerts', d).then(r => r.data.data),
  updateAlert: (id: string, d: any) => api.put(`/api/alerts/${id}`, d).then(r => r.data.data),
  deleteAlert: (id: string) => api.delete(`/api/alerts/${id}`).then(r => r.data),
};

// ── Portfolio (PROTECTED) ─────────────────────────────────────
export const portfolioApi = {
  getPortfolio: () => api.get('/api/portfolio').then(r => r.data.data),
  addPosition: (d: any) => api.post('/api/portfolio', d).then(r => r.data.data),
  closePosition: (id: string) => api.delete(`/api/portfolio/${id}`).then(r => r.data),
};

// ── Admin (PROTECTED + ADMIN) ─────────────────────────────────
export const adminApi = {
  getStats: () => api.get('/api/admin/stats').then(r => r.data.data),
  getUsers: (page = 1) => api.get(`/api/admin/users?page=${page}`).then(r => r.data),
  updateUserPlan: (id: string, plan: string) =>
    api.patch(`/api/admin/users/${id}/plan`, { plan }).then(r => r.data.data),
};

export default api;
