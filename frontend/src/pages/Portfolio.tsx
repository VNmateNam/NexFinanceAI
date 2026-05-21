import { useEffect, useState } from 'react';
import { Plus, Trash2, TrendingUp, TrendingDown, Briefcase } from 'lucide-react';
import { portfolioApi } from '../services/api';
import { DonutChart, PriceAreaChart } from '../components/Charts';
import type { PortfolioPosition, PortfolioSummary } from '../types';
import { cn } from '../utils/cn';

const DEMO_POSITIONS: PortfolioPosition[] = [
  { id: '1', symbol: 'XAU', name: 'Gold ETF', asset_type: 'commodity', quantity: 15, avg_cost: 3100, current_price: 3327.40, market_value: 49911, pnl: 3411, pnl_pct: 7.3, color: '#f5c842', opened_at: '' },
  { id: '2', symbol: 'WTI', name: 'WTI Futures', asset_type: 'commodity', quantity: 450, avg_cost: 64.2, current_price: 62.18, market_value: 27981, pnl: -909, pnl_pct: -3.1, color: '#4fc3f7', opened_at: '' },
  { id: '3', symbol: 'NVDA', name: 'NVIDIA', asset_type: 'stock', quantity: 28, avg_cost: 652, current_price: 872.20, market_value: 24421, pnl: 6165, pnl_pct: 33.8, color: '#4ade80', opened_at: '' },
  { id: '4', symbol: 'AAPL', name: 'Apple', asset_type: 'stock', quantity: 80, avg_cost: 198, current_price: 213.40, market_value: 17072, pnl: 1232, pnl_pct: 7.8, color: '#a78bfa', opened_at: '' },
  { id: '5', symbol: 'XAG', name: 'Silver ETF', asset_type: 'commodity', quantity: 440, avg_cost: 29.8, current_price: 32.14, market_value: 14141, pnl: 1029, pnl_pct: 7.8, color: '#94a3b8', opened_at: '' },
];

const DEMO_SUMMARY: PortfolioSummary = {
  total_value: 133526, total_cost: 119698, total_pnl: 13828, total_pnl_pct: 11.55,
};

// Safe number helpers — never crash on null/undefined/NaN
const safe = (n: any, fallback = 0): number => (n != null && isFinite(Number(n)) ? Number(n) : fallback);
const fmt$ = (n: any, digits = 0) => `$${safe(n).toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits })}`;
const fmtPct = (n: any, digits = 2) => `${safe(n) >= 0 ? '+' : ''}${safe(n).toFixed(digits)}%`;

