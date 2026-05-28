import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Shield,
  Bell,
  BarChart3,
  Settings,
  LogOut,
  PlayCircle,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/app/streams', label: 'Streams', icon: Shield },
  { href: '/app/events', label: 'Timeline', icon: Bell },
  { href: '/app/highlights', label: 'Day View', icon: PlayCircle },
  { href: '/app/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/app/settings', label: 'Settings', icon: Settings },
];

export const MacDock: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[40]">
        {/* Outer shell (Doppelrand) */}
        <div className="p-[1px] rounded-[2rem] bg-white/[0.08]">
          {/* Inner core */}
          <div className="flex items-end gap-0.5 px-2 py-2 md:px-3 md:py-2 rounded-[calc(2rem-1px)] bg-black/70 backdrop-blur-3xl border border-white/[0.12] shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] overflow-x-auto max-w-full md:overflow-visible [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {navItems.map((item, index) => {
              const isActive = location.pathname === item.href;
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      to={item.href}
                      className={cn(
                        'relative flex items-center justify-center w-10 h-10 md:w-11 md:h-11 rounded-xl transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] flex-shrink-0 group',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-[0_4px_16px_rgba(59,130,246,0.25)] scale-110'
                          : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]'
                      )}
                      style={{
                        animation: `fade-in-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${index * 60}ms both`,
                      }}
                    >
                      <item.icon className="h-4 w-4 md:h-[18px] md:w-[18px]" />
                      {isActive && (
                        <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary-foreground/60" />
                      )}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="mb-2 rounded-full bg-white/[0.06] backdrop-blur-3xl border border-white/[0.14] text-xs px-3 py-1.5">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}

            <div className="hidden md:block w-px h-7 bg-white/[0.06] mx-1.5 flex-shrink-0" />

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex items-center justify-center w-10 h-10 md:w-11 md:h-11 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/[0.08] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] flex-shrink-0"
                      aria-label="Logout"
                    >
                      <LogOut className="h-4 w-4 md:h-[18px] md:w-[18px]" />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" className="mb-2 rounded-full bg-white/[0.06] backdrop-blur-3xl border border-white/[0.14] text-xs px-3 py-1.5">
                  Logout
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="center" className="w-48 mt-2 rounded-[1.25rem] bg-black/80 backdrop-blur-3xl border border-white/[0.14] p-1">
                <DropdownMenuItem onClick={handleLogout} className="rounded-[0.75rem] text-sm py-2.5 hover:bg-white/[0.06] cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
