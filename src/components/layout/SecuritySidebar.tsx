
import { Home, Camera, Bell, History, Settings, MonitorCog } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useSidebar } from '@/components/ui/sidebar';

export const SecuritySidebar = () => {
  const { state } = useSidebar();
  // We use state === "collapsed" instead of collapsed property
  const collapsed = state === "collapsed";
  
  const links = [
    {
      title: 'Dashboard',
      href: '/',
      icon: Home,
    },
    {
      title: 'Cameras',
      href: '/cameras',
      icon: Camera,
    },
    {
      title: 'Camera Config',
      href: '/camera-config',
      icon: MonitorCog,
    },
    {
      title: 'Events',
      href: '/events',
      icon: Bell,
    },
    {
      title: 'History',
      href: '/history',
      icon: History,
    },
    {
      title: 'Settings',
      href: '/settings',
      icon: Settings,
    },
  ];

  return (
    <div className="h-screen border-r bg-background flex-shrink-0 w-[250px] data-[collapsed=true]:w-[80px] transition-all duration-300" data-collapsed={collapsed}>
      <div className="py-4 flex h-16 items-center justify-center">
        {collapsed ? (
          <div className="flex w-full items-center justify-center">
            <Camera className="h-6 w-6" />
          </div>
        ) : (
          <div className="flex w-full items-center justify-center">
            <Camera className="h-6 w-6 mr-2" />
            <span className="text-xl font-semibold">Security</span>
          </div>
        )}
      </div>
      <div className="py-2">
        <nav className="grid items-start px-2 gap-2">
          {links.map((link, index) => (
            <NavLink
              key={index}
              to={link.href}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:bg-accent ${
                  isActive ? "bg-accent" : ""
                } ${collapsed ? "justify-center" : ""}`
              }
              end={link.href === '/'}
            >
              <link.icon className="h-[1.2rem] w-[1.2rem]" />
              {!collapsed && <span>{link.title}</span>}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
};
