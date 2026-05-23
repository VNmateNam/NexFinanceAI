/**
 * localStore.ts — localStorage persistence for demo/offline mode
 * 
 * KEY FIX: Alerts use a separate "initialized" flag so an empty
 * alerts array is stored as [] not confused with "never set".
 * This prevents SEED data from reappearing after all alerts are deleted.
 */

import type { PriceAlert, PortfolioPosition } from '../types';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { /* quota exceeded */ }
}

// ── Alerts (per-user keyed to prevent cross-account data bleed) ──────────
const alertDataKey  = (uid: string) => `nexusai_alerts_v3_${uid}`;
const alertInitKey  = (uid: string) => `nexusai_alerts_init_${uid}`;

export const localAlerts = {
  get: (userId: string): PriceAlert[] | null => {
    const initialized = localStorage.getItem(alertInitKey(userId));
    if (initialized === null) return null;
    return read<PriceAlert[]>(alertDataKey(userId), []);
  },
  set: (userId: string, alerts: PriceAlert[]) => {
    write(alertDataKey(userId), alerts);
    write(alertInitKey(userId), true);
  },
  seed: (userId: string, alerts: PriceAlert[]) => {
    if (localStorage.getItem(alertInitKey(userId)) === null) {
      write(alertDataKey(userId), alerts);
      write(alertInitKey(userId), true);
    }
  },
};

// ── Portfolio (shared — same positions for all, no sensitive cross-account risk) ──
export const localPortfolio = {
  get: (): PortfolioPosition[] => read<PortfolioPosition[]>(KEYS.PORTFOLIO, []),
  set: (positions: PortfolioPosition[]) => write(KEYS.PORTFOLIO, positions),
};

// ── Chat (last 40 messages, keyed per user so accounts don't share history) ──
const chatKey = (userId: string) => `nexusai_chat_v3_${userId}`;

export const localChat = {
  get: (userId: string): { role: string; content: string }[] =>
    read<{ role: string; content: string }[]>(chatKey(userId), []),
  append: (userId: string, msg: { role: string; content: string }) => {
    const current = localChat.get(userId);
    write(chatKey(userId), [...current, msg].slice(-40));
  },
  set: (userId: string, msgs: { role: string; content: string }[]) =>
    write(chatKey(userId), msgs),
  clear: (userId: string) => write(chatKey(userId), []),
};
