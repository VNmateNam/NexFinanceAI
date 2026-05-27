import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useMarketStore } from '../store/marketStore';
import { pricesApi } from '../services/api';
import { PriceAreaChart } from '../components/Charts';
import type { HistoricalPoint } from '../types';
import { cn } from '../utils/cn';

const SIGNAL = (chg: number) =>
  chg > 0.5  ? { label: 'BUY',  cls: 'badge-green' } :
  chg < -0.5 ? { label: 'SELL', cls: 'badge-red'   } :
               { label: 'HOLD', cls: 'badge-gray'   };

const COMMODITY_FALLBACK = [
  { symbol: 'XAU',   name: 'Gold',       price: 3327.40, change_pct:  1.24, change_abs:  40.72, source: 'demo', fetched_at: '' },
  { symbol: 'XAG',   name: 'Silver',     price:   32.14, change_pct:  0.83, change_abs:   0.27, source: 'demo', fetched_at: '' },
  { symbol: 'WTI',   name: 'WTI Oil',    price:   62.18, change_pct: -0.41, change_abs:  -0.26, source: 'demo', fetched_at: '' },
  { symbol: 'BRENT', name: 'Brent Oil',  price:   65.42, change_pct: -0.61, change_abs:  -0.40, source: 'demo', fetched_at: '' },
  { symbol: 'XPT',   name: 'Platinum',   price:  998.00, change_pct: -0.12, change_abs:  -1.20, source: 'demo', fetched_at: '' },
];
const STOCK_FALLBACK = [
  { symbol: 'AAPL',  name: 'Apple',     price:  213.40, change_pct:  0.32, change_abs:  0.68, source: 'demo', fetched_at: '' },
  { symbol: 'TSLA',  name: 'Tesla',     price:  248.90, change_pct: -1.82, change_abs: -4.62, source: 'demo', fetched_at: '' },
  { symbol: 'NVDA',  name: 'NVIDIA',    price:  872.20, change_pct:  2.14, change_abs: 18.32, source: 'demo', fetched_at: '' },
  { symbol: 'MSFT',  name: 'Microsoft', price:  418.60, change_pct:  0.57, change_abs:  2.38, source: 'demo', fetched_at: '' },
  { symbol: 'META',  name: 'Meta',      price:  542.30, change_pct:  1.18, change_abs:  6.33, source: 'demo', fetched_at: '' },
  { symbol: 'GOOGL', name: 'Alphabet',  price:  175.80, change_pct:  0.44, change_abs:  0.77, source: 'demo', fetched_at: '' },
];
const CRYPTO_FALLBACK = [
  { symbol: 'BTC',  name: 'Bitcoin',  price: 67420.00, change_pct:  2.14, change_abs: 1418.00, source: 'demo', fetched_at: '' },
  { symbol: 'ETH',  name: 'Ethereum', price:  3512.00, change_pct:  1.88, change_abs:   64.90, source: 'demo', fetched_at: '' },
  { symbol: 'SOL',  name: 'Solana',   price:   168.40, change_pct:  3.21, change_abs:    5.24, source: 'demo', fetched_at: '' },
  { symbol: 'BNB',  name: 'BNB',      price:   598.20, change_pct:  0.74, change_abs:    4.40, source: 'demo', fetched_at: '' },
  { symbol: 'XRP',  name: 'XRP',      price:     0.62, change_pct: -0.48, change_abs:  -0.003,source: 'demo', fetched_at: '' },
  { symbol: 'DOGE', name: 'Dogecoin', price:    0.087, change_pct:  1.16, change_abs:   0.001,source: 'demo', fetched_at: '' },
];

type Tab = 'commodities' | 'stocks' | 'crypto';

const TAB_CONFIG: { key: Tab; label: string; emoji: string }[] = [
  { key: 'commodities', label: 'Commodities', emoji: '🪙' },
  { key: 'stocks',      label: 'Stocks',      emoji: '📈' },
  { key: 'crypto',      label: 'Crypto',      emoji: '₿'  },
];

