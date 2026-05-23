import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Trash2, ToggleLeft, ToggleRight,
  CheckCircle2, Plus, Cloud, HardDrive, AlertCircle, Lock, Crown
} from 'lucide-react';
import type { PriceAlert, AlertHistoryItem } from '../types';
import { alertsApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { cn } from '../utils/cn';
import { formatDistanceToNow } from 'date-fns';

// ── localStorage helpers ───────────────────────────────────────
function lsGet(userId: string): PriceAlert[] | null {
  const initKey = `nexusai_alerts_init_${userId}`;
  const dataKey = `nexusai_alerts_v3_${userId}`;
  if (localStorage.getItem(initKey) === null) return null;
  try { return JSON.parse(localStorage.getItem(dataKey) || '[]'); }
  catch { return []; }
}
function lsSet(userId: string, alerts: PriceAlert[]) {
  const initKey = `nexusai_alerts_init_${userId}`;
  const dataKey = `nexusai_alerts_v3_${userId}`;
  localStorage.setItem(dataKey, JSON.stringify(alerts));
  localStorage.setItem(initKey, '1');
}

const SEED: PriceAlert[] = [
  {
    id: 'seed-1', symbol: 'XAU', asset_name: 'Gold', condition: 'above', target_value: 3500,
    notify_email: true, notify_sms: false, contact_email: 'you@email.com',
    is_active: true, created_at: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 'seed-2', symbol: 'WTI', asset_name: 'WTI Oil', condition: 'below', target_value: 58,
    notify_email: false, notify_sms: true, contact_phone: '+1 555 0100',
    is_active: true, created_at: new Date(Date.now() - 172800000).toISOString()
  },
];

const CONDITION_LABELS: Record<string, string> = {
  above: 'Price rises above', below: 'Price falls below',
  percent_up: '% rise exceeds', percent_down: '% drop exceeds',
  signal_bullish: 'AI turns Bullish', signal_bearish: 'AI turns Bearish',
};

const ASSETS = [
  { symbol: 'XAU', label: 'Gold (XAU/USD)', minVal: 100, maxVal: 10000 },
  { symbol: 'XAG', label: 'Silver (XAG/USD)', minVal: 1, maxVal: 500 },
  { symbol: 'WTI', label: 'WTI Crude Oil', minVal: 10, maxVal: 300 },
  { symbol: 'BRENT', label: 'Brent Crude', minVal: 10, maxVal: 300 },
  { symbol: 'AAPL', label: 'Apple (AAPL)', minVal: 1, maxVal: 1000 },
  { symbol: 'TSLA', label: 'Tesla (TSLA)', minVal: 1, maxVal: 2000 },
  { symbol: 'NVDA', label: 'NVIDIA (NVDA)', minVal: 1, maxVal: 5000 },
  { symbol: 'MSFT', label: 'Microsoft (MSFT)', minVal: 1, maxVal: 2000 },
];

const assetName = (sym: string) => ASSETS.find(a => a.symbol === sym)?.label.split(' (')[0] ?? sym;
const assetIcon = (sym: string) =>
  sym === 'XAU' ? '🥇' : sym === 'XAG' ? '🥈' : (sym === 'WTI' || sym === 'BRENT') ? '🛢️' : '📈';
const isLocalId = (id: string) => id.startsWith('seed-') || id.startsWith('local-');

interface FormErrors { target_value?: string; contact_email?: string; contact_phone?: string; general?: string; }

function validate(form: any): FormErrors {
  const errors: FormErrors = {};
  const asset = ASSETS.find(a => a.symbol === form.symbol);
  if (!form.target_value) {
    errors.target_value = 'Target value is required';
  } else {
    const val = parseFloat(form.target_value);
    if (isNaN(val) || val <= 0) errors.target_value = 'Must be a positive number';
    else if (asset && val < asset.minVal) errors.target_value = `Min $${asset.minVal} for ${assetName(form.symbol)}`;
    else if (asset && val > asset.maxVal) errors.target_value = `Max $${asset.maxVal.toLocaleString()} for ${assetName(form.symbol)}`;
  }
  if (form.notify_email && !form.contact_email?.trim())
    errors.contact_email = 'Email required for email notifications';
  else if (form.notify_email && form.contact_email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email.trim()))
    errors.contact_email = 'Enter a valid email address';
  if (form.notify_sms && !form.contact_phone?.trim())
    errors.contact_phone = 'Phone required for SMS notifications';
  if (!form.notify_email && !form.notify_sms)
    errors.general = 'Select at least one notification method';
  return errors;
}

