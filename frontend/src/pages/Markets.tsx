import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useMarketStore } from '../store/marketStore';
import { pricesApi } from '../services/api';
import { PriceAreaChart, MultiLineChart } from '../components/Charts';
import type { HistoricalPoint } from '../types';
import { cn } from '../utils/cn';

const SIGNAL = (chg: number) =>
  chg > 0.5 ? { label: 'BUY', cls: 'badge-green' } :
  chg < -0.5 ? { label: 'SELL', cls: 'badge-red' } :
  { label: 'HOLD', cls: 'badge-gray' };

export function Markets() {
  const { commodities, stocks, sentiment } = useMarketStore();
  const [selected, setSelected] = useState('XAU');
  const [history, setHistory] = useState<HistoricalPoint[]>([]);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    pricesApi.getHistory(selected, period).then(setHistory).catch(() => {});
  }, [selected, period]);

  const allAssets = [...commodities, ...stocks];
  const COMMODITY_FALLBACK = [
    { symbol: 'XAU', name: 'Gold', price: 3327.40, change_pct: 1.24, change_abs: 40.72, source: 'demo', fetched_at: '' },
    { symbol: 'XAG', name: 'Silver', price: 32.14, change_pct: 0.83, change_abs: 0.27, source: 'demo', fetched_at: '' },
    { symbol: 'WTI', name: 'WTI Oil', price: 62.18, change_pct: -0.41, change_abs: -0.26, source: 'demo', fetched_at: '' },
    { symbol: 'BRENT', name: 'Brent Oil', price: 65.42, change_pct: -0.61, change_abs: -0.40, source: 'demo', fetched_at: '' },
    { symbol: 'XPT', name: 'Platinum', price: 998.00, change_pct: -0.12, change_abs: -1.20, source: 'demo', fetched_at: '' },
  ];
  const STOCK_FALLBACK = [
    { symbol: 'AAPL', name: 'Apple', price: 213.40, change_pct: 0.32, change_abs: 0.68, source: 'demo', fetched_at: '' },
    { symbol: 'TSLA', name: 'Tesla', price: 248.90, change_pct: -1.82, change_abs: -4.62, source: 'demo', fetched_at: '' },
    { symbol: 'NVDA', name: 'NVIDIA', price: 872.20, change_pct: 2.14, change_abs: 18.32, source: 'demo', fetched_at: '' },
    { symbol: 'MSFT', name: 'Microsoft', price: 418.60, change_pct: 0.57, change_abs: 2.38, source: 'demo', fetched_at: '' },
    { symbol: 'META', name: 'Meta', price: 542.30, change_pct: 1.18, change_abs: 6.33, source: 'demo', fetched_at: '' },
    { symbol: 'GOOGL', name: 'Alphabet', price: 175.80, change_pct: 0.44, change_abs: 0.77, source: 'demo', fetched_at: '' },
  ];

  const displayCommodities = commodities.length > 0 ? commodities : COMMODITY_FALLBACK;
  const displayStocks = stocks.length > 0 ? stocks : STOCK_FALLBACK;

  function AssetRow({ a }: { a: any }) {
    const sig = SIGNAL(a.change_pct);
    return (
      <tr onClick={() => setSelected(a.symbol)}
        className={cn('cursor-pointer transition-all hover:bg-bg-3', selected === a.symbol ? 'bg-bg-4' : '')}>
        <td className="py-3 px-4">
          <div className="font-bold text-sm">{a.symbol}</div>
          <div className="text-xs text-gray-500">{a.name}</div>
        </td>
        <td className="py-3 px-4 font-mono font-bold text-sm text-gold">
          ${a.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
        <td className={cn('py-3 px-4 font-mono text-sm font-bold', a.change_pct >= 0 ? 'text-green-400' : 'text-red-400')}>
          <div className="flex items-center gap-1">
            {a.change_pct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {a.change_pct >= 0 ? '+' : ''}{a.change_pct.toFixed(2)}%
          </div>
        </td>
        <td className="py-3 px-4"><span className={sig.cls}>{sig.label}</span></td>
      </tr>
    );
  }

  return (
    <div>
      <h1 className="page-title">Markets</h1>
      <p className="page-sub">Live prices, charts & AI signals across all asset classes</p>

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <div className="card">
          <p className="section-label mb-3">Commodities</p>
          <table className="w-full">
            <thead><tr className="border-b border-border">
              <th className="text-left py-2 px-4 text-xs text-gray-600 font-semibold uppercase tracking-wider">Asset</th>
              <th className="text-left py-2 px-4 text-xs text-gray-600 font-semibold uppercase tracking-wider">Price</th>
              <th className="text-left py-2 px-4 text-xs text-gray-600 font-semibold uppercase tracking-wider">Change</th>
              <th className="text-left py-2 px-4 text-xs text-gray-600 font-semibold uppercase tracking-wider">Signal</th>
            </tr></thead>
            <tbody>{displayCommodities.map(a => <AssetRow key={a.symbol} a={a} />)}</tbody>
          </table>
        </div>
        <div className="card">
          <p className="section-label mb-3">Tech Stocks</p>
          <table className="w-full">
            <thead><tr className="border-b border-border">
              <th className="text-left py-2 px-4 text-xs text-gray-600 font-semibold uppercase tracking-wider">Ticker</th>
              <th className="text-left py-2 px-4 text-xs text-gray-600 font-semibold uppercase tracking-wider">Price</th>
              <th className="text-left py-2 px-4 text-xs text-gray-600 font-semibold uppercase tracking-wider">Change</th>
              <th className="text-left py-2 px-4 text-xs text-gray-600 font-semibold uppercase tracking-wider">Signal</th>
            </tr></thead>
            <tbody>{displayStocks.map(a => <AssetRow key={a.symbol} a={a} />)}</tbody>
          </table>
        </div>
      </div>

      {/* Chart */}
      <div className="card mb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="section-label">Price Chart — {selected}</p>
            <p className="text-sm font-bold mt-0.5 text-gold">{[...displayCommodities, ...displayStocks].find(a => a.symbol === selected)?.name}</p>
          </div>
          <div className="flex gap-1">
            {[7, 30, 90, 365].map(d => (
              <button key={d} onClick={() => setPeriod(d)}
                className={cn('btn-ghost text-xs px-2.5 py-1', period === d ? 'bg-bg-4 text-gold' : '')}>
                {d >= 365 ? '1Y' : `${d}D`}
              </button>
            ))}
          </div>
        </div>
        <PriceAreaChart data={history} color="#f5c842" height={240} />
      </div>

      {/* Full sentiment */}
      <div className="card">
        <p className="section-label mb-4">AI Sentiment — All Assets</p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {(sentiment?.assets ?? [
            { symbol: 'XAU', name: 'Gold', bullish: 78, bearish: 12, neutral: 10, note: 'USD weakness and safe-haven demand' },
            { symbol: 'WTI', name: 'WTI Oil', bullish: 44, bearish: 40, neutral: 16, note: 'Mixed OPEC signals vs demand concern' },
            { symbol: 'XAG', name: 'Silver', bullish: 65, bearish: 22, neutral: 13, note: 'Solar industrial demand remains strong' },
            { symbol: 'NVDA', name: 'NVIDIA', bullish: 88, bearish: 7, neutral: 5, note: 'AI chip demand dominates narrative' },
            { symbol: 'TSLA', name: 'Tesla', bullish: 38, bearish: 49, neutral: 13, note: 'Price cuts pressuring margins' },
            { symbol: 'SPX', name: 'S&P 500', bullish: 62, bearish: 21, neutral: 17, note: 'Earnings season broadly positive' },
          ]).map(a => (
            <div key={a.symbol} className="bg-bg-3 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-sm">{a.name}</span>
                <span className={cn('text-xs font-mono font-bold',
                  a.bullish > 55 ? 'text-green-400' : a.bearish > 50 ? 'text-red-400' : 'text-gray-400')}>
                  {a.bullish > 55 ? '🟢 BULLISH' : a.bearish > 50 ? '🔴 BEARISH' : '🟡 NEUTRAL'}
                </span>
              </div>
              <div className="flex h-2 rounded-full overflow-hidden gap-px mb-2">
                <div className="bg-green-400 transition-all" style={{ width: `${a.bullish}%` }} />
                <div className="bg-gray-600 transition-all" style={{ width: `${a.neutral}%` }} />
                <div className="bg-red-400 transition-all" style={{ width: `${a.bearish}%` }} />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-gray-500 mb-2">
                <span>Bull {a.bullish}%</span><span>Neutral {a.neutral}%</span><span>Bear {a.bearish}%</span>
              </div>
              <p className="text-xs text-gray-500">{a.note}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
