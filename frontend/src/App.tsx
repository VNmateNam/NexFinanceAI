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
    // Timeout: never block UI more than 2 seconds
    const timeout = setTimeout(() => {
      console.log('[App] auth timeout — showing login');
      setHydrated();
    }, 2000);

    // Get current session immediately (synchronous check)
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) console.error('[App] getSession error:', error.message);
      console.log('[App] session on load:', session ? `user=${session.user.email}` : 'none');

      if (session?.user) {
        // Fetch backend profile
        api.get('/api/auth/me')
          .then(r => {
            setUser(r.data.data);
            clearTimeout(timeout);
            setHydrated();
          })
          .catch(() => {
            // Backend unavailable — use Supabase user data
            setUser({
              id: session.user.id,
              email: session.user.email ?? '',
              full_name: session.user.user_metadata?.full_name ?? '',
              plan: 'free',
              is_admin: false,
              created_at: session.user.created_at ?? '',
            });
            clearTimeout(timeout);
            setHydrated();
          });
      } else {
        logout();
        clearTimeout(timeout);
        setHydrated();
      }
    });

    // Also listen for future auth changes (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[App] auth event:', event, session?.user?.email ?? 'no user');

        // SIGNED_IN fires after signInWithPassword succeeds
        if (event === 'SIGNED_IN' && session?.user) {
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
          setHydrated();
        }

        if (event === 'SIGNED_OUT') {
          logout();
          setHydrated();
        }

        if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Token silently refreshed — no action needed, interceptor picks it up
          console.log('[App] token refreshed silently');
        }
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
