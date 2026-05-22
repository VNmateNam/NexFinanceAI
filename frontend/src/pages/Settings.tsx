import { useState, useEffect } from 'react';
import { User, Lock, Eye, EyeOff, Check, Crown, CreditCard, Zap, Sparkles, Shield } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

export function Settings() {
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [name, setName] = useState(user?.full_name ?? '');
  const [nameLoading, setNameLoading] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [nameError, setNameError] = useState('');

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState('');

  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState('');
  const [upgradedBanner, setUpgradedBanner] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isPro = user?.plan === 'pro' || user?.plan === 'enterprise';
  const isAdmin = user?.is_admin === true;
  const planLabel = isAdmin ? 'Admin' : isPro ? (user?.plan === 'enterprise' ? 'Enterprise' : 'Pro') : 'Free';
  const planBadgeClass = isAdmin
    ? 'bg-red-500/10 text-red-400 border-red-500/20'
    : isPro
      ? 'bg-violet-400/10 text-violet-400 border-violet-400/20'
      : 'bg-gray-700 text-gray-400 border-gray-600';

  // Helper: poll /api/auth/me until plan is pro (fallback when verifySession fails)
  function startPollMe(onSuccess?: () => void) {
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      try {
        const r = await api.get('/api/auth/me');
        if (r.data.data) {
          setUser(r.data.data);
          if (r.data.data.plan === 'pro' || r.data.data.plan === 'enterprise') {
            setRefreshing(false);
            onSuccess?.();
            clearInterval(poll);
            return;
          }
        }
      } catch {}
      if (attempts >= 12) {
        setRefreshing(false);
        onSuccess?.();
        clearInterval(poll);
      }
    }, 1500);
  }

  // Detect Stripe return
  useEffect(() => {
    const params = new URLSearchParams(location.search);

    if (params.get('upgraded') === '1') {
      navigate('/settings', { replace: true });
      sessionStorage.removeItem('stripe_upgrade_pending');
      setUpgradedBanner(true);
      setRefreshing(true);

      const session_id = params.get('session_id') || undefined;

      // Step 1: call verifySession — this upgrades the DB immediately
      api.post('/api/stripe/verify-session', { session_id })
        .then(r => {
          if (r.data.data) {
            setUser(r.data.data);
            setRefreshing(false);
          } else {
            // Fallback: poll /me in case verify returned unexpected shape
            startPollMe();
          }
        })
        .catch(() => {
          // verifySession failed (e.g. 401 before session restored) — fall back to polling
          startPollMe();
        });

      return;
    }

    if (params.get('cancelled') === '1') {
      navigate('/settings', { replace: true });
      return;
    }

    // Re-login flow: session_id is gone but flag remains
    const pending = sessionStorage.getItem('stripe_upgrade_pending');
    if (pending) {
      setUpgradedBanner(true);
      setRefreshing(true);
      startPollMe(() => sessionStorage.removeItem('stripe_upgrade_pending'));
    }
  }, []);

  async function saveName() {
    if (!name.trim()) { setNameError('Name cannot be empty.'); return; }
    setNameLoading(true); setNameError(''); setNameSuccess(false);
    try {
      await supabase.auth.updateUser({ data: { full_name: name.trim() } });
      const r = await api.patch('/api/auth/me', { full_name: name.trim() });
      if (r.data.data) setUser(r.data.data);
      else setUser({ ...user!, full_name: name.trim() });
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 3000);
    } catch (e: any) {
      setNameError(e?.response?.data?.error || e.message || 'Failed to update name.');
    }
    setNameLoading(false);
  }

  async function changePassword() {
    if (!currentPw) { setPwError('Please enter your current password.'); return; }
    if (!newPw || newPw.length < 6) { setPwError('New password must be at least 6 characters.'); return; }
    if (currentPw === newPw) { setPwError('New password must be different from current.'); return; }
    setPwLoading(true); setPwError(''); setPwSuccess(false);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user!.email, password: currentPw,
      });
      if (signInError) { setPwError('Current password is incorrect.'); setPwLoading(false); return; }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPw });
      if (updateError) throw new Error(updateError.message);
      setCurrentPw(''); setNewPw('');
      setPwSuccess(true);
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (e: any) {
      setPwError(e.message || 'Failed to update password.');
    }
    setPwLoading(false);
  }

  async function startCheckout() {
    setStripeLoading(true); setStripeError('');
    try {
      const r = await api.post('/api/stripe/create-checkout-session');
      // Flag so App.tsx knows to poll for plan upgrade after login on return
      sessionStorage.setItem('stripe_upgrade_pending', '1');
      window.location.href = r.data.url;
    } catch (e: any) {
      setStripeError(e?.response?.data?.error || 'Failed to start checkout. Please try again.');
      setStripeLoading(false);
    }
  }

  async function manageSubscription() {
    setStripeLoading(true); setStripeError('');
    try {
      const r = await api.post('/api/stripe/create-portal-session');
      window.location.href = r.data.url;
    } catch (e: any) {
      setStripeError(e?.response?.data?.error || 'Failed to open billing portal.');
      setStripeLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-5">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">Manage your account and subscription</p>
      </div>

      {/* Upgrade success banner */}
      {upgradedBanner && (
        <div className="flex items-start gap-3 p-4 bg-violet-400/10 border border-violet-400/20 rounded-xl">
          <Sparkles size={18} className="text-violet-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-violet-400">Payment received!</p>
            {refreshing
              ? <p className="text-xs text-gray-400 mt-0.5">
                  Activating your Pro plan…
                  <span className="inline-block w-3 h-3 border border-violet-400/40 border-t-violet-400 rounded-full animate-spin align-middle ml-1.5" />
                </p>
              : isPro
                ? <p className="text-xs text-gray-400 mt-0.5">Your Pro plan is now active. Enjoy AI Chat and Alerts!</p>
                : <div className="mt-1.5">
                    <p className="text-xs text-yellow-400 mb-2">Still showing free? Click below to activate:</p>
                    <button
                      onClick={() => {
                        setRefreshing(true);
                        api.post('/api/stripe/verify-session', {})
                          .then(r => { if (r.data.data) { setUser(r.data.data); } })
                          .catch(() => {})
                          .finally(() => setRefreshing(false));
                      }}
                      className="btn-primary text-xs h-7 px-3 flex items-center gap-1.5">
                      <Sparkles size={11} /> Activate Pro Now
                    </button>
                  </div>
            }
          </div>
          <button onClick={() => setUpgradedBanner(false)} className="ml-auto text-gray-600 hover:text-gray-400 text-lg leading-none flex-shrink-0">&times;</button>
        </div>
      )}

      {/* Profile card */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <User size={14} className="text-gold" />
          <h2 className="text-sm font-bold">Profile</h2>
        </div>
        <div className="flex items-center gap-3 mb-4 p-3 bg-bg-3 rounded-lg">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-700 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
            {user?.full_name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{user?.full_name || user?.email}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
          <span className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full border ${planBadgeClass}`}>
            {planLabel.toUpperCase()}
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block font-medium">Full Name</label>
            <input className="input" type="text" value={name}
              onChange={e => { setName(e.target.value); setNameError(''); setNameSuccess(false); }}
              onKeyDown={e => e.key === 'Enter' && saveName()}
              placeholder="Your full name" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block font-medium">Email</label>
            <input className="input opacity-50 cursor-not-allowed" type="email" value={user?.email ?? ''} disabled />
            <p className="text-[10px] text-gray-600 mt-1">Email cannot be changed.</p>
          </div>
        </div>

        {nameError && <div className="mt-3 p-3 bg-red-400/10 border border-red-400/20 rounded-lg text-sm text-red-400">{nameError}</div>}
        {nameSuccess && (
          <div className="mt-3 p-3 bg-green-400/10 border border-green-400/20 rounded-lg text-sm text-green-400 flex items-center gap-2">
            <Check size={13} /> Name updated successfully.
          </div>
        )}
        <button onClick={saveName} disabled={nameLoading}
          className="btn-primary mt-4 h-9 px-5 text-sm flex items-center gap-2">
          {nameLoading && <div className="w-3 h-3 border-2 border-bg/30 border-t-bg rounded-full animate-spin" />}
          Save Name
        </button>
      </div>

      {/* Password */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Lock size={14} className="text-gold" />
          <h2 className="text-sm font-bold">Change Password</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block font-medium">Current Password</label>
            <div className="relative">
              <input className="input pr-10" type={showCurrentPw ? 'text' : 'password'}
                placeholder="Your current password" value={currentPw}
                onChange={e => { setCurrentPw(e.target.value); setPwError(''); }}
                onKeyDown={e => e.key === 'Enter' && changePassword()} />
              <button type="button" onClick={() => setShowCurrentPw(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {showCurrentPw ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block font-medium">New Password</label>
            <div className="relative">
              <input className="input pr-10" type={showNewPw ? 'text' : 'password'}
                placeholder="Min 6 characters" value={newPw}
                onChange={e => { setNewPw(e.target.value); setPwError(''); }}
                onKeyDown={e => e.key === 'Enter' && changePassword()} />
              <button type="button" onClick={() => setShowNewPw(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {showNewPw ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>
        </div>
        {pwError && <div className="mt-3 p-3 bg-red-400/10 border border-red-400/20 rounded-lg text-sm text-red-400">{pwError}</div>}
        {pwSuccess && (
          <div className="mt-3 p-3 bg-green-400/10 border border-green-400/20 rounded-lg text-sm text-green-400 flex items-center gap-2">
            <Check size={13} /> Password changed successfully.
          </div>
        )}
        <button onClick={changePassword} disabled={pwLoading}
          className="btn-primary mt-4 h-9 px-5 text-sm flex items-center gap-2">
          {pwLoading && <div className="w-3 h-3 border-2 border-bg/30 border-t-bg rounded-full animate-spin" />}
          Update Password
        </button>
      </div>

      {/* Subscription — hidden for admin (they have all access by code) */}
      {!isAdmin && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Crown size={14} className="text-gold" />
            <h2 className="text-sm font-bold">Subscription</h2>
          </div>

          {isPro ? (
            <div>
              <div className="flex items-center gap-3 p-4 bg-violet-400/5 border border-violet-400/20 rounded-xl mb-4">
                <div className="w-10 h-10 bg-violet-400/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Crown size={18} className="text-violet-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-violet-400">{user?.plan === 'enterprise' ? 'Enterprise' : 'Pro'} Plan</p>
                  <p className="text-xs text-gray-400">Full access to AI Chat and Alerts</p>
                </div>
                <span className="ml-auto text-xs bg-green-400/10 text-green-400 border border-green-400/20 px-2 py-0.5 rounded-full font-bold flex-shrink-0">Active</span>
              </div>
              <button onClick={manageSubscription} disabled={stripeLoading}
                className="btn-outline text-sm h-9 px-5 flex items-center gap-2">
                {stripeLoading ? <div className="w-3 h-3 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin" /> : <CreditCard size={13} />}
                Manage Billing
              </button>
            </div>
          ) : (
            <div>
              <div className="p-4 bg-bg-3 border border-border rounded-xl mb-4">
                <p className="text-xs text-gray-500 mb-3">You're on the <strong className="text-white">Free plan</strong>. Upgrade to Pro to unlock:</p>
                <ul className="space-y-2">
                  {['AI Financial Assistant (Claude AI)', 'Price Alerts & Notifications', 'Priority data refresh'].map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-gray-300">
                      <Zap size={10} className="text-gold flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 pt-3 border-t border-border flex items-baseline gap-1.5">
                  <span className="text-2xl font-extrabold text-gold">$20</span>
                  <span className="text-xs text-gray-500">/month</span>
                  <span className="ml-auto text-[10px] bg-gold/10 text-gold border border-gold/20 px-1.5 py-0.5 rounded font-bold">SANDBOX</span>
                </div>
              </div>

              {stripeError && <div className="mb-3 p-3 bg-red-400/10 border border-red-400/20 rounded-lg text-sm text-red-400">{stripeError}</div>}

              <button onClick={startCheckout} disabled={stripeLoading}
                className="btn-primary w-full h-10 text-sm flex items-center justify-center gap-2">
                {stripeLoading
                  ? <div className="w-4 h-4 border-2 border-bg/30 border-t-bg rounded-full animate-spin" />
                  : <><Crown size={13} /> Upgrade to Pro — $20/mo</>}
              </button>
              <p className="text-center text-[10px] text-gray-600 mt-2">
                Test card: 4242 4242 4242 4242 · any future date · any CVC
              </p>
            </div>
          )}
        </div>
      )}

      {/* Admin info box */}
      {isAdmin && (
        <div className="card bg-red-500/5 border-red-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={14} className="text-red-400" />
            <h2 className="text-sm font-bold text-red-400">Admin Account</h2>
          </div>
          <p className="text-xs text-gray-400">This account has full platform access including Admin Dashboard, AI Chat, and Alerts — without a paid subscription.</p>
        </div>
      )}
    </div>
  );
}
