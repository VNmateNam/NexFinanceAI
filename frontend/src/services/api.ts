/**
 * api.ts
 *
 * KEY FIX: Use getStoredToken() / getStoredRefreshToken() which read
 * directly from localStorage — bypassing the Zustand hydration race.
 * This means the token is always available immediately on page load,
 * even before React has finished mounting.
 */

import axios, { AxiosError } from 'axios';
import { useAuthStore, getStoredToken, getStoredRefreshToken } from '../store/authStore';

// Strip trailing slash to prevent //api/... double-slash URLs
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');

export const api = axios.create({ baseURL: API_BASE, timeout: 15000 });

// ── Request: attach token read directly from localStorage ─────
api.interceptors.request.use(config => {
  const token = getStoredToken();   // ← sync read, no hydration race
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response: handle 401 gracefully ──────────────────────────
let isRefreshing = false;
type QueueItem = { resolve: (token: string) => void; reject: (err: unknown) => void };
let refreshQueue: QueueItem[] = [];

function flushQueue(token: string) {
  refreshQueue.forEach(({ resolve }) => resolve(token));
  refreshQueue = [];
}
function rejectQueue(err: unknown) {
  refreshQueue.forEach(({ reject }) => reject(err));
  refreshQueue = [];
}

api.interceptors.response.use(
  res => res,
  async (err: AxiosError) => {
    const original = err.config as any;

    // Only handle 401, only once per request
    if (err.response?.status !== 401 || original._retried) {
      return Promise.reject(err);
    }

    // Never try to refresh on auth endpoints — avoids loops
    if (original.url?.includes('/api/auth/')) {
      return Promise.reject(err);
    }

    original._retried = true;

    const refreshToken = getStoredRefreshToken();

    // No refresh token — reject without logging out
    // (token might just not be attached yet due to timing)
    if (!refreshToken) {
      return Promise.reject(err);
    }

    // Already refreshing — queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({
          resolve: (token) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          },
          reject,
        });
      });
    }

    isRefreshing = true;

    try {
      const { data } = await axios.post(
        `${API_BASE}/api/auth/refresh`,
        { refresh_token: refreshToken },
        { timeout: 10000 }
      );

      const newToken: string = data.session?.access_token;
      const newRefresh: string = data.session?.refresh_token ?? refreshToken;

      if (!newToken) throw new Error('No access_token in refresh response');

      // Save new tokens
      useAuthStore.getState().setToken(newToken);
      useAuthStore.setState({ refreshToken: newRefresh });

      flushQueue(newToken);

      // Retry original request with new token
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch (refreshErr: any) {
      rejectQueue(refreshErr);
      // Only logout if the refresh endpoint exists but explicitly rejects
      // (401 from refresh = truly expired; 404 = endpoint not deployed yet)
      const status = (refreshErr as any)?.response?.status;
      if (status === 401) {
        useAuthStore.getState().logout();
      }
      // For 404 or network errors — DON'T logout, just fail this request silently
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);

// ── Auth ──────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }).then(r => r.data),
  refresh: (refresh_token: string) =>
    api.post('/api/auth/refresh', { refresh_token }).then(r => r.data),
  logout: () => api.post('/api/auth/logout').catch(() => { }),
  me: () => api.get('/api/auth/me').then(r => r.data.data),
};

// ── Prices (PUBLIC — no auth needed) ─────────────────────────
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

// ── AI (sentiment/prediction PUBLIC; chat PROTECTED) ──────────
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
  createAlert: (data: any) => api.post('/api/alerts', data).then(r => r.data.data),
  updateAlert: (id: string, data: any) =>
    api.put(`/api/alerts/${id}`, data).then(r => r.data.data),
  deleteAlert: (id: string) => api.delete(`/api/alerts/${id}`).then(r => r.data),
};

// ── Portfolio (PROTECTED) ─────────────────────────────────────
export const portfolioApi = {
  getPortfolio: () => api.get('/api/portfolio').then(r => r.data.data),
  addPosition: (data: any) => api.post('/api/portfolio', data).then(r => r.data.data),
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
