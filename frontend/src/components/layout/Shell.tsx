import React, { useEffect, useState, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Radio,
  Bell,
  Shield,
  BarChart3,
  MessageSquare,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/stores/auth';
import { useSocketStore } from '@/stores/socket';
import { useCameraStore } from '@/stores/camera';
import { useUIStore } from '@/stores/ui';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: Radio, matchPrefixes: ['/app/streams'] },
  { href: '/events', label: 'Events', icon: Bell, matchPrefixes: ['/app/events'] },
  { href: '/security', label: 'Security', icon: Shield, matchPrefixes: ['/app/people'] },
  { href: '/analytics', label: 'Analytics', icon: BarChart3, matchPrefixes: ['/app/insights', '/app/timelapse'] },
  { href: '/ask', label: 'Assistant', icon: MessageSquare, matchPrefixes: ['/app/ask'] },
];

const settingsItem = { href: '/settings', label: 'Settings', icon: Settings, matchPrefixes: ['/app/settings', '/app/logs'] };

function SystemStatusPill() {
  const connected = useSocketStore((s) => s.connected);
  return (
    <div className={cn(
      'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] uppercase tracking-[0.1em] font-medium',
      connected
        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
        : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20',
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full', connected ? 'bg-emerald-400' : 'bg-zinc-400')} />
      {connected ? 'Online' : 'Offline'}
    </div>
  );
}

function Clock() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString('en-US', { hour12: false }),
  );
  useEffect(() => {
    const id = setInterval(
      () => setTime(new Date().toLocaleTimeString('en-US', { hour12: false })),
      1000,
    );
    return () => clearInterval(id);
  }, []);
  return (
    <span className="text-xs text-zinc-500 font-mono tabular-nums tracking-tight select-none">
      {time}
    </span>
  );
}

function isActive(pathname: string, item: { href: string; matchPrefixes?: string[] }) {
  if (item.href === '/') return pathname === '/' || pathname === '/app/streams';
  if (pathname.startsWith(item.href)) return true;
  return item.matchPrefixes?.some((p) => pathname.startsWith(p)) ?? false;
}

interface ShellProps {
  children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const fetchCameras = useCameraStore((s) => s.fetchCameras);
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleCollapsed = useUIStore((s) => s.toggleSidebarCollapsed);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetchCameras();
  }, [fetchCameras]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login');
  }, [logout, navigate]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  if (location.pathname === '/login') return <>{children}</>;

  return (
    <div className="flex h-dvh bg-[#050505]">
      <aside
        className={cn(
          'hidden lg:flex flex-col flex-shrink-0 border-r border-white/[0.06] transition-all duration-200 ease-out',
          collapsed ? 'w-[64px]' : 'w-[220px]',
        )}
      >
        <div className="flex-1 flex flex-col overflow-hidden py-3">
          <div className={cn('px-3 mb-4 flex items-center gap-2', collapsed && 'justify-center')}>
            {!collapsed && (
              <span className="text-sm font-semibold tracking-tight text-white/90 truncate">
                SentryVision
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              {!collapsed && <SystemStatusPill />}
              {collapsed && <SystemStatusPill />}
            </div>
          </div>

          <nav className="flex-1 flex flex-col gap-0.5 px-2">
            {navItems.map((item) => {
              const active = isActive(location.pathname, item);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md transition-colors duration-100 group relative',
                    collapsed ? 'h-10 w-10 justify-center mx-auto' : 'h-9 px-2.5',
                    active
                      ? 'bg-white/[0.08] text-white'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]',
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className="h-[16px] w-[16px] flex-shrink-0" strokeWidth={1.5} />
                  {!collapsed && (
                    <span className="text-[13px] font-medium truncate">{item.label}</span>
                  )}
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-[#5E6AD2] rounded-r-full" />
                  )}
                </Link>
              );
            })}
            <div className="my-2 border-t border-white/[0.06] mx-2" />
            <Link
              to={settingsItem.href}
              className={cn(
                'flex items-center gap-2.5 rounded-md transition-colors duration-100',
                collapsed ? 'h-10 w-10 justify-center mx-auto' : 'h-9 px-2.5',
                isActive(location.pathname, settingsItem)
                  ? 'bg-white/[0.08] text-white'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]',
              )}
              title={collapsed ? settingsItem.label : undefined}
            >
              <Settings className="h-[16px] w-[16px] flex-shrink-0" strokeWidth={1.5} />
              {!collapsed && <span className="text-[13px] font-medium">Settings</span>}
            </Link>
          </nav>

          <div className="px-2 mt-auto flex flex-col gap-1">
            {!collapsed && user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2.5 h-9 px-2.5 rounded-md hover:bg-white/[0.04] transition-colors text-left w-full">
                    <div className="w-6 h-6 rounded-full bg-[#5E6AD2]/20 text-[#5E6AD2] flex items-center justify-center text-[11px] font-bold uppercase flex-shrink-0">
                      {user.username[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-white/90 truncate">{user.username}</div>
                      <div className="text-[11px] text-zinc-500 capitalize">{user.role}</div>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-48 bg-[#121215] border-white/[0.10]">
                  <DropdownMenuItem onClick={handleLogout} className="text-zinc-400 focus:text-white focus:bg-white/[0.06]">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <button
              onClick={toggleCollapsed}
              className={cn(
                'flex items-center justify-center h-8 w-8 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors mx-auto',
              )}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
              ) : (
                <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
              )}
            </button>
          </div>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute left-0 top-0 bottom-0 w-64 bg-[#0A0A0B] border-r border-white/[0.06] flex flex-col py-4 z-50"
          >
            <div className="px-4 mb-6 flex items-center justify-between">
              <span className="text-sm font-semibold tracking-tight text-white/90">SentryVision</span>
              <SystemStatusPill />
            </div>
            <nav className="flex-1 flex flex-col gap-0.5 px-2">
              {[...navItems, settingsItem].map((item) => {
                const active = isActive(location.pathname, item);
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex min-h-11 items-center gap-3 rounded-md px-3 transition-colors',
                      active
                        ? 'bg-white/[0.08] text-white'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]',
                    )}
                  >
                    <item.icon className="h-4 w-4" strokeWidth={1.5} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 h-10 px-5 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-sm">Sign out</span>
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 min-h-0 overflow-hidden">
          {children}
        </main>

        {/* Bottom Dock (always visible, matches spec nav bar) */}
        <nav className="flex-shrink-0 h-14 border-t border-white/[0.06] bg-[#0A0A0B]/80 backdrop-blur-xl flex items-center justify-between px-2 lg:px-4 gap-1">
          <button
            className="flex h-11 w-11 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200 lg:hidden"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          <div className="flex items-center gap-0.5 flex-1 justify-center">
            {navItems.map((item) => {
              const active = isActive(location.pathname, item);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                      'flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md px-3 py-1.5 transition-colors min-w-[52px]',
                    active
                      ? 'text-[#5E6AD2]'
                      : 'text-zinc-500 hover:text-zinc-300',
                  )}
                >
                  <item.icon className="h-4 w-4" strokeWidth={active ? 2 : 1.5} />
                  <span className={cn('text-[10px] font-medium', active && 'text-[#5E6AD2]')}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={settingsItem.href}
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-md transition-colors',
                isActive(location.pathname, settingsItem)
                  ? 'text-[#5E6AD2] bg-[#5E6AD2]/10'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]',
              )}
            >
              <Settings className="h-4 w-4" strokeWidth={1.5} />
            </Link>
            <Clock />
          </div>
        </nav>
      </div>
    </div>
  );
};
