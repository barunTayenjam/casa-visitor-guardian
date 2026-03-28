import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Shield,
  Bell,
  Users,
  Eye,
  BarChart3,
  Settings,
  LogOut,
  Layers,
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
  { href: '/app/events', label: 'Events', icon: Bell },
  { href: '/app/visitors', label: 'Visitors', icon: Users },
  { href: '/app/review', label: 'Review', icon: Eye },
  { href: '/app/batch-detection', label: 'Batch', icon: Layers },
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
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
        {/* Dock container */}
        <div className="flex items-end gap-1 px-3 py-2 rounded-2xl bg-background/80 backdrop-blur-xl border border-border/50 shadow-2xl">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    to={item.href}
                    className={cn(
                      'relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-lg scale-110'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
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

          {/* Separator */}
          <div className="w-px h-8 bg-border/50 mx-1" />

          {/* Logout button */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center justify-center w-12 h-12 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
                    aria-label="Logout"
                  >
                    <LogOut className="h-5 w-5" />
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
