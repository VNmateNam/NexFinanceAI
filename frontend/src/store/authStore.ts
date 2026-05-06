import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UserProfile } from '../types';

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  _hydrated: boolean;

  setAuth: (user: UserProfile, token: string, refreshToken?: string) => void;
  setToken: (token: string) => void;
  logout: () => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:            null,
      token:           null,
      refreshToken:    null,
      isAuthenticated: false,
      _hydrated:       false,

      setAuth: (user, token, refreshToken) =>
        set({ user, token, refreshToken: refreshToken ?? null, isAuthenticated: true }),

      setToken: (token) => set({ token }),

      logout: () =>
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false }),

      setHydrated: () => set({ _hydrated: true }),
    }),
    {
      name: 'nexusai-auth-v3',          // v3 clears all previous broken state
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        // Called after localStorage is read — mark hydration complete
        state?.setHydrated();
      },
    }
  )
);

// ── Synchronous token getter — safe to call from Axios interceptor ──
// Returns token from localStorage directly (no async wait needed)
export function getStoredToken(): string | null {
  try {
    const raw = localStorage.getItem('nexusai-auth-v3');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

export function getStoredRefreshToken(): string | null {
  try {
    const raw = localStorage.getItem('nexusai-auth-v3');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.refreshToken ?? null;
  } catch {
    return null;
  }
}
