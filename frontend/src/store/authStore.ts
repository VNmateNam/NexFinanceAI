import { create } from 'zustand';
import type { UserProfile } from '../types';

// Simple store — NO persist, NO manual token storage.
// Supabase stores the session in its own localStorage keys automatically.
interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  _hydrated: boolean;    // true once Supabase has checked for an existing session

  setUser: (user: UserProfile | null) => void;
  setHydrated: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  _hydrated: false,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setHydrated: () => set({ _hydrated: true }),
  logout: () => set({ user: null, isAuthenticated: false }),
}));