function fmtPrice(price: number) {
  if (price < 1)    return price.toFixed(4);
  if (price < 10)   return price.toFixed(3);
  return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function Markets() {
  const { commodities, stocks, crypto, sentiment } = useMarketStore();
  const [selected, setSelected] = useState('XAU');
  const [history, setHistory]   = useState<HistoricalPoint[]>([]);
  const [period, setPeriod]     = useState(30);
  const [tab, setTab]           = useState<Tab>('commodities');

  useEffect(() => {
    pricesApi.getHistory(selected, period).then(setHistory).catch(() => {});
  }, [selected, period]);

  const displayCommodities = commodities.length > 0 ? commodities : COMMODITY_FALLBACK;
  const displayStocks      = stocks.length      > 0 ? stocks      : STOCK_FALLBACK;
  const displayCrypto      = crypto.length       > 0 ? crypto      : CRYPTO_FALLBACK;

  const tabData: Record<Tab, any[]> = {
    commodities: displayCommodities,
    stocks:      displayStocks,
    crypto:      displayCrypto,
  };

  const allAssets   = [...displayCommodities, ...displayStocks, ...displayCrypto];
  const selectedAsset = allAssets.find(a => a.symbol === selected);
  const selectedColor =
    tab === 'crypto' ? '#f97316' :
    tab === 'stocks' ? '#a78bfa' : '#f5c842';

  function AssetRow({ a }: { a: any }) {
    const sig = SIGNAL(a.change_pct);
    const isUp = a.change_pct >= 0;
    return (
      <tr
        onClick={() => setSelected(a.symbol)}
        className={cn(
          'cursor-pointer transition-all border-b border-border/60 last:border-0',
          selected === a.symbol
            ? 'bg-gold/5 border-l-2 border-l-gold'
            : 'hover:bg-bg-3'
        )}
      >
        {/* Symbol + Name */}
        <td className="py-3 pl-4 pr-2 w-[40%]">
          <div className="font-bold text-sm leading-tight">{a.symbol}</div>
          <div className="text-[11px] text-gray-500 mt-0.5 truncate">{a.name}</div>
        </td>

        {/* Price */}
        <td className="py-3 px-2 w-[35%]">
          <span className="font-mono font-bold text-gold text-sm">
            ${fmtPrice(a.price)}
          </span>
        </td>

        {/* Change */}
        <td className="py-3 px-2 w-[25%]">
          <div className={cn('flex items-center gap-1 font-mono font-bold text-xs', isUp ? 'text-green-400' : 'text-red-400')}>
            {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            <span className="whitespace-nowrap">{isUp ? '+' : ''}{a.change_pct.toFixed(2)}%</span>
          </div>
          <span className={cn('hidden xl:inline-flex mt-1', sig.cls)}>{sig.label}</span>
        </td>
      </tr>
    );
  }

  return (
    <div>
      <h1 className="page-title">Markets</h1>
      <p className="page-sub">Live prices, charts & AI signals across all asset classes</p>

      {/* ── Tables ─────────────────────────────────────────── */}

      {/* Mobile: tab switcher + single panel */}
      <div className="lg:hidden mb-5">
        <div className="flex gap-1 mb-3 bg-bg-3 p-1 rounded-xl">
          {TAB_CONFIG.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn(
                'flex-1 text-xs font-semibold py-2 rounded-lg transition-all',
                tab === t.key ? 'bg-bg text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'
              )}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
        <div className="card p-0 overflow-hidden">
          <div className="px-4 pt-3 pb-2 border-b border-border">
            <p className="section-label">{TAB_CONFIG.find(t => t.key === tab)?.emoji} {TAB_CONFIG.find(t => t.key === tab)?.label}</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-bg-3/50">
                <th className="text-left py-2 pl-4 pr-2 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Asset</th>
                <th className="text-left py-2 px-2 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Price</th>
                <th className="text-left py-2 px-2 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Change</th>
              </tr>
            </thead>
            <tbody>{tabData[tab].map((a: any) => <AssetRow key={a.symbol} a={a} />)}</tbody>
          </table>
        </div>
      </div>

      {/* Desktop: 3 equal columns, each full-width table */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-4 mb-5">
        {TAB_CONFIG.map(t => (
          <div key={t.key} className="card p-0 overflow-hidden">
            <div className="px-4 pt-3 pb-2 border-b border-border bg-bg-3/30">
              <p className="section-label">{t.emoji} {t.label}</p>
            </div>
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-border/60 bg-bg-3/20">
                  <th className="text-left py-2 pl-4 pr-2 text-[10px] text-gray-500 font-semibold uppercase tracking-wider w-[40%]">Asset</th>
                  <th className="text-left py-2 px-2 text-[10px] text-gray-500 font-semibold uppercase tracking-wider w-[35%]">Price</th>
                  <th className="text-left py-2 px-2 text-[10px] text-gray-500 font-semibold uppercase tracking-wider w-[25%]">Change</th>
                </tr>
              </thead>
              <tbody>{tabData[t.key].map((a: any) => <AssetRow key={a.symbol} a={a} />)}</tbody>
            </table>
          </div>
        ))}
      </div>

      {/* ── Chart ──────────────────────────────────────────── */}
      <div className="card mb-5">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div>
            <p className="section-label">Price Chart — {selected}</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: selectedColor }}>
              {selectedAsset?.name}
            </p>
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
        <PriceAreaChart data={history} color={selectedColor} height={220} />
      </div>

      {/* ── AI Sentiment ───────────────────────────────────── */}
      <div className="card">
        <p className="section-label mb-4">AI Sentiment — All Assets</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {(sentiment?.assets ?? [
            { symbol: 'XAU',  name: 'Gold',    bullish: 78, bearish: 12, neutral: 10, note: 'USD weakness and safe-haven demand' },
            { symbol: 'WTI',  name: 'WTI Oil', bullish: 44, bearish: 40, neutral: 16, note: 'Mixed OPEC signals vs demand concern' },
            { symbol: 'XAG',  name: 'Silver',  bullish: 65, bearish: 22, neutral: 13, note: 'Solar industrial demand remains strong' },
            { symbol: 'NVDA', name: 'NVIDIA',  bullish: 88, bearish:  7, neutral:  5, note: 'AI chip demand dominates narrative' },
            { symbol: 'TSLA', name: 'Tesla',   bullish: 38, bearish: 49, neutral: 13, note: 'Price cuts pressuring margins' },
            { symbol: 'BTC',  name: 'Bitcoin', bullish: 72, bearish: 18, neutral: 10, note: 'ETF inflows and halving tailwinds' },
          ]).map((a: any) => (
            <div key={a.symbol} className="bg-bg-3 rounded-xl p-3 sm:p-4">
              <div className="flex justify-between items-center mb-2 gap-2">
                <span className="font-semibold text-sm truncate">{a.name}</span>
                <span className={cn('text-xs font-mono font-bold whitespace-nowrap flex-shrink-0',
                  a.bullish > 55 ? 'text-green-400' : a.bearish > 50 ? 'text-red-400' : 'text-gray-400')}>
                  {a.bullish > 55 ? '🟢 BULL' : a.bearish > 50 ? '🔴 BEAR' : '🟡 NEUTRAL'}
                </span>
              </div>
              <div className="flex h-2 rounded-full overflow-hidden mb-2">
                <div className="bg-green-400 transition-all" style={{ width: `${a.bullish}%` }} />
                <div className="bg-gray-600 transition-all" style={{ width: `${a.neutral}%` }} />
                <div className="bg-red-400 transition-all"  style={{ width: `${a.bearish}%` }} />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-gray-500 mb-1.5">
                <span className="text-green-400/70">Bull {a.bullish}%</span>
                <span>{a.neutral}%</span>
                <span className="text-red-400/70">Bear {a.bearish}%</span>
              </div>
              <p className="text-xs text-gray-500 leading-snug">{a.note}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
