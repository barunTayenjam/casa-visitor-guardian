import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Shield,
  Bell,
  BarChart3,
  Settings,
  LogOut,
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
import { PlayCircle } from 'lucide-react';

const navItems = [
  { href: '/app/streams', label: 'Streams', icon: Shield },
  { href: '/app/events', label: 'Events', icon: Bell },
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
      <div className="fixed bottom-3 left-0 right-0 md:left-1/2 md:right-auto md:-translate-x-1/2 z-50 px-1 md:px-0">
        {/* Dock container - scrollable on mobile */}
        <div className="flex items-end gap-1 px-2 py-2 md:px-3 md:py-2 rounded-2xl bg-background/95 backdrop-blur-xl border border-border/50 shadow-2xl overflow-x-auto max-w-full md:overflow-visible [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    to={item.href}
                    className={cn(
                      'relative flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl transition-all duration-200 flex-shrink-0',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-lg scale-110'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                  >
                    <item.icon className="h-4 w-4 md:h-5 md:w-5" />
                    {/* Active indicator dot */}
                    {isActive && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary-foreground/50" />
                    )}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="top" className="mb-2">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}

          {/* Separator - hidden on mobile */}
          <div className="hidden md:block w-px h-8 bg-border/50 mx-1 flex-shrink-0" />

          {/* Logout button */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200 flex-shrink-0"
                    aria-label="Logout"
                  >
                    <LogOut className="h-4 w-4 md:h-5 md:w-5" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" className="mb-2">
                Logout
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="center" className="w-48">
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </TooltipProvider>
  );
};
