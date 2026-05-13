import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Markets } from './pages/Markets';
import { Portfolio } from './pages/Portfolio';
import { Alerts } from './pages/Alerts';
import { AIChat } from './pages/AIChat';
import { Admin } from './pages/Admin';
import { Login } from './pages/Login';
import { useMarketStore } from './store/marketStore';
import { useAuthStore } from './store/authStore';
import { supabase } from './services/supabase';
import api from './services/api';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, _hydrated } = useAuthStore();
  if (!_hydrated) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { fetchAll, jitterPrices } = useMarketStore();
  const { setUser, setHydrated, logout } = useAuthStore();

  useEffect(() => {
    // Hard timeout — never spin more than 2 seconds no matter what
    const timeout = setTimeout(() => {
      console.warn('[App] auth timeout — forcing hydration');
      logout();
      setHydrated();
    }, 2000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[App] auth event:', event, '| user:', session?.user?.email ?? 'none');

        if (
          event === 'INITIAL_SESSION' ||
          event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED'
        ) {
          if (session?.user) {
            // ── CRITICAL: call setHydrated IMMEDIATELY so spinner clears ──
            // Then fetch profile in background — UI is unblocked either way
            setUser({
              id: session.user.id,
              email: session.user.email ?? '',
              full_name: session.user.user_metadata?.full_name ?? '',
              plan: 'free',
              is_admin: false,
              created_at: session.user.created_at ?? '',
            });
            clearTimeout(timeout);
            setHydrated();   // ← unblocks spinner NOW, before any async calls

            // Then enrich with backend profile in background (non-blocking)
            api.get('/api/auth/me')
              .then(r => { if (r.data.data) setUser(r.data.data); })
              .catch(() => { /* keep Supabase data */ });
          } else {
            // No session (INITIAL_SESSION with null = not logged in)
            logout();
            clearTimeout(timeout);
            setHydrated();
          }
        }

        if (event === 'SIGNED_OUT') {
          logout();
          clearTimeout(timeout);
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
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="markets" element={<Markets />} />
        <Route path="portfolio" element={<Portfolio />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="ai" element={<AIChat />} />
        <Route path="admin" element={<Admin />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
