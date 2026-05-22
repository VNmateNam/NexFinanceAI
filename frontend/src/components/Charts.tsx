import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, PieChart, Pie, Cell, Legend
} from 'recharts';
import type { HistoricalPoint } from '../types';

const CHART_COLORS = {
  gold: '#f5c842',
  oil: '#4fc3f7',
  silver: '#94a3b8',
  green: '#4ade80',
  red: '#f87171',
  purple: '#a78bfa',
};

const tooltipStyle = {
  contentStyle: { background: '#1e1f28', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: 12 },
  labelStyle: { color: '#9ca3af', fontFamily: 'Space Mono, monospace' },
  itemStyle: { color: '#f5c842', fontFamily: 'Space Mono, monospace' },
};

// ── Price Area Chart ──────────────────────────────────────────
interface PriceChartProps {
  data: HistoricalPoint[];
  color?: string;
  height?: number;
  prefix?: string;
}

export function PriceAreaChart({ data, color = '#f5c842', height = 220, prefix = '$' }: PriceChartProps) {
  // Filter out any points where price is NaN/null/undefined
  const safeData = data.filter(d => d.price != null && isFinite(Number(d.price)));
  if (safeData.length === 0) {
    return <div style={{ height }} className="flex items-center justify-center text-gray-600 text-xs">No data</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={safeData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.15} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10, fontFamily: 'Space Mono' }}
          tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fill: '#6b7280', fontSize: 10, fontFamily: 'Space Mono' }}
          tickLine={false} axisLine={false}
          tickFormatter={v => `${prefix}${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          width={56} />
        <Tooltip {...tooltipStyle}
          formatter={(v: number) => [`${prefix}${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 'Price']} />
        <Area type="monotone" dataKey="price" stroke={color} strokeWidth={2}
          fill={`url(#grad-${color.replace('#', '')})`} dot={false} activeDot={{ r: 4, fill: color }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Multi-line chart ──────────────────────────────────────────
interface MultiLineProps {
  data: any[];
  lines: { key: string; color: string; label: string }[];
  height?: number;
}

export function MultiLineChart({ data, lines, height = 240 }: MultiLineProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10, fontFamily: 'Space Mono' }}
          tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fill: '#6b7280', fontSize: 10, fontFamily: 'Space Mono' }}
          tickLine={false} axisLine={false} tickFormatter={v => v.toFixed(0)} width={40} />
        <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => [`${v.toFixed(2)}`, name]} />
        {lines.map(l => (
          <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color}
            strokeWidth={2} dot={false} activeDot={{ r: 3 }} name={l.label} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Bar chart ─────────────────────────────────────────────────
export function BarChartComp({ data, dataKey, color = '#f5c842', height = 200 }: any) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11, fontFamily: 'Space Mono' }}
          tickLine={false} axisLine={false} />
        <YAxis tick={{ fill: '#6b7280', fontSize: 10, fontFamily: 'Space Mono' }}
          tickLine={false} axisLine={false} width={40} />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Donut/Pie chart ───────────────────────────────────────────
interface DonutProps {
  data: { name: string; value: number; color: string }[];
  height?: number;
  innerRadius?: number;
}

export function DonutChart({ data, height = 220, innerRadius = 60 }: DonutProps) {
  // Filter out zero/NaN values that cause SVG path errors
  const safeData = data.filter(d => d.value != null && isFinite(d.value) && d.value > 0);
  if (safeData.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-gray-600 text-xs">
        No data
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={safeData} cx="50%" cy="50%" innerRadius={innerRadius} outerRadius={90}
          paddingAngle={3} dataKey="value">
          {safeData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="transparent" />)}
        </Pie>
        <Tooltip
          contentStyle={{ background: '#1e1f28', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: 12 }}
          formatter={(v: number) => [`${v}%`, '']} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export { CHART_COLORS };
