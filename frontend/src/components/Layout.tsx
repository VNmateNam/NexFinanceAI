import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, TrendingUp, Briefcase, Bell, Bot, Shield, Zap, LogOut, Settings, Menu, X, Crown } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../services/supabase';
import { LiveTicker } from './LiveTicker';
import { cn } from '../utils/cn';

export function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [now, setNow] = useState(() => new Date());
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = user?.is_admin === true;
  const isPro = user?.plan === 'pro' || user?.plan === 'enterprise';

  const NAV = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', show: true },
    { to: '/markets', icon: TrendingUp, label: 'Markets', show: true },
    { to: '/portfolio', icon: Briefcase, label: 'Portfolio', show: true },
    { to: '/alerts', icon: Bell, label: 'Alerts', show: true, proRequired: true },
    { to: '/ai', icon: Bot, label: 'AI Assistant', show: true, proRequired: true },
    { to: '/admin', icon: Shield, label: 'Admin', show: isAdmin },
  ];

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  async function handleLogout() {
    await supabase.auth.signOut();
    logout();
    navigate('/login', { replace: true });
  }

  const NavItems = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {NAV.filter(n => n.show).map(({ to, icon: Icon, label, proRequired }) => (
        <NavLink key={to} to={to}
          className={({ isActive }) => cn(
            mobile
              ? 'flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all border-b border-border last:border-0'
              : 'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
            isActive
              ? mobile ? 'text-gold bg-bg-3' : 'bg-bg-4 text-gold border border-border-light'
              : mobile ? 'text-gray-400 hover:text-white hover:bg-bg-3' : 'text-gray-400 hover:bg-bg-3 hover:text-white'
          )}>
          <Icon size={16} className="flex-shrink-0" />
          <span className="flex-1">{label}</span>
          {proRequired && !isPro && (
            <Crown size={11} className="text-gold/60 flex-shrink-0" />
          )}
        </NavLink>
      ))}
    </>
  );

  return (
    <div className="flex h-screen flex-col bg-bg overflow-hidden">
      {/* Top header */}
      <header className="h-14 bg-bg-2 border-b border-border flex items-center justify-between px-4 sm:px-6 flex-shrink-0 z-50">
        <div className="flex items-center gap-3 sm:gap-6">
          {/* Burger — mobile only */}
          <button
            onClick={() => setMobileOpen(o => !o)}
            className="lg:hidden w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            aria-label="Toggle menu">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <NavLink to="/dashboard" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-7 h-7 bg-gradient-to-br from-gold to-gold-dark rounded-lg flex items-center justify-center">
              <Zap size={14} className="text-bg" />
            </div>
            <span className="font-extrabold text-base tracking-tight hidden sm:block">
              Nexus<span className="text-gold">AI</span>
            </span>
          </NavLink>

          {/* Desktop top nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV.filter(n => n.show).map(({ to, label, proRequired }) => (
              <NavLink key={to} to={to}
                className={({ isActive }) => cn(
                  'text-sm font-medium px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5',
                  isActive ? 'bg-bg-4 text-white' : 'text-gray-400 hover:text-white hover:bg-bg-3'
                )}>
                {label}
                {proRequired && !isPro && <Crown size={10} className="text-gold/60" />}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex items-center gap-1.5 bg-yellow-400/10 border border-yellow-400/20 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full live-dot" />
            <span className="text-yellow-400 text-xs font-bold font-mono">LIVE</span>
            <span className="text-yellow-400/70 text-xs font-mono hidden xl:inline ml-1">
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          {/* Settings */}
          <NavLink to="/settings"
            className={({ isActive }) => cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
              isActive ? 'bg-bg-4 text-gold' : 'text-gray-500 hover:text-white hover:bg-bg-3'
            )}>
            <Settings size={15} />
          </NavLink>

          {/* Avatar / logout */}
          <button onClick={handleLogout} title={`Sign out (${user?.email ?? ''})`}
            className="group w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-700 rounded-full flex items-center justify-center text-xs font-bold hover:opacity-80 transition-opacity flex-shrink-0">
            <span className="group-hover:hidden">
              {user?.full_name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U'}
            </span>
            <LogOut size={12} className="hidden group-hover:block" />
          </button>
        </div>
      </header>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="absolute top-14 left-0 w-72 max-w-[85vw] h-[calc(100vh-56px)] bg-bg-2 border-r border-border overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-700 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {user?.full_name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{user?.full_name ?? user?.email ?? 'User'}</p>
                  <p className="text-[10px] text-gray-500 capitalize">{user?.plan ?? 'free'} plan
                    {isPro && <span className="ml-1 text-violet-400">●</span>}
                  </p>
                </div>
              </div>
            </div>
            <nav className="py-2">
              <NavItems mobile />
              <NavLink to="/settings"
                className={({ isActive }) => cn(
                  'flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all border-b border-border',
                  isActive ? 'text-gold bg-bg-3' : 'text-gray-400 hover:text-white hover:bg-bg-3'
                )}>
                <Settings size={16} />
                Settings
              </NavLink>
            </nav>
            <div className="p-4 border-t border-border">
              <button onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-red-400 hover:bg-red-400/5 transition-all">
                <LogOut size={14} /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-52 bg-bg-2 border-r border-border py-4 flex-shrink-0">
          <div className="flex-1 px-3 space-y-0.5">
            <p className="section-label px-2 py-2">Navigation</p>
            <NavItems />
            <NavLink to="/settings"
              className={({ isActive }) => cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                isActive ? 'bg-bg-4 text-gold border border-border-light' : 'text-gray-400 hover:bg-bg-3 hover:text-white'
              )}>
              <Settings size={16} />
              <span className="flex-1">Settings</span>
            </NavLink>
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

        <main className="flex-1 overflow-y-auto min-w-0">
          <div className="border-b border-border overflow-hidden bg-bg-2">
            <LiveTicker />
          </div>
          <div className="p-4 sm:p-5 lg:p-6 max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
