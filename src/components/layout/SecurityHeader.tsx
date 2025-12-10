import React, { useState } from 'react';
import { Bell, User, Search, Menu, LogOut, Shield, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';

interface SecurityHeaderProps {
  onToggleSidebar: () => void;
  onToggleAlerts: () => void;
}

export const SecurityHeader = ({ onToggleSidebar, onToggleAlerts }: SecurityHeaderProps) => {
  const [alertCount] = useState(3);
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'user':
        return 'default';
      case 'viewer':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <header className="border-b border-border bg-card h-14 px-4">
      <div className="flex items-center justify-between h-full">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onToggleSidebar}
          className="h-8 w-8"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search cameras, events..." 
              className="pl-10 w-80"
            />
          </div>

          <Button 
            variant="ghost" 
            size="icon" 
            className="relative"
            onClick={onToggleAlerts}
          >
            <Bell className="h-5 w-5" />
            {alertCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
              >
                {alertCount}
              </Badge>
            )}
          </Button>
          
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 flex items-center gap-2 p-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium">{user?.username || 'User'}</p>
                    <div className="flex items-center gap-1">
                      <Badge variant={getRoleBadgeVariant(user?.role || '')} className="text-xs">
                        {user?.role || 'viewer'}
                      </Badge>
                    </div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-sm">
                  <div className="font-medium">{user?.username}</div>
                  <div className="text-muted-foreground">{user?.email}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <Shield className="h-3 w-3" />
                    <Badge variant={getRoleBadgeVariant(user?.role || '')} className="text-xs">
                      {user?.role}
                    </Badge>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
};
