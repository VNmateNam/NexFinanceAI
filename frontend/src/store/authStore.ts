import { create } from 'zustand';
import type { UserProfile } from '../types';

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  _hydrated: boolean;
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
