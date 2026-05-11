import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, TrendingUp, Briefcase, Bell, Bot, Shield, Zap, LogOut } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../services/supabase';
import { LiveTicker } from './LiveTicker';
import { cn } from '../utils/cn';

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/markets', icon: TrendingUp, label: 'Markets' },
  { to: '/portfolio', icon: Briefcase, label: 'Portfolio' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
  { to: '/ai', icon: Bot, label: 'AI Assistant' },
  { to: '/admin', icon: Shield, label: 'Admin' },
];

export function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-screen flex-col bg-bg overflow-hidden">
      <header className="h-14 bg-bg-2 border-b border-border flex items-center justify-between px-6 flex-shrink-0 z-50">
        <div className="flex items-center gap-6">
          <NavLink to="/dashboard" className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gradient-to-br from-gold to-gold-dark rounded-lg flex items-center justify-center">
              <Zap size={14} className="text-bg" />
            </div>
            <span className="font-extrabold text-base tracking-tight">
              Nexus<span className="text-gold">AI</span>
            </span>
          </NavLink>
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map(({ to, label }) => (
              <NavLink key={to} to={to}
                className={({ isActive }) => cn(
                  'text-sm font-medium px-3 py-1.5 rounded-lg transition-all',
                  isActive ? 'bg-bg-4 text-white' : 'text-gray-400 hover:text-white hover:bg-bg-3'
                )}>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-yellow-400/10 border border-yellow-400/20 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full live-dot" />
            <span className="text-yellow-400 text-xs font-bold font-mono">LIVE</span>
            <span className="text-yellow-400/70 text-xs font-mono hidden lg:inline ml-1">
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          <button onClick={handleLogout} title={`Sign out (${user?.email ?? ''})`}
            className="group w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-700 rounded-full flex items-center justify-center text-xs font-bold hover:opacity-80 transition-opacity">
            <span className="group-hover:hidden">
              {user?.full_name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U'}
            </span>
            <LogOut size={12} className="hidden group-hover:block" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="hidden lg:flex flex-col w-52 bg-bg-2 border-r border-border py-4 flex-shrink-0">
          <div className="flex-1 px-3 space-y-0.5">
            <p className="section-label px-2 py-2">Navigation</p>
            {NAV.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to}
                className={({ isActive }) => cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  isActive ? 'bg-bg-4 text-gold border border-border-light' : 'text-gray-400 hover:bg-bg-3 hover:text-white'
                )}>
                <Icon size={16} />
                <span className="flex-1">{label}</span>
              </NavLink>
            ))}
          </div>
          <div className="px-3 pt-4 border-t border-border mt-2">
            <div className="flex items-center gap-2.5 px-2 py-2">
              <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-purple-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                {user?.full_name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{user?.full_name ?? user?.email ?? 'User'}</p>
                <p className="text-[10px] text-gray-500 capitalize">{user?.plan ?? 'free'} plan</p>
              </div>
            </div>
            <button onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-red-400 hover:bg-red-400/5 transition-all mt-1">
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto">
          <div className="border-b border-border overflow-hidden bg-bg-2">
            <LiveTicker />
          </div>
          <div className="p-5 lg:p-6 max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
