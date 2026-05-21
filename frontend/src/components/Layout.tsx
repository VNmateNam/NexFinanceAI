import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, Briefcase, Bell, Bot, Shield,
  Zap, LogOut, Settings, Menu, X, Crown, ChevronDown, User
} from 'lucide-react';
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
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.is_admin === true;
  const isPro = user?.plan === 'pro' || user?.plan === 'enterprise';

  // Display label for plan badge
  const planLabel = isAdmin ? 'ADMIN' : (user?.plan?.toUpperCase() ?? 'FREE');
  const planBadgeClass = isAdmin
    ? 'bg-red-500/15 text-red-400 border-red-500/25'
    : isPro
      ? 'bg-violet-400/15 text-violet-400 border-violet-400/25'
      : 'bg-gray-700/60 text-gray-400 border-gray-600/40';

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

  // Close avatar dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function handleLogout() {
    setAvatarOpen(false);
    setMobileOpen(false);
    await supabase.auth.signOut();
    logout();
    navigate('/login', { replace: true });
  }

  function goSettings() {
    setAvatarOpen(false);
    navigate('/settings');
  }

  const avatarLetter = user?.full_name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U';

  // Shared nav item renderer
  const NavItem = ({ to, icon: Icon, label, proRequired, mobile = false }: {
    to: string; icon: any; label: string; proRequired?: boolean; mobile?: boolean;
  }) => (
    <NavLink to={to}
      className={({ isActive }) => cn(
        mobile
          ? 'flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all border-b border-border last:border-0'
          : 'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
        isActive
          ? mobile ? 'text-gold bg-bg-3' : 'bg-bg-4 text-gold border border-border-light'
          : mobile ? 'text-gray-400 hover:text-white hover:bg-bg-3' : 'text-gray-400 hover:bg-bg-3 hover:text-white'
      )}>
      <Icon size={15} className="flex-shrink-0" />
      <span className="flex-1">{label}</span>
      {proRequired && !isPro && !isAdmin && (
        <Crown size={10} className="text-gold/50 flex-shrink-0" />
      )}
    </NavLink>
  );

  return (
    <div className="flex h-screen flex-col bg-bg overflow-hidden">
      {/* ── Top header ── */}
      <header className="h-14 bg-bg-2 border-b border-border flex items-center justify-between px-3 sm:px-5 flex-shrink-0 z-50">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          {/* Burger — mobile / tablet */}
          <button
            onClick={() => setMobileOpen(o => !o)}
            className="lg:hidden w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white transition-colors flex-shrink-0"
            aria-label="Toggle menu">
            {mobileOpen ? <X size={19} /> : <Menu size={19} />}
          </button>

          {/* Logo */}
          <NavLink to="/dashboard" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 bg-gradient-to-br from-gold to-gold-dark rounded-lg flex items-center justify-center">
              <Zap size={13} className="text-bg" />
            </div>
            <span className="font-extrabold text-sm sm:text-base tracking-tight hidden xs:block">
              Nexus<span className="text-gold">AI</span>
            </span>
          </NavLink>

          {/* Desktop top nav */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {NAV.filter(n => n.show).map(({ to, label, proRequired }) => (
              <NavLink key={to} to={to}
                className={({ isActive }) => cn(
                  'text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5',
                  isActive ? 'bg-bg-4 text-white' : 'text-gray-400 hover:text-white hover:bg-bg-3'
                )}>
                {label}
                {proRequired && !isPro && !isAdmin && <Crown size={9} className="text-gold/50" />}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Live badge — hidden on very small screens */}
          <div className="hidden sm:flex items-center gap-1.5 bg-yellow-400/10 border border-yellow-400/20 rounded-full px-2.5 py-1">
            <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full live-dot" />
            <span className="text-yellow-400 text-[10px] font-bold font-mono">LIVE</span>
            <span className="text-yellow-400/70 text-[10px] font-mono hidden xl:inline ml-1">
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          {/* Plan badge — desktop */}
          <span className={cn('hidden sm:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border', planBadgeClass)}>
            {planLabel}
          </span>

          {/* Avatar dropdown */}
          <div className="relative" ref={avatarRef}>
            <button
              onClick={() => setAvatarOpen(o => !o)}
              className="flex items-center gap-1 pl-0.5 pr-1.5 py-0.5 rounded-full hover:bg-bg-3 transition-colors"
              aria-label="Account menu">
              <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-purple-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                {avatarLetter}
              </div>
              <ChevronDown size={12} className={cn('text-gray-500 transition-transform', avatarOpen && 'rotate-180')} />
            </button>

            {/* Dropdown */}
            {avatarOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-bg-2 border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
                {/* User info */}
                <div className="px-4 py-3 border-b border-border bg-bg-3">
                  <p className="text-xs font-semibold truncate">{user?.full_name || user?.email}</p>
                  <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
                  <span className={cn('inline-flex mt-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border', planBadgeClass)}>
                    {planLabel}
                  </span>
                </div>
                {/* Menu items */}
                <div className="py-1">
                  <button onClick={goSettings}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-bg-3 transition-colors">
                    <Settings size={13} className="text-gray-500" />
                    Settings
                  </button>
                  <div className="h-px bg-border mx-3 my-1" />
                  <button onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-400 hover:text-red-400 hover:bg-red-400/5 transition-colors">
                    <LogOut size={13} />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Mobile drawer overlay ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="absolute top-14 left-0 w-72 max-w-[85vw] h-[calc(100vh-56px)] bg-bg-2 border-r border-border overflow-y-auto flex flex-col"
            onClick={e => e.stopPropagation()}>
            {/* User card */}
            <div className="p-4 border-b border-border bg-bg-3 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-700 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {avatarLetter}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{user?.full_name || user?.email || 'User'}</p>
                  <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
                </div>
                <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0', planBadgeClass)}>
                  {planLabel}
                </span>
              </div>
            </div>

            {/* Nav items */}
            <nav className="flex-1 py-2">
              {NAV.filter(n => n.show).map(({ to, icon: Icon, label, proRequired }) => (
                <NavItem key={to} to={to} icon={Icon} label={label} proRequired={proRequired} mobile />
              ))}
              <NavLink to="/settings"
                className={({ isActive }) => cn(
                  'flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all border-b border-border',
                  isActive ? 'text-gold bg-bg-3' : 'text-gray-400 hover:text-white hover:bg-bg-3'
                )}>
                <Settings size={15} />
                Settings
              </NavLink>
            </nav>

            {/* Mobile sign out */}
            <div className="p-3 border-t border-border flex-shrink-0">
              <button onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:text-red-400 hover:bg-red-400/5 transition-all">
                <LogOut size={14} /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* ── Desktop sidebar ── */}
        <aside className="hidden lg:flex flex-col w-48 xl:w-52 bg-bg-2 border-r border-border py-3 flex-shrink-0">
          <div className="flex-1 px-2.5 space-y-0.5 overflow-y-auto">
            <p className="section-label px-2 py-2 text-[10px]">Navigation</p>
            {NAV.filter(n => n.show).map(({ to, icon, label, proRequired }) => (
              <NavItem key={to} to={to} icon={icon} label={label} proRequired={proRequired} />
            ))}
            <div className="h-px bg-border my-2 mx-1" />
            <NavLink to="/settings"
              className={({ isActive }) => cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                isActive ? 'bg-bg-4 text-gold border border-border-light' : 'text-gray-400 hover:bg-bg-3 hover:text-white'
              )}>
              <Settings size={15} />
              <span>Settings</span>
            </NavLink>
          </div>

          {/* Sidebar user card */}
          <div className="px-2.5 pt-3 border-t border-border mt-2 flex-shrink-0">
            <div className="flex items-center gap-2 px-2 py-2 rounded-lg">
              <div className="w-6 h-6 bg-gradient-to-br from-violet-500 to-purple-700 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                {avatarLetter}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate">{user?.full_name || user?.email?.split('@')[0] || 'User'}</p>
                <span className={cn('text-[8px] font-bold px-1 py-0.5 rounded border', planBadgeClass)}>
                  {planLabel}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 overflow-y-auto min-w-0">
          <div className="border-b border-border overflow-hidden bg-bg-2">
            <LiveTicker />
          </div>
          <div className="p-3 sm:p-4 lg:p-5 xl:p-6 max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

