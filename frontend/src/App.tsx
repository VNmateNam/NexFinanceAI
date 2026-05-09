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

  // Show spinner until Supabase has finished checking for an existing session
  if (!_hydrated) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
          <p className="text-xs text-gray-500 font-mono">Loading session…</p>
        </div>
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
    // ── Supabase auth state listener ───────────────────────────
    // Fires immediately with the current session on page load,
    // then again on login, logout, and token refresh.
    // This single listener replaces ALL manual token management.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          // Fetch the enriched profile from our backend
          try {
            const profile = await api.get('/api/auth/me').then(r => r.data.data);
            setUser(profile);
          } catch {
            // Backend unreachable — still mark authenticated with Supabase data
            setUser({
              id: session.user.id,
              email: session.user.email ?? '',
              full_name: session.user.user_metadata?.full_name ?? '',
              plan: 'free',
              is_admin: false,
              created_at: session.user.created_at ?? new Date().toISOString(),
            });
          }
        } else {
          // No session — signed out
          logout();
        }
        // Mark hydrated after first check (whether session exists or not)
        setHydrated();
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetchAll();
    const fetchInterval = setInterval(fetchAll, 5 * 60 * 1000);
    const jitterInterval = setInterval(jitterPrices, 10_000);
    return () => {
      clearInterval(fetchInterval);
      clearInterval(jitterInterval);
    };
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
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
