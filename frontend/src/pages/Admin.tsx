import { useEffect, useState } from 'react';
import { Users, TrendingUp, Bell, DollarSign, Shield, ChevronUp } from 'lucide-react';
import { adminApi } from '../services/api';
import { BarChartComp, PriceAreaChart } from '../components/Charts';
import type { AdminStats, UserProfile } from '../types';
import { cn } from '../utils/cn';
import { formatDistanceToNow } from 'date-fns';

const DEMO_STATS: AdminStats = {
  total_users: 4821, pro_users: 1240, active_alerts: 8302, new_users_7d: 127, mrr: 24800,
};

const DEMO_USERS = [
  { id: '1', email: 'alex@email.com', full_name: 'Alex Chen', plan: 'pro', is_admin: false, created_at: new Date(Date.now() - 432000000).toISOString() },
  { id: '2', email: 'sarah@email.com', full_name: 'Sarah Okafor', plan: 'free', is_admin: false, created_at: new Date(Date.now() - 604800000).toISOString() },
  { id: '3', email: 'mo@email.com', full_name: 'Mohammed Al-Rashid', plan: 'enterprise', is_admin: false, created_at: new Date(Date.now() - 864000000).toISOString() },
  { id: '4', email: 'priya@email.com', full_name: 'Priya Sharma', plan: 'pro', is_admin: false, created_at: new Date(Date.now() - 1123200000).toISOString() },
  { id: '5', email: 'james@email.com', full_name: 'James Whitfield', plan: 'free', is_admin: false, created_at: new Date(Date.now() - 1296000000).toISOString() },
  { id: '6', email: 'lei@email.com', full_name: 'Lei Zhang', plan: 'pro', is_admin: false, created_at: new Date(Date.now() - 1728000000).toISOString() },
];

const GROWTH_DATA = [
  { name: 'Nov', users: 2100, pro: 480 },
  { name: 'Dec', users: 2650, pro: 620 },
  { name: 'Jan', users: 3100, pro: 780 },
  { name: 'Feb', users: 3640, pro: 940 },
  { name: 'Mar', users: 4320, pro: 1120 },
  { name: 'Apr', users: 4821, pro: 1240 },
];

const REVENUE_DATA = [
  { name: 'Nov', revenue: 9600 },
  { name: 'Dec', revenue: 12400 },
  { name: 'Jan', revenue: 15600 },
  { name: 'Feb', revenue: 18800 },
  { name: 'Mar', revenue: 22400 },
  { name: 'Apr', revenue: 24800 },
];

const PLAN_BADGE: Record<string, string> = {
  free: 'badge-gray',
  pro: 'badge-purple',
  enterprise: 'badge-gold',
};

