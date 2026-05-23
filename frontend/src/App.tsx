import { useEffect, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Markets } from './pages/Markets';
import { Portfolio } from './pages/Portfolio';
import { Alerts } from './pages/Alerts';
import { AIChat } from './pages/AIChat';
import { Admin } from './pages/Admin';
import { Login } from './pages/Login';
import { SignUp } from './pages/SignUp';
import { Settings } from './pages/Settings';
import { useMarketStore } from './store/marketStore';
import { useAuthStore } from './store/authStore';
import { supabase } from './services/supabase';
import api from './services/api';

function ProtectedRoute({ children, adminOnly }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { isAuthenticated, user, _hydrated, _profileLoaded } = useAuthStore();

  // Spinner while Supabase session resolves
  if (!_hydrated) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Spinner while real profile loads from backend — prevents flash of wrong plan/gates
  if (!_profileLoaded) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
          <p className="text-xs text-gray-600">Loading your account…</p>
        </div>
      </div>
    );
  }

  if (adminOnly && !user?.is_admin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  const { fetchAll, jitterPrices } = useMarketStore();
  const { setUser, setHydrated, setProfileLoaded, logout } = useAuthStore();

  // Re-fetch profile from backend (called after Stripe return, focus, etc.)
  const refreshProfile = useCallback(async () => {
    try {
      const r = await api.get('/api/auth/me');
      if (r.data.data) {
        useAuthStore.getState().setUser(r.data.data);
      }
    } catch {
      // Not authenticated — ignore
    }
  }, []);

  // Poll until plan becomes 'pro' — used after Stripe checkout (triggered from SIGNED_IN handler)
  const pollForUpgrade = useCallback(() => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const r = await api.get('/api/auth/me');
        if (r.data.data) {
          useAuthStore.getState().setUser(r.data.data);
          if (r.data.data.plan === 'pro' || r.data.data.plan === 'enterprise') {
            sessionStorage.removeItem('stripe_upgrade_pending');
            clearInterval(interval);
          }
        }
      } catch {}
      if (attempts >= 12) {
        clearInterval(interval);
        sessionStorage.removeItem('stripe_upgrade_pending');
      }
    }, 2000);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      // Safety net — if nothing fires in 3s, mark hydrated
      setHydrated();
    }, 3000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[App] auth event:', event, '| user:', session?.user?.email ?? 'none');

        if (
          (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')
          && session?.user
        ) {
          clearTimeout(timeout);
          // Do NOT setUser with plan:'free' yet — wait for real profile to avoid flash
          // Just mark hydrated so the spinner resolves to login or content
          setHydrated();

          // Check if returning from Stripe
          const pendingUpgrade = sessionStorage.getItem('stripe_upgrade_pending');

          // Fetch real profile — this is the single source of truth
          api.get('/api/auth/me')
            .then(r => {
              if (r.data.data) {
                setUser(r.data.data);
                setProfileLoaded();
                if (pendingUpgrade && r.data.data.plan !== 'pro' && r.data.data.plan !== 'enterprise') {
                  pollForUpgrade();
                } else if (pendingUpgrade) {
                  sessionStorage.removeItem('stripe_upgrade_pending');
                }
              } else {
                // Backend returned nothing — use Supabase data as fallback
                setUser({
                  id: session.user.id,
                  email: session.user.email ?? '',
                  full_name: session.user.user_metadata?.full_name ?? '',
                  plan: 'free',
                  is_admin: false,
                  created_at: session.user.created_at ?? '',
                });
                setProfileLoaded();
              }
            })
            .catch(() => {
              // Network error — use Supabase data
              setUser({
                id: session.user.id,
                email: session.user.email ?? '',
                full_name: session.user.user_metadata?.full_name ?? '',
                plan: 'free',
                is_admin: false,
                created_at: session.user.created_at ?? '',
              });
              setProfileLoaded();
            });
        }

        if (event === 'INITIAL_SESSION' && !session) {
          // No stored session — user must log in
          clearTimeout(timeout);
          logout();
          setHydrated();
        }

        if (event === 'SIGNED_OUT') {
          clearTimeout(timeout);
          logout();
          setHydrated();
        }
      }
    );

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    fetchAll();
    const fi = setInterval(fetchAll, 5 * 60 * 1000);
    const ji = setInterval(jitterPrices, 10_000);
    return () => { clearInterval(fi); clearInterval(ji); };
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="markets" element={<Markets />} />
        <Route path="portfolio" element={<Portfolio />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="ai" element={<AIChat />} />
        <Route path="settings" element={<Settings />} />
        <Route path="admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
