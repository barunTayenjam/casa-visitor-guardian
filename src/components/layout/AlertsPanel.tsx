
import { X, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/types/security';
import { useState } from 'react';

interface AlertsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AlertsPanel = ({ isOpen, onClose }: AlertsPanelProps) => {
  const [alerts] = useState<Alert[]>([
    {
      id: '1',
      type: 'motion',
      severity: 'warning',
      message: 'Motion detected at Front Door',
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      acknowledged: false,
      cameraId: 'cam1'
    },
    {
      id: '2',
      type: 'camera',
      severity: 'error',
      message: 'Camera 3 (Backyard) offline',
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      acknowledged: false,
      cameraId: 'cam3'
    },
    {
      id: '3',
      type: 'system',
      severity: 'info',
      message: 'Daily backup completed successfully',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      acknowledged: true
    }
  ]);

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (minutes < 60) {
      return `${minutes}m ago`;
    } else {
      return `${hours}h ago`;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-card border-l border-border shadow-lg z-50 animate-slide-in">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="text-lg font-semibold">Alerts & Notifications</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <ScrollArea className="flex-1 h-[calc(100vh-80px)]">
        <div className="p-4 space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-3 rounded-lg border transition-all duration-200 ${
                alert.acknowledged 
                  ? 'bg-muted/50 border-muted' 
                  : 'bg-background border-border hover:bg-muted/30'
              }`}
            >
              <div className="flex items-start gap-3">
                {getAlertIcon(alert.severity)}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${
                    alert.acknowledged ? 'text-muted-foreground' : 'text-foreground'
                  }`}>
                    {alert.message}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {alert.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(alert.timestamp)}
                    </span>
                  </div>
                </div>
                {!alert.acknowledged && (
                  <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1"></div>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