export function Portfolio() {
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ symbol: '', name: '', asset_type: 'stock', quantity: '', avg_cost: '', color: '#f5c842' });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    portfolioApi.getPortfolio()
      .then(data => {
        setPositions(data?.positions ?? []);
        setSummary(data?.summary ?? null);
      })
      .catch(() => {
        setPositions(DEMO_POSITIONS);
        setSummary(DEMO_SUMMARY);
      })
      .finally(() => setFetching(false));
  }, []);

  // Use demo data if backend returns empty (no positions yet = show demo)
  const displayPositions = positions.length > 0 ? positions : (fetching ? [] : DEMO_POSITIONS);
  const displaySummary: PortfolioSummary = summary ?? DEMO_SUMMARY;

  // Normalise all numbers coming from backend (may be strings or null)
  const safePositions = displayPositions.map(p => ({
    ...p,
    quantity: safe(p.quantity),
    avg_cost: safe(p.avg_cost),
    current_price: safe(p.current_price),
    market_value: safe(p.market_value),
    pnl: safe(p.pnl),
    pnl_pct: safe(p.pnl_pct),
  }));

  const totalVal = safe(displaySummary.total_value, 1);
  const pieData = safePositions.map(p => ({
    name: p.name, value: Math.round((safe(p.market_value) / totalVal) * 100), color: p.color,
  }));

  async function addPosition() {
    if (!form.symbol || !form.name || !form.quantity || !form.avg_cost) return;
    setLoading(true);
    try {
      await portfolioApi.addPosition({ ...form, quantity: parseFloat(form.quantity), avg_cost: parseFloat(form.avg_cost) });
      const data = await portfolioApi.getPortfolio();
      setPositions(data?.positions ?? []);
      setSummary(data?.summary ?? null);
    } catch { /* stay in demo mode */ }
    setShowAdd(false);
    setLoading(false);
  }

  async function removePosition(id: string) {
    try {
      await portfolioApi.closePosition(id);
      const data = await portfolioApi.getPortfolio();
      setPositions(data?.positions ?? []);
      setSummary(data?.summary ?? null);
    } catch {
      setPositions(prev => prev.filter(p => p.id !== id));
    }
  }

  const PERF_DATA = Array.from({ length: 90 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (90 - i));
    return { date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), price: 115000 + Math.random() * 500 * i };
  });

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-7 h-7 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div><h1 className="page-title">Portfolio</h1><p className="page-sub">Track positions, P&amp;L &amp; allocation</p></div>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={14} /> Add Position
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="card mb-5 border-gold/30">
          <p className="section-label mb-4">New Position</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-400 mb-1 block">Symbol</label><input className="input" placeholder="e.g. AAPL" value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))} /></div>
            <div><label className="text-xs text-gray-400 mb-1 block">Name</label><input className="input" placeholder="e.g. Apple Inc" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className="text-xs text-gray-400 mb-1 block">Type</label><select className="select" value={form.asset_type} onChange={e => setForm(f => ({ ...f, asset_type: e.target.value }))}><option value="stock">Stock</option><option value="commodity">Commodity</option><option value="index">Index</option></select></div>
            <div><label className="text-xs text-gray-400 mb-1 block">Quantity</label><input className="input" type="number" placeholder="0" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} /></div>
            <div><label className="text-xs text-gray-400 mb-1 block">Avg Cost ($)</label><input className="input" type="number" placeholder="0.00" value={form.avg_cost} onChange={e => setForm(f => ({ ...f, avg_cost: e.target.value }))} /></div>
            <div><label className="text-xs text-gray-400 mb-1 block">Color</label><input type="color" className="w-full h-10 bg-bg-4 rounded-lg border border-border-light cursor-pointer" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={addPosition} disabled={loading} className="btn-primary text-sm h-9 px-4 flex items-center gap-2">
              {loading && <div className="w-3 h-3 border-2 border-bg/30 border-t-bg rounded-full animate-spin" />}
              Add Position
            </button>
            <button onClick={() => setShowAdd(false)} className="btn-outline text-sm h-9 px-4">Cancel</button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
        {[
          { label: 'Total Value', value: fmt$(displaySummary.total_value), color: 'text-gold' },
          { label: 'Total P&L', value: `${safe(displaySummary.total_pnl) >= 0 ? '+' : ''}${fmt$(displaySummary.total_pnl)}`, color: safe(displaySummary.total_pnl) >= 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'Return %', value: fmtPct(displaySummary.total_pnl_pct), color: safe(displaySummary.total_pnl_pct) >= 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'Positions', value: `${safePositions.length}`, color: 'text-violet-400' },
        ].map(s => (
          <div key={s.label} className="card">
            <p className="section-label mb-1.5">{s.label}</p>
            <p className={cn('text-xl sm:text-2xl font-extrabold font-mono tracking-tight', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-4 sm:gap-5 mb-5">
        <div className="card lg:col-span-2">
          <p className="section-label mb-2">Allocation</p>
          <DonutChart data={pieData} />
          <div className="mt-3 space-y-1.5">
            {pieData.slice(0, 5).map(p => (
              <div key={p.name} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                <span className="text-xs text-gray-400 flex-1 truncate">{p.name}</span>
                <span className="text-xs font-mono font-bold">{p.value}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card lg:col-span-3">
          <p className="section-label mb-3">Positions</p>
          {safePositions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Briefcase size={28} className="text-gray-600 mb-2" />
              <p className="text-sm text-gray-500">No positions yet</p>
              <button onClick={() => setShowAdd(true)} className="btn-outline text-xs mt-3 px-3 h-8">+ Add your first position</button>
            </div>
          ) : (
            <div className="space-y-0 overflow-x-auto">
              {safePositions.map(p => (
                <div key={p.id} className="flex items-center gap-2 sm:gap-3 py-3 border-b border-border last:border-0 hover:bg-bg-3 -mx-3 px-3 rounded-lg transition-all group">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{p.name}</p>
                    <p className="text-xs text-gray-500 font-mono">{p.quantity} × {fmt$(p.avg_cost, 2)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold font-mono">{fmt$(p.market_value)}</p>
                    <p className={cn('text-xs font-mono', safe(p.pnl) >= 0 ? 'text-green-400' : 'text-red-400')}>
                      {safe(p.pnl) >= 0 ? '+' : ''}{fmt$(p.pnl)} ({fmtPct(p.pnl_pct, 1)})
                    </p>
                  </div>
                  <button onClick={() => removePosition(p.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 hover:text-red-400 flex-shrink-0 ml-1">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <p className="section-label mb-4">Performance — 90 Days</p>
        <PriceAreaChart data={PERF_DATA} color="#a78bfa" height={220} prefix="$" />
      </div>
    </div>
  );
}
