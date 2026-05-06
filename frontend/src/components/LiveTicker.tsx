import { useMarketStore } from '../store/marketStore';
import { cn } from '../utils/cn';

const FALLBACK = [
  { symbol: 'XAU',  name: 'Gold',      price: 3327.40, change_pct:  1.24 },
  { symbol: 'XAG',  name: 'Silver',    price:   32.14, change_pct:  0.83 },
  { symbol: 'WTI',  name: 'WTI Oil',   price:   62.18, change_pct: -0.41 },
  { symbol: 'BRENT',name: 'Brent',     price:   65.42, change_pct: -0.61 },
  { symbol: 'AAPL', name: 'Apple',     price:  213.40, change_pct:  0.32 },
  { symbol: 'TSLA', name: 'Tesla',     price:  248.90, change_pct: -1.82 },
  { symbol: 'NVDA', name: 'NVIDIA',    price:  872.20, change_pct:  2.14 },
  { symbol: 'MSFT', name: 'Microsoft', price:  418.60, change_pct:  0.57 },
  { symbol: 'META', name: 'Meta',      price:  542.30, change_pct:  1.18 },
  { symbol: 'GOOGL',name: 'Alphabet',  price:  175.80, change_pct:  0.44 },
];

export function LiveTicker() {
  const { commodities, stocks } = useMarketStore();
  const live = [...commodities, ...stocks];
  const items = live.length >= 4 ? live : FALLBACK;

  // Triple-duplicate so there's always plenty of content to scroll through
  const rows = [...items, ...items, ...items];

  return (
    <>
      {/* Keyframe injected via style tag — guaranteed to work regardless of Tailwind purge */}
      <style>{`
        @keyframes nexus-ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        .nexus-ticker-inner {
          display: flex;
          white-space: nowrap;
          animation: nexus-ticker 40s linear infinite;
          width: max-content;
        }
        .nexus-ticker-inner:hover { animation-play-state: paused; }
      `}</style>

      <div style={{ overflow: 'hidden', paddingTop: 6, paddingBottom: 6 }}>
        <div className="nexus-ticker-inner">
          {rows.map((item, i) => (
            <div key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '0 20px', borderRight: '1px solid rgba(255,255,255,0.08)',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'Space Mono, monospace', color: '#f0f0f5' }}>
                {item.symbol}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'Space Mono, monospace', color: '#f5c842' }}>
                ${item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span style={{
                fontSize: 10, fontFamily: 'Space Mono, monospace', fontWeight: 700,
                color: item.change_pct >= 0 ? '#4ade80' : '#f87171',
              }}>
                {item.change_pct >= 0 ? '+' : ''}{item.change_pct.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
