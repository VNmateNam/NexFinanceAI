/**
 * localStore.ts — localStorage persistence for demo/offline mode
 * 
 * KEY FIX: Alerts use a separate "initialized" flag so an empty
 * alerts array is stored as [] not confused with "never set".
 * This prevents SEED data from reappearing after all alerts are deleted.
 */

import type { PriceAlert, PortfolioPosition } from '../types';

const KEYS = {
  ALERTS_DATA: 'nexusai_alerts_v2',
  ALERTS_INIT: 'nexusai_alerts_initialized',
  PORTFOLIO:   'nexusai_portfolio_v2',
} as const;

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

// ── Alerts ────────────────────────────────────────────────────
export const localAlerts = {
  /** Returns null if never initialized (caller should seed), [] if initialized but empty */
  get: (): PriceAlert[] | null => {
    const initialized = localStorage.getItem(KEYS.ALERTS_INIT);
    if (initialized === null) return null; // never been set
    return read<PriceAlert[]>(KEYS.ALERTS_DATA, []);
  },

  set: (alerts: PriceAlert[]) => {
    write(KEYS.ALERTS_DATA, alerts);
    write(KEYS.ALERTS_INIT, true); // mark as initialized
  },

  /** Call once with seed data to initialize */
  seed: (alerts: PriceAlert[]) => {
    if (localStorage.getItem(KEYS.ALERTS_INIT) === null) {
      write(KEYS.ALERTS_DATA, alerts);
      write(KEYS.ALERTS_INIT, true);
    }
  },
};

// ── Portfolio ─────────────────────────────────────────────────
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
