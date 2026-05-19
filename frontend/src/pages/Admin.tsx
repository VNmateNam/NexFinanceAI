import { useEffect, useState } from 'react';
import { Users, TrendingUp, Bell, DollarSign, Shield, ChevronUp, RefreshCw, Crown, UserX } from 'lucide-react';
import { adminApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { BarChartComp } from '../components/Charts';
import type { AdminStats, UserProfile } from '../types';
import { cn } from '../utils/cn';
import { formatDistanceToNow } from 'date-fns';

const GROWTH_DATA = [
  { name: 'Nov', users: 2100, pro: 480 },
  { name: 'Dec', users: 2650, pro: 620 },
  { name: 'Jan', users: 3100, pro: 780 },
  { name: 'Feb', users: 3640, pro: 940 },
  { name: 'Mar', users: 4320, pro: 1120 },
  { name: 'Apr', users: 4821, pro: 1240 },
];

const PLAN_BADGE: Record<string, string> = {
  free: 'badge-gray',
  pro: 'badge-purple',
  enterprise: 'badge-gold',
};

export function Admin() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [tab, setTab] = useState<'overview' | 'users' | 'revenue'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [statsData, usersData] = await Promise.all([
        adminApi.getStats(),
        adminApi.getUsers(1),
      ]);
      setStats(statsData);
      setUsers(usersData.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message || 'Failed to load admin data');
    }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function changePlan(id: string, plan: string) {
    try {
      await adminApi.updateUserPlan(id, plan);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, plan: plan as any } : u));
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Failed to update plan');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
        <p className="text-red-400 text-sm">{error}</p>
        <button onClick={loadData} className="btn-outline text-sm flex items-center gap-2">
          <RefreshCw size={13} /> Retry
        </button>
      </div>
    );
  }

  const displayStats = stats!;
  const revenueData = [
    { name: 'MRR', revenue: displayStats.mrr },
    { name: 'ARR', revenue: displayStats.mrr * 12 },
  ];

  const STAT_CARDS = [
    { label: 'Total Users', value: displayStats.total_users.toLocaleString(), icon: Users, color: 'text-gold', bg: 'bg-yellow-400/10', trend: `+${displayStats.new_users_7d} this week` },
    { label: 'Pro Subscribers', value: displayStats.pro_users.toLocaleString(), icon: Crown, color: 'text-violet-400', bg: 'bg-violet-400/10', trend: `${Math.round(displayStats.pro_users / Math.max(displayStats.total_users, 1) * 100)}% of users` },
    { label: 'Active Alerts', value: displayStats.active_alerts.toLocaleString(), icon: Bell, color: 'text-sky-400', bg: 'bg-sky-400/10', trend: 'across all users' },
    { label: 'MRR', value: `$${displayStats.mrr.toLocaleString()}`, icon: DollarSign, color: 'text-green-400', bg: 'bg-green-400/10', trend: `ARR $${(displayStats.mrr * 12).toLocaleString()}` },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center">
            <Shield size={16} className="text-white" />
          </div>
          <div>
            <h1 className="page-title">Admin Dashboard</h1>
            <p className="page-sub">Logged in as <span className="text-gold">{user?.email}</span></p>
          </div>
        </div>
        <button onClick={loadData} className="btn-outline text-xs flex items-center gap-1.5">
          <RefreshCw size={11} /> Refresh
        </button>
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
                  <TrendingUp size={11} className="text-green-400" />{s.trend}
                </p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-5 mb-5">
            <div className="card">
              <p className="section-label mb-4">User Growth (Lifetime Trend)</p>
              <BarChartComp data={GROWTH_DATA} dataKey="users" color="#f5c842" height={200} />
            </div>
            <div className="card">
              <p className="section-label mb-4">Revenue (Live)</p>
              <BarChartComp data={revenueData} dataKey="revenue" color="#4ade80" height={200} />
            </div>
          </div>

          {/* Plan distribution */}
          <div className="card">
            <p className="section-label mb-4">Plan Distribution</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { plan: 'Free', count: Math.max(0, displayStats.total_users - displayStats.pro_users), pct: Math.max(0, Math.round(((displayStats.total_users - displayStats.pro_users) / Math.max(displayStats.total_users, 1)) * 100)), color: 'bg-gray-600' },
                { plan: 'Pro', count: displayStats.pro_users, pct: Math.round((displayStats.pro_users / Math.max(displayStats.total_users, 1)) * 100), color: 'bg-violet-500' },
                { plan: 'Enterprise', count: 0, pct: 0, color: 'bg-yellow-400' },
              ].map(p => (
                <div key={p.plan} className="bg-bg-3 rounded-lg p-4 text-center">
                  <p className="text-2xl font-extrabold font-mono mb-1">{p.count.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mb-2">{p.plan} users</p>
                  <div className="h-1.5 bg-bg-4 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', p.color)} style={{ width: `${p.pct}%` }} />
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
        <div className="card overflow-x-auto">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <p className="section-label">All Users ({displayStats.total_users.toLocaleString()} total · showing {users.length})</p>
          </div>
          {users.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <UserX size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No users found</p>
            </div>
          ) : (
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-border">
                  {['User', 'Email', 'Plan', 'Joined', 'Actions'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-xs text-gray-600 font-semibold uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id} className="border-b border-border hover:bg-bg-3 transition-all">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-purple-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {u.full_name?.[0]?.toUpperCase() || u.email[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-medium block truncate max-w-[120px]">{u.full_name || '—'}</span>
                          {u.is_admin && <span className="text-[9px] text-red-400 font-bold">ADMIN</span>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-sm text-gray-400 max-w-[160px] truncate">{u.email}</td>
                    <td className="py-3 px-3">
                      <span className={PLAN_BADGE[u.plan] || 'badge-gray'}>{u.plan}</span>
                    </td>
                    <td className="py-3 px-3 text-xs text-gray-500 whitespace-nowrap">
                      {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
                    </td>
                    <td className="py-3 px-3">
                      {u.is_admin ? (
                        <span className="text-xs text-gray-600 italic">admin</span>
                      ) : (
                        <select
                          value={u.plan}
                          onChange={e => changePlan(u.id, e.target.value)}
                          className="bg-bg-4 border border-border text-gray-300 text-xs rounded px-2 py-1 cursor-pointer outline-none focus:border-gold"
                        >
                          <option value="free">Free</option>
                          <option value="pro">Pro</option>
                          <option value="enterprise">Enterprise</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Revenue tab */}
      {tab === 'revenue' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: 'MRR', value: `$${displayStats.mrr.toLocaleString()}`, sub: `${displayStats.pro_users} pro users × $20`, color: 'text-green-400' },
              { label: 'ARR', value: `$${(displayStats.mrr * 12).toLocaleString()}`, sub: 'Annualised', color: 'text-gold' },
              { label: 'ARPU', value: displayStats.pro_users > 0 ? `$${Math.round(displayStats.mrr / displayStats.pro_users)}` : '$0', sub: 'Per paying user', color: 'text-violet-400' },
            ].map(s => (
              <div key={s.label} className="card text-center">
                <p className="section-label mb-2">{s.label}</p>
                <p className={cn('text-3xl font-extrabold font-mono', s.color)}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-1">{s.sub}</p>
              </div>
            ))}
          </div>
          <div className="card">
            <p className="section-label mb-4">Revenue Snapshot</p>
            <BarChartComp data={[
              { name: 'Free', revenue: 0 },
              { name: 'Pro ($20/mo)', revenue: displayStats.pro_users * 20 },
            ]} dataKey="revenue" color="#4ade80" height={220} />
          </div>
          <div className="card p-4 bg-bg-3 border border-border rounded-lg">
            <p className="text-xs text-gray-500 mb-1">💡 Revenue tracked from Stripe sandbox. Real-time MRR = pro subscribers × $20/mo.</p>
          </div>
        </div>
      )}
    </div>
  );
}
