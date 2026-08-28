import React from 'react';
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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="fixed bottom-0 left-0 right-0 z-[40]">
        {/* SOC-style bottom bar */}
        <div className="bg-background/95 backdrop-blur-xl border-t border-white/[0.10]">
          <div className="max-w-screen-2xl mx-auto px-4">
            <div className="flex items-center justify-between h-12">
              {/* Left: System status */}
              <div className="flex items-center gap-3">
                <div className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded',
                  connected ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400',
                )}>
                  <div className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    connected ? 'bg-green-400 animate-pulse' : 'bg-red-400',
                  )} />
                  <span className="text-[9px] uppercase tracking-wider font-medium">
                    {connected ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
              </div>

              {/* Center: Navigation */}
              <nav className="flex items-center gap-1">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>
                        <Link
                          to={item.href}
                          className={cn(
                            'relative flex items-center gap-2 px-3 py-1.5 rounded-md transition-all duration-200',
                            isActive
                              ? 'bg-white/[0.08] text-foreground'
                              : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]',
                          )}
                        >
                          <item.icon className="w-3.5 h-3.5" />
                          <span className="text-[11px] font-medium hidden sm:inline">
                            {item.label}
                          </span>
                          {isActive && (
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-primary rounded-full" />
                          )}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="mb-2 rounded-md bg-card border border-white/[0.10] text-xs px-3 py-1.5"
                      >
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}

                <div className="w-px h-5 bg-white/[0.12] mx-2" />

                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
                          aria-label="Logout"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span className="text-[11px] font-medium hidden sm:inline">Logout</span>
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
                    className="w-48 mt-2 rounded-lg bg-card border border-white/[0.10] p-1"
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

              {/* Right: Time */}
              <div className="text-[10px] text-muted-foreground tabular-nums font-mono">
                {new Date().toLocaleTimeString('en-US', { hour12: false })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
