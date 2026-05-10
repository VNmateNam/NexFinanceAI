import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
  const location = useLocation();

  // Never block /login with a spinner
  if (location.pathname === '/login') return <>{children}</>;

  // Show spinner max 1.5s then redirect to login
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
    // ALWAYS call setHydrated after 1.5s no matter what
    // This guarantees the spinner never shows more than 1.5s
    const timeout = setTimeout(() => {
      console.log('[App] hydration timeout — forcing login page');
      setHydrated();
    }, 1500);

    // Also try to get Supabase session directly (not via listener)
    // This is faster than waiting for onAuthStateChange
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout);
      if (session?.user) {
        api.get('/api/auth/me')
          .then(r => { setUser(r.data.data); setHydrated(); })
          .catch(() => {
            setUser({
              id: session.user.id,
              email: session.user.email ?? '',
              full_name: session.user.user_metadata?.full_name ?? '',
              plan: 'free',
              is_admin: false,
              created_at: session.user.created_at ?? '',
            });
            setHydrated();
          });
      } else {
        logout();
        setHydrated();
      }
    }).catch(() => {
      // Supabase completely unreachable
      clearTimeout(timeout);
      logout();
      setHydrated();
    });

    // Also subscribe to future changes (login/logout/token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION') return; // handled above with getSession
        if (session?.user) {
          try {
            const profile = await api.get('/api/auth/me').then(r => r.data.data);
            setUser(profile);
          } catch {
            setUser({
              id: session.user.id,
              email: session.user.email ?? '',
              full_name: session.user.user_metadata?.full_name ?? '',
              plan: 'free',
              is_admin: false,
              created_at: session.user.created_at ?? '',
            });
          }
        } else {
          logout();
        }
        setHydrated();
      }
    );

    return () => { clearTimeout(timeout); subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    fetchAll();
    const fi = setInterval(fetchAll, 5 * 60 * 1000);
    const ji = setInterval(jitterPrices, 10_000);
    return () => { clearInterval(fi); clearInterval(ji); };
  }, []);

  return (
    <Routes>
      {/* Login is always accessible — no spinner, no auth check */}
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
