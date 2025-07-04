
import { X, AlertTriangle, Info, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/types/security';
import { useState, useEffect, useCallback } from 'react';
import apiService, { ApiError } from '@/services/ApiService';
import { useToast } from '@/hooks/use-toast';

interface AlertsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AlertsPanel = ({ isOpen, onClose }: AlertsPanelProps) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiService.getAlerts();
      setAlerts(response);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('An unknown error occurred while fetching alerts.');
      }
      setAlerts([]); // Clear alerts on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchAlerts();
      const interval = setInterval(fetchAlerts, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [isOpen, fetchAlerts]);

  const handleAcknowledge = async (id: string) => {
    try {
      await apiService.acknowledgeAlert(id);
      setAlerts(prevAlerts =>
        prevAlerts.map(alert => (alert.id === id ? { ...alert, acknowledged: true } : alert))
      );
      toast({
        title: "Alert Acknowledged",
        description: "The alert has been marked as acknowledged.",
      });
    } catch (err) {
      console.error(`Failed to acknowledge alert ${id}:`, err);
      toast({
        title: "Error",
        description: `Failed to acknowledge alert: ${err instanceof Error ? err.message : String(err)}`,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiService.deleteAlert(id);
      setAlerts(prevAlerts => prevAlerts.filter(alert => alert.id !== id));
      toast({
        title: "Alert Deleted",
        description: "The alert has been permanently removed.",
      });
    } catch (err) {
      console.error(`Failed to delete alert ${id}:`, err);
      toast({
        title: "Error",
        description: `Failed to delete alert: ${err instanceof Error ? err.message : String(err)}`,
        variant: "destructive",
      });
    }
  };

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
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ago`;
    } else if (hours > 0) {
      return `${hours}h ago`;
    } else if (minutes > 0) {
      return `${minutes}m ago`;
    } else {
      return `just now`;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-card border-l border-border shadow-lg z-50 transition-transform duration-300 ease-out">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="text-lg font-semibold">Alerts & Notifications</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <ScrollArea className="flex-1 h-[calc(100vh-80px)]">
        <div className="p-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              Loading alerts...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-32 text-destructive">
              <AlertCircle className="h-5 w-5 mr-2" /> {error}
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              No new alerts.
            </div>
          ) : (
            alerts.map((alert) => (
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
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    {!alert.acknowledged && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-green-500 hover:bg-green-500/20"
                        onClick={() => handleAcknowledge(alert.id)}
                        title="Acknowledge Alert"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-500 hover:bg-red-500/20"
                      onClick={() => handleDelete(alert.id)}
                      title="Delete Alert"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
