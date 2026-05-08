import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Zap, Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { authApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

export function Login() {
  const { isAuthenticated, setAuth } = useAuthStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If already authenticated, go straight to dashboard
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  async function submit() {
    const trimEmail = email.trim().toLowerCase();
    if (!trimEmail) { setError('Please enter your email address.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail)) { setError('Please enter a valid email address.'); return; }
    if (!pw) { setError('Please enter your password.'); return; }
    if (pw.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    setError('');
    try {
      const data = await authApi.login(trimEmail, pw);

      if (!data?.session?.access_token) {
        throw new Error('No session returned. Check your Supabase configuration.');
      }

      // Save BOTH access token AND refresh token
      setAuth(
        data.user,
        data.session.access_token,
        data.session.refresh_token  // ← critical: needed to auto-refresh expired tokens
      );

      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      const msg = err.response?.data?.error ?? err.message ?? 'Login failed';
      if (msg.includes('Invalid login credentials')) {
        setError('Incorrect email or password.');
      } else if (msg.includes('Email not confirmed')) {
        setError('Please confirm your email before signing in. Check your inbox.');
      } else {
        setError(msg);
      }
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(rgba(245,200,66,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(245,200,66,.5) 1px,transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      <div className="w-full max-w-sm relative">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-gold to-gold-dark rounded-2xl flex items-center justify-center shadow-xl shadow-yellow-400/20">
            <Zap size={22} className="text-bg" />
          </div>
          <div>
            <p className="text-2xl font-extrabold tracking-tight">Nexus<span className="text-gold">AI</span></p>
            <p className="text-xs text-gray-500">Financial Intelligence Platform</p>
          </div>
        </div>

        <div className="card border-border-light shadow-2xl">
          <h2 className="text-lg font-bold mb-1">Sign in</h2>
          <p className="text-sm text-gray-500 mb-5">Enter your account credentials</p>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">Email address</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input className="input pl-9" type="email" placeholder="you@example.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && submit()}
                  autoComplete="email" autoFocus />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input className="input pl-9 pr-10"
                  type={showPw ? 'text' : 'password'} placeholder="••••••••"
                  value={pw}
                  onChange={e => { setPw(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && submit()}
                  autoComplete="current-password" />
                <button type="button" onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-3 p-3 bg-red-400/10 border border-red-400/20 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          <button onClick={submit} disabled={loading}
            className="btn-primary w-full mt-4 h-11 flex items-center justify-center">
            {loading
              ? <div className="w-4 h-4 border-2 border-bg/30 border-t-bg rounded-full animate-spin" />
              : 'Sign In →'}
          </button>

          <div className="mt-4 p-3 bg-bg-3 border border-border rounded-lg">
            <p className="text-xs text-gray-500 leading-relaxed">
              Create users in{' '}
              <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-gold underline">
                Supabase Dashboard
              </a>
              {' '}→ Authentication → Users → Invite user
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mt-6">
          {['Live Prices', 'AI Predictions', 'Smart Alerts', 'Email & SMS'].map(f => (
            <span key={f} className="text-xs text-gray-600 bg-bg-2 border border-border px-2.5 py-1 rounded-full">{f}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