export function Admin() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [tab, setTab] = useState<'overview' | 'users' | 'revenue'>('overview');

  useEffect(() => {
    adminApi.getStats().then(setStats).catch(() => setStats(DEMO_STATS));
    adminApi.getUsers().then(d => setUsers(d.data || [])).catch(() => setUsers(DEMO_USERS as any));
  }, []);

  const displayStats = stats || DEMO_STATS;
  const displayUsers = users.length > 0 ? users : DEMO_USERS as any[];

  async function changePlan(id: string, plan: string) {
    try { await adminApi.updateUserPlan(id, plan); }
    catch { /* demo */ }
    setUsers(prev => prev.map(u => u.id === id ? { ...u, plan: plan as any } : u));
  }

  const STAT_CARDS = [
    { label: 'Total Users', value: displayStats.total_users.toLocaleString(), icon: Users, color: 'text-gold', bg: 'bg-yellow-400/10', trend: `+${displayStats.new_users_7d} this week` },
    { label: 'Pro Subscribers', value: displayStats.pro_users.toLocaleString(), icon: Shield, color: 'text-violet-400', bg: 'bg-violet-400/10', trend: `+34 this week` },
    { label: 'Active Alerts', value: displayStats.active_alerts.toLocaleString(), icon: Bell, color: 'text-sky-400', bg: 'bg-sky-400/10', trend: 'across all users' },
    { label: 'MRR', value: `$${displayStats.mrr.toLocaleString()}`, icon: DollarSign, color: 'text-green-400', bg: 'bg-green-400/10', trend: '+12% MoM' },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center">
          <Shield size={16} className="text-white" />
        </div>
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-sub">Platform metrics, user management & subscriptions</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-bg-2 border border-border rounded-lg p-1 w-fit">
        {(['overview', 'users', 'revenue'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-1.5 rounded-md text-sm font-semibold capitalize transition-all',
              tab === t ? 'bg-bg-4 text-white' : 'text-gray-500 hover:text-gray-300')}>
            {t}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            {STAT_CARDS.map(s => (
              <div key={s.label} className="card">
                <div className="flex items-center justify-between mb-3">
                  <span className="section-label">{s.label}</span>
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', s.bg)}>
                    <s.icon size={14} className={s.color} />
                  </div>
                </div>
                <p className={cn('text-2xl font-extrabold font-mono tracking-tight', s.color)}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <ChevronUp size={11} className="text-green-400" />{s.trend}
                </p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-5 mb-5">
            <div className="card">
              <p className="section-label mb-4">User Growth (6 months)</p>
              <BarChartComp data={GROWTH_DATA} dataKey="users" color="#f5c842" height={200} />
            </div>
            <div className="card">
              <p className="section-label mb-4">Monthly Revenue</p>
              <BarChartComp data={REVENUE_DATA} dataKey="revenue" color="#4ade80" height={200} />
            </div>
          </div>

          {/* Plan distribution */}
          <div className="card">
            <p className="section-label mb-4">Plan Distribution</p>
            <div className="grid grid-cols-3 gap-4">
              {[
                { plan: 'Free', count: displayStats.total_users - displayStats.pro_users - 120, pct: Math.round(((displayStats.total_users - displayStats.pro_users - 120) / displayStats.total_users) * 100), color: 'bg-gray-600' },
                { plan: 'Pro', count: displayStats.pro_users, pct: Math.round((displayStats.pro_users / displayStats.total_users) * 100), color: 'bg-violet-500' },
                { plan: 'Enterprise', count: 120, pct: Math.round((120 / displayStats.total_users) * 100), color: 'bg-yellow-400' },
              ].map(p => (
                <div key={p.plan} className="bg-bg-3 rounded-lg p-4 text-center">
                  <p className="text-2xl font-extrabold font-mono mb-1">{p.count.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mb-2">{p.plan} users</p>
                  <div className="h-1.5 bg-bg-4 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', p.color)} style={{ width: `${p.pct}%` }} />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{p.pct}%</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Users tab */}
      {tab === 'users' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <p className="section-label">All Users ({displayStats.total_users.toLocaleString()})</p>
            <button className="btn-outline text-xs">Export CSV</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['User', 'Email', 'Plan', 'Joined', 'Actions'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-xs text-gray-600 font-semibold uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayUsers.map((u: any) => (
                  <tr key={u.id} className="border-b border-border hover:bg-bg-3 transition-all">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-purple-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {u.full_name?.[0]?.toUpperCase() || u.email[0].toUpperCase()}
                        </div>
                        <span className="text-sm font-medium">{u.full_name || '—'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-sm text-gray-400">{u.email}</td>
                    <td className="py-3 px-3">
                      <span className={PLAN_BADGE[u.plan] || 'badge-gray'}>{u.plan}</span>
                    </td>
                    <td className="py-3 px-3 text-xs text-gray-500">
                      {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
                    </td>
                    <td className="py-3 px-3">
                      <select
                        value={u.plan}
                        onChange={e => changePlan(u.id, e.target.value)}
                        className="bg-bg-4 border border-border text-gray-300 text-xs rounded px-2 py-1 cursor-pointer outline-none focus:border-gold"
                      >
                        <option value="free">Free</option>
                        <option value="pro">Pro</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Revenue tab */}
      {tab === 'revenue' && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'MRR', value: `$${displayStats.mrr.toLocaleString()}`, sub: '+12% MoM', color: 'text-green-400' },
              { label: 'ARR', value: `$${(displayStats.mrr * 12).toLocaleString()}`, sub: 'Annualised', color: 'text-gold' },
              { label: 'ARPU', value: `$${Math.round(displayStats.mrr / displayStats.pro_users).toLocaleString()}`, sub: 'Per paying user', color: 'text-violet-400' },
            ].map(s => (
              <div key={s.label} className="card text-center">
                <p className="section-label mb-2">{s.label}</p>
                <p className={cn('text-3xl font-extrabold font-mono', s.color)}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-1">{s.sub}</p>
              </div>
            ))}
          </div>
          <div className="card">
            <p className="section-label mb-4">Revenue Trend</p>
            <BarChartComp data={REVENUE_DATA} dataKey="revenue" color="#4ade80" height={240} />
          </div>
          <div className="card">
            <p className="section-label mb-4">Revenue by Plan</p>
            <BarChartComp
              data={[
                { name: 'Free', revenue: 0 },
                { name: 'Pro ($20/mo)', revenue: displayStats.pro_users * 20 },
                { name: 'Enterprise ($99/mo)', revenue: 120 * 99 },
              ]}
              dataKey="revenue" color="#a78bfa" height={200} />
          </div>
        </div>
      )}
    </div>
  );
}
