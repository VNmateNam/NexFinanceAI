import { create } from 'zustand';
import type { UserProfile } from '../types';

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  _hydrated: boolean;
  _profileLoaded: boolean; // true once real backend profile is fetched
  setUser: (user: UserProfile | null) => void;
  setProfileLoaded: () => void;
  setHydrated: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  _hydrated: false,
  _profileLoaded: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setProfileLoaded: () => set({ _profileLoaded: true }),
  setHydrated: () => set({ _hydrated: true }),
  logout: () => set({ user: null, isAuthenticated: false, _hydrated: true, _profileLoaded: false }),
}));
