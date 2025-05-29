import { Bell, User, Search, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';

interface SecurityHeaderProps {
  onToggleSidebar: () => void;
  onToggleAlerts: () => void;
}

export const SecurityHeader = ({ onToggleSidebar, onToggleAlerts }: SecurityHeaderProps) => {
  const [alertCount] = useState(3);

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
            <Avatar className="h-8 w-8">
              <AvatarImage src="/placeholder-avatar.jpg" />
              <AvatarFallback>
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:block">
              <p className="text-sm font-medium">Admin User</p>
              <p className="text-xs text-muted-foreground">Administrator</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
