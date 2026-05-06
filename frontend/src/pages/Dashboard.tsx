import { useEffect, useState } from 'react';
import { Bot, Newspaper, RefreshCw } from 'lucide-react';
import { useMarketStore } from '../store/marketStore';
import { PriceAreaChart } from '../components/Charts';
import type { HistoricalPoint } from '../types';
import { cn } from '../utils/cn';
import { formatDistanceToNow } from 'date-fns';

const CHART_ASSETS = [
  { symbol: 'XAU',   name: 'Gold',      color: '#f5c842' },
  { symbol: 'XAG',   name: 'Silver',    color: '#94a3b8' },
  { symbol: 'WTI',   name: 'WTI Oil',   color: '#4fc3f7' },
  { symbol: 'BRENT', name: 'Brent',     color: '#38bdf8' },
  { symbol: 'AAPL',  name: 'Apple',     color: '#a78bfa' },
  { symbol: 'TSLA',  name: 'Tesla',     color: '#f87171' },
  { symbol: 'NVDA',  name: 'NVIDIA',    color: '#4ade80' },
  { symbol: 'MSFT',  name: 'Microsoft', color: '#60a5fa' },
];

function MetricCard({ label, value, change, color, badge }: any) {
  const isUp = (change ?? 0) >= 0;
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <span className="section-label">{label}</span>
        {badge && <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border font-mono', badge)}>LIVE</span>}
      </div>
      <div className="text-2xl font-extrabold font-mono tracking-tight transition-all duration-500" style={{ color }}>
        {value}
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <span className={cn('text-xs font-mono font-bold px-2 py-0.5 rounded', isUp ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400')}>
          {isUp ? '+' : ''}{(change ?? 0).toFixed(2)}%
        </span>
        <span className="text-xs text-gray-500">Today</span>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { commodities, stocks, news, sentiment, loading, lastUpdated, fetchAll, fetchPrediction, predictions, fetchHistory, historyCache } = useMarketStore();

  const [chartSymbol, setChartSymbol] = useState('XAU');
  const [chartPeriod, setChartPeriod] = useState(30);
  const [chartData,   setChartData]   = useState<HistoricalPoint[]>([]);

  const gold = commodities.find(c => c.symbol === 'XAU');
  const oil  = commodities.find(c => c.symbol === 'WTI');
  const nvda = stocks.find(s => s.symbol === 'NVDA');
  const selectedAsset = CHART_ASSETS.find(a => a.symbol === chartSymbol) ?? CHART_ASSETS[0];

  // Fetch/read chart data from store cache
  useEffect(() => {
    const data = fetchHistory(chartSymbol, chartPeriod);
    setChartData(data);
    fetchPrediction(chartSymbol);
  }, [chartSymbol, chartPeriod]);

  // Sync chart when background fetch updates the cache
  const cacheKey = `${chartSymbol}_${chartPeriod}`;
  useEffect(() => {
    const cached = historyCache[cacheKey];
    if (cached?.length) setChartData(cached);
  }, [historyCache[cacheKey]]);

  const timeAgo = lastUpdated
    ? formatDistanceToNow(lastUpdated, { addSuffix: true, includeSeconds: true })
    : 'never';

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">Real-time commodity & equity intelligence</p>
        </div>
        <button onClick={fetchAll} disabled={loading}
          className="btn-outline flex items-center gap-2 text-sm">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {lastUpdated
            ? `Updated ${formatDistanceToNow(lastUpdated, { addSuffix: true, includeSeconds: true })}`
            : 'Refresh'}
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <MetricCard
          label="Gold (XAU/USD)"
          value={`$${(gold?.price ?? 3327.40).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          change={gold?.change_pct ?? 1.24} color="#f5c842" badge="badge-gold" />
        <MetricCard
          label="WTI Crude Oil"
          value={`$${(oil?.price ?? 62.18).toFixed(2)}`}
          change={oil?.change_pct ?? -0.41} color="#4fc3f7" badge="badge-blue" />
        <MetricCard
          label="NVIDIA"
          value={`$${(nvda?.price ?? 872.20).toFixed(2)}`}
          change={nvda?.change_pct ?? 2.14} color="#4ade80" badge="badge-green" />
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <span className="section-label">AI Confidence</span>
            <span className="badge-purple">AI</span>
          </div>
          <div className="text-2xl font-extrabold font-mono tracking-tight text-violet-400">
            {sentiment?.score ?? 68}%
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={cn('text-xs font-mono font-bold px-2 py-0.5 rounded',
              (sentiment?.overall ?? 'bullish') === 'bullish' ? 'bg-green-400/10 text-green-400' :
              sentiment?.overall === 'bearish' ? 'bg-red-400/10 text-red-400' : 'bg-gray-400/10 text-gray-400')}>
              {(sentiment?.overall ?? 'bullish').toUpperCase()}
            </span>
            <span className="text-xs text-gray-500">Overall Market</span>
          </div>
        </div>
      </div>

      {/* Chart + Sentiment */}
      <div className="grid lg:grid-cols-5 gap-5 mb-5">
        <div className="card lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="section-label">Price Chart</p>
              <p className="text-sm font-bold mt-0.5 transition-colors" style={{ color: selectedAsset.color }}>
                {selectedAsset.name}
              </p>
            </div>
            <div className="flex gap-1">
              {[7, 30, 90].map(d => (
                <button key={d} onClick={() => setChartPeriod(d)}
                  className={cn('btn-ghost text-xs px-2.5 py-1', chartPeriod === d ? 'bg-bg-4 text-gold' : '')}>
                  {d}D
                </button>
              ))}
            </div>
          </div>
          {/* Asset selector */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {CHART_ASSETS.map(a => (
              <button key={a.symbol} onClick={() => setChartSymbol(a.symbol)}
                className="text-[10px] font-mono font-bold px-2 py-1 rounded border transition-all"
                style={chartSymbol === a.symbol
                  ? { borderColor: a.color, color: a.color, background: `${a.color}18` }
                  : { borderColor: 'rgba(255,255,255,0.08)', color: '#6b7280' }}>
                {a.symbol}
              </button>
            ))}
          </div>
          <PriceAreaChart data={chartData} color={selectedAsset.color} height={180} />
        </div>

        <div className="card lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Bot size={15} className="text-violet-400" />
            <p className="section-label">AI Sentiment</p>
            <span className="badge-purple ml-auto">Live</span>
          </div>
          <div className="space-y-3">
            {(sentiment?.assets ?? []).slice(0, 5).map(a => (
              <div key={a.symbol}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold">{a.name}</span>
                  <span className={cn('text-xs font-mono font-bold',
                    a.bullish > 50 ? 'text-green-400' : a.bearish > 50 ? 'text-red-400' : 'text-gray-400')}>
                    {a.bullish > 50 ? 'BULLISH' : a.bearish > 50 ? 'BEARISH' : 'NEUTRAL'} {a.bullish}%
                  </span>
                </div>
                <div className="flex h-1.5 rounded-full overflow-hidden">
                  <div className="bg-green-400 transition-all" style={{ width: `${a.bullish}%` }} />
                  <div className="bg-gray-600 transition-all" style={{ width: `${a.neutral}%` }} />
                  <div className="bg-red-400 transition-all" style={{ width: `${a.bearish}%` }} />
                </div>
                <p className="text-[10px] text-gray-600 mt-0.5">{a.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* News + Predictions */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Newspaper size={15} className="text-gold" />
            <p className="section-label">Market News</p>
            <span className="badge-gold ml-auto">AI Tagged</span>
          </div>
          <div>
            {news.slice(0, 5).map((n, i) => (
              <a key={n.id || i} href={n.url !== '#' ? n.url : undefined}
                target="_blank" rel="noopener noreferrer"
                className="block py-3 border-b border-border last:border-0 hover:bg-bg-3 -mx-3 px-3 rounded-lg transition-all">
                <p className="text-sm font-medium leading-snug mb-1.5">{n.headline}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-gray-500 font-mono">
                    {n.source} · {formatDistanceToNow(new Date(n.published_at), { addSuffix: true })}
                  </span>
                  {n.tags?.slice(0, 2).map(t => <span key={t} className="badge-gray">{t}</span>)}
                  <span className={cn('ml-auto text-[10px] font-bold font-mono px-1.5 py-0.5 rounded',
                    n.ai_sentiment === 'bullish' ? 'text-green-400 bg-green-400/10' :
                    n.ai_sentiment === 'bearish' ? 'text-red-400 bg-red-400/10' : 'text-gray-400 bg-gray-400/10')}>
                    {n.ai_sentiment?.toUpperCase()} {n.ai_confidence}%
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Bot size={15} className="text-violet-400" />
            <p className="section-label">7-Day AI Predictions</p>
            <span className="badge-purple ml-auto">Claude AI</span>
          </div>
          <div className="space-y-4">
            {[
              { symbol: 'XAU',  name: 'Gold',    color: '#f5c842' },
              { symbol: 'WTI',  name: 'WTI Oil', color: '#4fc3f7' },
              { symbol: 'NVDA', name: 'NVIDIA',  color: '#4ade80' },
              { symbol: 'TSLA', name: 'Tesla',   color: '#f87171' },
            ].map(({ symbol, name, color }) => {
              const pred = predictions[symbol];
              const bullish = pred?.bullish_pct ?? 50;
              const dir = bullish > 50 ? '↑' : '↓';
              const dirColor = bullish > 50 ? 'text-green-400' : 'text-red-400';
              return (
                <div key={symbol} className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold w-12 text-gray-300 flex-shrink-0">{name.split(' ')[0]}</span>
                  <div className="flex-1 h-1.5 bg-bg-4 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${bullish}%`, background: color }} />
                  </div>
                  <span className={cn('text-xs font-mono font-bold w-14 text-right flex-shrink-0', dirColor)}>
                    {dir} {bullish}%
                  </span>
                  {pred?.target_price && (
                    <span className="text-[10px] font-mono text-gray-500 w-16 text-right flex-shrink-0">
                      ${pred.target_price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  )}
                </div>
              );
            })}
            <p className="text-xs text-gray-600 pt-2 border-t border-border">
              Based on live prices, news sentiment & technical indicators. Not financial advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
