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

async function loadUserProfile(userId: string, email: string, fullName: string, createdAt: string) {
  try {
    const profile = await api.get('/api/auth/me').then(r => r.data.data);
    return profile;
  } catch {
    return { id: userId, email, full_name: fullName, plan: 'free', is_admin: false, created_at: createdAt };
  }
}

export default function App() {
  const { fetchAll, jitterPrices } = useMarketStore();
  const { setUser, setHydrated, logout } = useAuthStore();

  useEffect(() => {
    // Hard timeout — never spin more than 3s
    const timeout = setTimeout(() => {
      console.warn('[App] auth timeout — forcing hydration');
      logout();
      setHydrated();
    }, 3000);

    // onAuthStateChange handles ALL cases including page refresh
    // INITIAL_SESSION fires immediately on page load with the stored session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[App] auth event:', event, '| user:', session?.user?.email ?? 'none');
        clearTimeout(timeout);

        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            const profile = await loadUserProfile(
              session.user.id,
              session.user.email ?? '',
              session.user.user_metadata?.full_name ?? '',
              session.user.created_at ?? ''
            );
            setUser(profile);
          } else {
            // INITIAL_SESSION with no session = not logged in
            logout();
          }
          setHydrated();
        }

        if (event === 'SIGNED_OUT') {
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
