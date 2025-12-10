import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocketContext } from '@/contexts/SocketContext';
import { useCameras } from '@/contexts/CameraContext';

interface HealthCheckProps {
  onRefresh?: () => void;
}

export const HealthCheck: React.FC<HealthCheckProps> = ({ onRefresh }) => {
  const { isAuthenticated, user, isLoading: authLoading, error: authError } = useAuth();
  const { connected: socketConnected } = useSocketContext();
  const { cameras, loading: camerasLoading, error: camerasError } = useCameras();

  const checks = [
    {
      name: 'Authentication',
      status: authLoading ? 'loading' : authError ? 'error' : isAuthenticated ? 'success' : 'warning',
      details: authError ? authError : isAuthenticated ? `Logged in as ${user?.username}` : 'Not authenticated',
      icon: authError ? XCircle : isAuthenticated ? CheckCircle : AlertCircle,
    },
    {
      name: 'WebSocket Connection',
      status: socketConnected ? 'success' : 'error',
      details: socketConnected ? 'Connected to real-time updates' : 'Disconnected from WebSocket',
      icon: socketConnected ? CheckCircle : XCircle,
    },
    {
      name: 'Camera Service',
      status: camerasLoading ? 'loading' : camerasError ? 'error' : 'success',
      details: camerasError ? camerasError : `${cameras.length} cameras loaded`,
      icon: camerasError ? XCircle : CheckCircle,
    },
  ];

  const getStatusColor = (status: 'success' | 'error' | 'warning' | 'loading') => {
    switch (status) {
      case 'success': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      case 'warning': return 'bg-yellow-500';
      case 'loading': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusBadge = (status: 'success' | 'error' | 'warning' | 'loading') => {
    switch (status) {
      case 'success': return 'default';
      case 'error': return 'destructive';
      case 'warning': return 'secondary';
      case 'loading': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold">System Health Check</CardTitle>
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {checks.map((check) => {
          const Icon = check.icon;
          return (
            <div key={check.name} className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center space-x-3">
                <div className={`w-2 h-2 rounded-full ${getStatusColor(check.status)}`} />
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{check.name}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant={getStatusBadge(check.status)}>
                  {check.status}
                </Badge>
                <span className="text-sm text-muted-foreground max-w-xs truncate">
                  {check.details}
                </span>
              </div>
            </div>
          );
        })}
        
        <div className="pt-2 border-t">
          <div className="text-xs text-muted-foreground space-y-1">
            <div>• Authentication: Required for protected routes</div>
            <div>• WebSocket: Enables real-time updates</div>
            <div>• Camera Service: Manages camera connections</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default HealthCheck;