
import { Shield, Camera, Activity, Calendar, Settings, Users, BarChart3 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';

const menuItems = [
  {
    title: 'Dashboard',
    url: '/',
    icon: BarChart3,
  },
  {
    title: 'Live Cameras',
    url: '/cameras',
    icon: Camera,
  },
  {
    title: 'Motion Events',
    url: '/events',
    icon: Activity,
  },
  {
    title: 'Visitor History',
    url: '/history',
    icon: Calendar,
  },
  {
    title: 'Settings',
    url: '/settings',
    icon: Settings,
  },
];

export const SecuritySidebar = () => {
  const location = useLocation();

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-4 py-6">
          <div className="bg-primary rounded-lg p-2">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-sidebar-foreground">
              HomeSecure
            </h2>
            <p className="text-sm text-sidebar-foreground/60">
              Security System
            </p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location.pathname === item.url}
                    className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                  >
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-sidebar-foreground/60">
            <div className="status-indicator online"></div>
            <span>System Online</span>
          </div>
          <p className="text-xs text-sidebar-foreground/40 mt-1">
            Uptime: 7d 14h 23m
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};