export function Alerts() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isPro = user?.plan === 'pro' || user?.plan === 'enterprise';
  const isAdmin = user?.is_admin === true;

  if (!isPro && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 bg-gold/10 border border-gold/20 rounded-2xl flex items-center justify-center mb-4">
          <Lock size={28} className="text-gold" />
        </div>
        <h2 className="text-xl font-bold mb-2">Pro Feature</h2>
        <p className="text-gray-400 text-sm mb-6 max-w-sm">
          Price Alerts are available on the Pro plan. Upgrade to set alerts for Gold, Oil, Stocks and get notified instantly.
        </p>
        <button onClick={() => navigate('/settings')}
          className="btn-primary flex items-center gap-2 px-6 py-2.5">
          <Crown size={14} /> Upgrade to Pro — $20/mo
        </button>
        <p className="text-xs text-gray-600 mt-2">Sandbox mode · card 4242 4242 4242 4242</p>
      </div>
    );
  }

  return <AlertsContent userId={user!.id} />;
}

function AlertsContent({ userId }: { userId: string }) {
  const { isAuthenticated } = useAuthStore();

  // ── Load from localStorage SYNCHRONOUSLY on first render (per-user) ──
  const [alerts, setAlerts] = useState<PriceAlert[]>(() => {
    const stored = lsGet(userId);
    if (stored === null) {
      lsSet(userId, SEED);
      return SEED;
    }
    return stored;
  });

  const [history, setHistory] = useState<AlertHistoryItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [backendSync, setBackendSync] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [form, setForm] = useState({
    symbol: 'XAU', condition: 'above', target_value: '',
    notify_email: true, notify_sms: false, contact_email: '', contact_phone: '',
  });

  // Track if we've fetched from backend this session
  const fetchedRef = useRef(false);

  // ── Sync localStorage whenever alerts change ──────────────────
  const persist = (next: PriceAlert[]) => {
    setAlerts(next);
    lsSet(userId, next);
  };

  // ── Fetch from backend once when authenticated ────────────────
  useEffect(() => {
    if (!isAuthenticated || fetchedRef.current) return;
    fetchedRef.current = true;

    alertsApi.getAlerts()
      .then(serverAlerts => {
        if (Array.isArray(serverAlerts)) {
          // Server is source of truth when authenticated
          persist(serverAlerts);
          setBackendSync(true);
        }
      })
      .catch(() => {
        // Backend unavailable — keep localStorage data
        setBackendSync(false);
      });

    alertsApi.getHistory()
      .then(h => { if (Array.isArray(h)) setHistory(h); })
      .catch(() => { });
  }, [isAuthenticated]);

  // ── Create alert ──────────────────────────────────────────────
  async function createAlert() {
    const errors = validate(form);
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    setFormErrors({});
    setSubmitting(true);

    const payload = {
      symbol: form.symbol,
      asset_name: assetName(form.symbol),
      condition: form.condition,
      target_value: parseFloat(form.target_value),
      notify_email: form.notify_email,
      notify_sms: form.notify_sms,
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
    };

    // Optimistic local add immediately
    const optimistic: PriceAlert = {
      id: `local-${Date.now()}`, ...payload,
      is_active: true, created_at: new Date().toISOString(),
    } as PriceAlert;
    const next = [optimistic, ...alerts];
    persist(next);

    setSuccess(`✓ Alert created: ${payload.asset_name} — ${CONDITION_LABELS[form.condition]} $${payload.target_value.toLocaleString()}`);
    setTimeout(() => setSuccess(''), 5000);
    setForm(f => ({ ...f, target_value: '', contact_email: '', contact_phone: '' }));
    setSubmitting(false);

    // Sync to backend (fire-and-forget)
    if (isAuthenticated) {
      alertsApi.createAlert(payload)
        .then(async () => {
          // Reload from server to get real IDs
          const fresh = await alertsApi.getAlerts();
          if (Array.isArray(fresh)) persist(fresh);
        })
        .catch(() => {/* kept locally */ });
    }
  }

  function toggleAlert(id: string, isActive: boolean) {
    const next = alerts.map(a => a.id === id ? { ...a, is_active: !isActive } : a);
    persist(next);
    if (isAuthenticated && !isLocalId(id)) {
      alertsApi.updateAlert(id, { is_active: !isActive }).catch(() => { });
    }
  }

  function deleteAlert(id: string) {
    persist(alerts.filter(a => a.id !== id));
    if (isAuthenticated && !isLocalId(id)) {
      alertsApi.deleteAlert(id).catch(() => { });
    }
  }

  const activeCount = alerts.filter(a => a.is_active).length;
  const currentAsset = ASSETS.find(a => a.symbol === form.symbol);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="page-title">Smart Alerts</h1>
        {isAuthenticated && backendSync
          ? <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold px-2 py-1 rounded bg-green-400/10 text-green-400 border border-green-400/20">
            <Cloud size={10} /> Synced to Supabase
          </span>
          : <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold px-2 py-1 rounded bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">
            <HardDrive size={10} /> Saved locally
          </span>
        }
      </div>
      <p className="page-sub">Price triggers with real email & SMS notifications via Resend + Twilio</p>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Alert list */}
        <div className="space-y-5">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <p className="section-label">Your Alerts</p>
              <span className="badge-green">{activeCount} Active</span>
            </div>

            {alerts.length === 0 ? (
              <div className="py-10 text-center">
                <Bell size={32} className="text-gray-700 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No alerts yet</p>
                <p className="text-xs text-gray-600 mt-1">Create one using the form →</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map(a => (
                  <div key={a.id} className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border transition-all',
                    a.is_active ? 'bg-green-400/5 border-green-400/20' : 'bg-bg-3 border-border',
                  )}>
                    <span className="text-xl flex-shrink-0">{assetIcon(a.symbol)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{a.asset_name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {CONDITION_LABELS[a.condition]}{' '}
                        <strong className="text-gray-300">${a.target_value.toLocaleString()}</strong>
                        {' · '}{a.notify_email ? 'Email' : ''}{a.notify_sms ? (a.notify_email ? ' + SMS' : 'SMS') : ''}
                        {a.contact_email && <span className="text-gray-600"> → {a.contact_email}</span>}
                      </p>
                    </div>
                    <button onClick={() => toggleAlert(a.id, a.is_active)}
                      className={cn('flex-shrink-0 transition-colors',
                        a.is_active ? 'text-green-400 hover:text-green-300' : 'text-gray-600 hover:text-gray-400')}>
                      {a.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                    </button>
                    <button onClick={() => deleteAlert(a.id)}
                      className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Triggered history */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <p className="section-label">Triggered History</p>
              <span className="badge-gold">{history.length} Recent</span>
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-gray-600 py-4 text-center">No alerts triggered yet</p>
            ) : (
              <div className="space-y-2">
                {history.map(h => (
                  <div key={h.id} className="flex items-center gap-3 p-3 rounded-lg bg-yellow-400/5 border border-yellow-400/20">
                    <CheckCircle2 size={16} className="text-yellow-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{h.message}</p>
                      <p className="text-xs text-gray-500 font-mono">
                        @ ${h.price_at_trigger?.toLocaleString()} · {h.channel} · {formatDistanceToNow(new Date(h.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <span className="badge-gold flex-shrink-0">Done</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Create form */}
        <div className="card h-fit">
          <div className="flex items-center gap-2 mb-4">
            <Plus size={15} className="text-gold" />
            <p className="section-label">Create Alert</p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block font-medium">Asset</label>
              <select className="select" value={form.symbol}
                onChange={e => { setForm(f => ({ ...f, symbol: e.target.value, target_value: '' })); setFormErrors({}); }}>
                {ASSETS.map(a => <option key={a.symbol} value={a.symbol}>{a.label}</option>)}
              </select>
              {currentAsset && (
                <p className="text-[10px] text-gray-600 mt-1">
                  Valid: ${currentAsset.minVal.toLocaleString()} – ${currentAsset.maxVal.toLocaleString()}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block font-medium">Condition</label>
              <select className="select" value={form.condition}
                onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}>
                {Object.entries(CONDITION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block font-medium">
                Target Value ($)
              </label>
              <input className={cn('input', formErrors.target_value ? 'border-red-400' : '')}
                type="number" step="0.01"
                placeholder={form.symbol === 'XAU' ? '3500' : form.symbol === 'WTI' ? '58' : '900'}
                value={form.target_value}
                onChange={e => { setForm(f => ({ ...f, target_value: e.target.value })); setFormErrors(fe => ({ ...fe, target_value: undefined })); }}
                onKeyDown={e => e.key === 'Enter' && createAlert()} />
              {formErrors.target_value && (
                <p className="flex items-center gap-1 text-xs text-red-400 mt-1">
                  <AlertCircle size={11} />{formErrors.target_value}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-2 block font-medium">Notify via</label>
              <div className="flex gap-5">
                {[{ key: 'notify_email', label: 'Email' }, { key: 'notify_sms', label: 'SMS' }].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={(form as any)[key]}
                      onChange={e => { setForm(f => ({ ...f, [key]: e.target.checked })); setFormErrors(fe => ({ ...fe, general: undefined })); }}
                      className="accent-yellow-400 w-4 h-4" />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
              {formErrors.general && (
                <p className="flex items-center gap-1 text-xs text-red-400 mt-1.5">
                  <AlertCircle size={11} />{formErrors.general}
                </p>
              )}
            </div>

            {form.notify_email && (
              <div>
                <label className="text-xs text-gray-400 mb-1 block font-medium">Email Address</label>
                <input className={cn('input', formErrors.contact_email ? 'border-red-400' : '')}
                  type="email" placeholder="you@email.com"
                  value={form.contact_email}
                  onChange={e => { setForm(f => ({ ...f, contact_email: e.target.value })); setFormErrors(fe => ({ ...fe, contact_email: undefined })); }} />
                {formErrors.contact_email && (
                  <p className="flex items-center gap-1 text-xs text-red-400 mt-1">
                    <AlertCircle size={11} />{formErrors.contact_email}
                  </p>
                )}
              </div>
            )}

            {form.notify_sms && (
              <div>
                <label className="text-xs text-gray-400 mb-1 block font-medium">Phone Number</label>
                <input className={cn('input', formErrors.contact_phone ? 'border-red-400' : '')}
                  type="tel" placeholder="+1 555 0100"
                  value={form.contact_phone}
                  onChange={e => { setForm(f => ({ ...f, contact_phone: e.target.value })); setFormErrors(fe => ({ ...fe, contact_phone: undefined })); }} />
                {formErrors.contact_phone && (
                  <p className="flex items-center gap-1 text-xs text-red-400 mt-1">
                    <AlertCircle size={11} />{formErrors.contact_phone}
                  </p>
                )}
              </div>
            )}

            <button onClick={createAlert} disabled={submitting}
              className="btn-primary w-full mt-2 flex items-center justify-center gap-2 h-10 disabled:opacity-40">
              {submitting
                ? <div className="w-4 h-4 border-2 border-bg/30 border-t-bg rounded-full animate-spin" />
                : <Bell size={14} />}
              Create Alert
            </button>

            {success && (
              <div className="flex items-start gap-2 p-3 bg-green-400/10 border border-green-400/20 rounded-lg">
                <CheckCircle2 size={14} className="text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-400">{success}</p>
              </div>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-border">
            <p className="text-xs text-gray-500 font-semibold mb-1">How email alerts work:</p>
            <p className="text-xs text-gray-600 leading-relaxed">
              When price hits your target, the backend sends an email via <strong className="text-gray-400">Resend</strong>.
              Alerts are checked every 3 minutes. Make sure your <strong className="text-gray-400">RESEND_API_KEY</strong> is set in Railway and your email domain is verified in Resend.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
