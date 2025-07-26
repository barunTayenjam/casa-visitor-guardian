import { NavLink, useLocation } from 'react-router-dom';
import { Camera, Calendar, BarChart3, Settings, LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
  exact?: boolean;
}

const tabs: Tab[] = [
  {
    id: 'cameras',
    label: 'Live',
    href: '/',
    icon: Camera,
    exact: true,
  },
  {
    id: 'events',
    label: 'Events',
    href: '/events',
    icon: Calendar,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
  },
  {
    id: 'system',
    label: 'System',
    href: '/settings',
    icon: Settings,
  },
];

export const BottomTabBar = () => {
  const location = useLocation();

  return (
    <nav className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-around px-4 py-2">
        {tabs.map((tab) => {
          const isActive = tab.exact 
            ? location.pathname === tab.href
            : location.pathname.startsWith(tab.href);

          return (
            <NavLink
              key={tab.id}
              to={tab.href}
              className={cn(
                "flex flex-col items-center gap-1 px-6 py-3 rounded-xl transition-all duration-200 min-w-[100px]",
                "hover:bg-accent/50 active:scale-95",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-lg" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative">
                <tab.icon className={cn(
                  "h-6 w-6 transition-transform",
                  isActive && "scale-110"
                )} />
                {tab.badge && tab.badge > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs flex items-center justify-center"
                  >
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </Badge>
                )}
              </div>
              <span className={cn(
                "text-xs font-medium transition-all",
                isActive ? "font-semibold" : "font-normal"
              )}>
                {tab.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};