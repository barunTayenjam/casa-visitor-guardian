import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Settings, LogOut, Film, Users, Crosshair, MessageSquare, Radio } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useSocketContext } from '@/contexts/SocketContext';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/app/streams', label: 'Live', icon: Radio },
  { href: '/app/events', label: 'Timeline', icon: Bell },
  { href: '/app/timelapse', label: 'Timelapse', icon: Film },
  { href: '/app/people', label: 'People', icon: Users },
  { href: '/app/detections', label: 'Detections', icon: Crosshair },
  { href: '/app/ask', label: 'Ask', icon: MessageSquare },
  { href: '/app/settings', label: 'Settings', icon: Settings },
];

export const MacDock: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { connected } = useSocketContext();

  const [currentTime, setCurrentTime] = useState(() =>
    new Date().toLocaleTimeString('en-US', { hour12: false }),
  );

  const tick = useCallback(() => {
    setCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
  }, []);

  useEffect(() => {
    let id = setInterval(tick, 1000);

    const onVisible = () => {
      if (!document.hidden) {
        if (id) clearInterval(id);
        id = setInterval(tick, 1000);
      }
    };

    document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (id) clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [tick]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Keyboard shortcuts for power users
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'd' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      navigate('/app/detections');
    }
    if (e.key === 's' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
      e.preventDefault();
      navigate('/app/settings');
    }
    if (e.key === 'e' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      navigate('/app/events');
    }
  }, [navigate]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="fixed bottom-0 left-0 right-0 z-[40]">
        {/* Apple-style dock: translucent material with crisp top edge */}
        <div className="material-dock">
          <div className="max-w-screen-2xl mx-auto px-4">
            <div className="flex items-center justify-between h-12">
              {/* Left: System status with tactile feedback */}
              <div className="flex items-center gap-3">
                <button
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all active:scale-[0.97]',
                    connected ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400',
                  )}
                  aria-label={connected ? 'System online' : 'System offline'}
                  title={connected ? 'System online' : 'System offline'}
                >
                  <div className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    connected ? 'bg-green-400 animate-pulse' : 'bg-red-400',
                  )} />
                  <span className="text-xs uppercase tracking-wider font-medium">
                    {connected ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </button>
              </div>

              {/* Center: Navigation - text labels always visible on desktop */}
              <nav className="flex items-center gap-0.5">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>
                        <Link
                          to={item.href}
                          className={cn(
                            'relative flex items-center gap-2.5 px-3 py-1.5 rounded-full transition-all duration-150 active:scale-[0.97] whitespace-nowrap',
                            isActive
                              ? 'bg-white/[0.12] text-foreground'
                              : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]',
                          )}
                        >
                          <item.icon className="w-3.5 h-3.5" />
                          <span className={cn('text-xs font-medium', 'sm:inline')}>{item.label}</span>
                          {isActive && (
                            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-primary rounded-full" />
                          )}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="mb-2 rounded-md bg-card border border-white/[0.10] text-xs px-3 py-1.5 shadow-lg"
                      >
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}

                <div className="w-px h-5 bg-white/[0.15] mx-1" />

                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-150 active:scale-[0.97]"
                          aria-label="Logout"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">Logout</span>
                        </button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="mb-2 rounded-md bg-card border border-white/[0.10] text-xs px-3 py-1.5"
                    >
                      Logout
                    </TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent
                    align="end"
                    className="w-48 mt-2 rounded-lg bg-card border border-white/[0.10] p-1 shadow-lg"
                  >
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="rounded-md text-sm py-2 hover:bg-white/[0.06] cursor-pointer"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </nav>

              {/* Right: Time display */}
              <div className="text-xs text-muted-foreground tabular-nums font-mono">
                {currentTime}
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
