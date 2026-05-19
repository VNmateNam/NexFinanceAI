import { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { Zap, Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/authStore';

export function SignUp() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  async function submit() {
    const trimName = name.trim();
    const trimEmail = email.trim().toLowerCase();
    if (!trimName) { setError('Please enter your full name.'); return; }
    if (!trimEmail) { setError('Please enter your email.'); return; }
    if (!pw || pw.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    setError('');

    const { data, error: authError } = await supabase.auth.signUp({
      email: trimEmail,
      password: pw,
      options: {
        data: { full_name: trimName },
        // No email confirmation redirect needed - supabase handles it
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // If email confirmation is disabled in Supabase, user is auto-confirmed
    if (data.session) {
      // Auto-logged in
      navigate('/dashboard', { replace: true });
    } else {
      // Email confirmation required
      setSuccess(true);
    }
    setLoading(false);
  }

  if (success) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-green-400/10 border border-green-400/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✉️</span>
          </div>
          <h2 className="text-xl font-bold mb-2">Check your email</h2>
          <p className="text-gray-400 text-sm mb-6">
            We sent a confirmation link to <span className="text-white font-medium">{email}</span>.
            Click it to activate your account, then sign in.
          </p>
          <Link to="/login" className="btn-primary inline-block px-6 py-2.5 text-sm">
            Go to Sign In →
          </Link>
        </div>
      </div>
    );
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
          <h2 className="text-lg font-bold mb-1">Create account</h2>
          <p className="text-sm text-gray-500 mb-5">Free plan · upgrade anytime</p>

          {/* Plan info */}
          <div className="flex gap-3 mb-4">
            <div className="flex-1 bg-bg-3 border border-border rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Free</p>
              <p className="text-sm font-bold text-white">$0/mo</p>
              <p className="text-[10px] text-gray-500 mt-1">Markets, Portfolio</p>
            </div>
            <div className="flex-1 bg-gold/5 border border-gold/30 rounded-lg p-3 text-center relative overflow-hidden">
              <div className="absolute -top-1 -right-1 bg-gold text-bg text-[8px] font-bold px-1.5 py-0.5 rounded-bl">PRO</div>
              <p className="text-xs text-gold/70 mb-1">Pro</p>
              <p className="text-sm font-bold text-gold">$20/mo</p>
              <p className="text-[10px] text-gray-500 mt-1">AI Chat + Alerts</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">Full Name</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input className="input pl-9" type="text" placeholder="John Smith"
                  value={name}
                  onChange={e => { setName(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && submit()}
                  autoComplete="name" autoFocus />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input className="input pl-9" type="email" placeholder="you@example.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && submit()}
                  autoComplete="email" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input className="input pl-9 pr-10"
                  type={showPw ? 'text' : 'password'} placeholder="Min 6 characters"
                  value={pw}
                  onChange={e => { setPw(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && submit()}
                  autoComplete="new-password" />
                <button type="button" onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
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
              : 'Create Free Account →'}
          </button>

          <p className="text-center text-sm text-gray-500 mt-4">
            Already have an account?{' '}
            <Link to="/login" className="text-gold hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
