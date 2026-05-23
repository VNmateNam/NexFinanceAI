import axios from 'axios';
import { supabase } from './supabase';
import { useAuthStore } from '../store/authStore';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');
console.log('[API] base:', API_BASE);

export const api = axios.create({ baseURL: API_BASE, timeout: 20000 });

// Attach Supabase session token to every request
api.interceptors.request.use(async config => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return config;
});

// Response interceptor: retry on network errors + handle 401
api.interceptors.response.use(
  res => res,
  async (err) => {
    const cfg = err.config;

    // Retry network errors once (Railway cold start / intermittent ERR_FAILED)
    if (!err.response && !cfg?._networkRetried) {
      cfg._networkRetried = true;
      await new Promise(r => setTimeout(r, 1200)); // wait 1.2s then retry
      return api(cfg);
    }

    // On 401 — refresh session and retry once
    if (err.response?.status !== 401 || cfg?._retried) return Promise.reject(err);
    if (cfg?.url?.includes('/api/auth/')) return Promise.reject(err);
    cfg._retried = true;
    const { data: { session } } = await supabase.auth.refreshSession();
    if (session?.access_token) {
      cfg.headers['Authorization'] = `Bearer ${session.access_token}`;
      return api(cfg);
    }
    await supabase.auth.signOut();
    useAuthStore.getState().logout();
    return Promise.reject(err);
  }
);

export const authApi = {
  logout: async () => {
    await supabase.auth.signOut();
    await api.post('/api/auth/logout').catch(() => { });
  },
  me: () => api.get('/api/auth/me').then(r => r.data.data),
};
export const pricesApi = {
  getCommodities: () => api.get('/api/prices/commodities').then(r => r.data.data),
  getStocks: (s: string[]) => api.get(`/api/prices/stocks?symbols=${s.join(',')}`).then(r => r.data.data),
  getHistory: (sym: string, days = 30) => api.get(`/api/prices/history/${sym}?days=${days}`).then(r => r.data.data),
};
export const newsApi = {
  getNews: (refresh = false) => api.get(`/api/news${refresh ? '?refresh=true' : ''}`).then(r => r.data.data),
};
export const aiApi = {
  getSentiment: () => api.get('/api/ai/sentiment').then(r => r.data.data),
  getPrediction: (sym: string) => api.get(`/api/ai/prediction/${sym}`).then(r => r.data.data),
  chat: (messages: { role: string; content: string }[]) =>
    api.post('/api/ai/chat', { messages }).then(r => r.data.reply),
};
export const alertsApi = {
  getAlerts: () => api.get('/api/alerts').then(r => r.data.data),
  getHistory: () => api.get('/api/alerts/history').then(r => r.data.data),
  createAlert: (d: any) => api.post('/api/alerts', d).then(r => r.data.data),
  updateAlert: (id: string, d: any) => api.put(`/api/alerts/${id}`, d).then(r => r.data.data),
  deleteAlert: (id: string) => api.delete(`/api/alerts/${id}`).then(r => r.data),
};
export const portfolioApi = {
  getPortfolio: () => api.get('/api/portfolio').then(r => r.data.data),
  addPosition: (d: any) => api.post('/api/portfolio', d).then(r => r.data.data),
  closePosition: (id: string) => api.delete(`/api/portfolio/${id}`).then(r => r.data),
};
export const adminApi = {
  getStats: () => api.get('/api/admin/stats').then(r => r.data.data),
  getUsers: (page = 1) => api.get(`/api/admin/users?page=${page}`).then(r => r.data),
  updateUserPlan: (id: string, plan: string) =>
    api.patch(`/api/admin/users/${id}/plan`, { plan }).then(r => r.data.data),
};

export const stripeApi = {
  createCheckoutSession: () => api.post('/api/stripe/create-checkout-session').then(r => r.data),
  createPortalSession: () => api.post('/api/stripe/create-portal-session').then(r => r.data),
  verifySession: (session_id?: string) => api.post('/api/stripe/verify-session', { session_id }).then(r => r.data),
};

export default api;
