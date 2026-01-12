import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { HealthCheck } from '@/components/HealthCheck';
import { LogViewer } from '@/components/LogViewer';
import { Bug, Play, Square, RefreshCw, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocketContext } from '@/contexts/SocketContext';
import { useCameras } from '@/contexts/CameraContext';

const Debug = () => {
  if (!import.meta.env.DEV) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Page Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">The debug page is only available in development mode.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { user, isAuthenticated, login, logout } = useAuth();
  const { connected: socketConnected } = useSocketContext();
  const { cameras, refreshCameras } = useCameras();

  const handleTestLogin = async () => {
    try {
      await login('admin', 'admin123');
    } catch (error) {
      console.error('Test login failed:', error);
    }
  };

  const handleRefresh = () => {
    refreshCameras();
    window.location.reload();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center space-x-2 mb-6">
        <Bug className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Debug Dashboard</h1>
        <Badge variant="outline">Development Only</Badge>
      </div>

      <Tabs defaultValue="health" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="health">System Health</TabsTrigger>
          <TabsTrigger value="auth">Authentication</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="actions">Test Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="health">
          <HealthCheck onRefresh={handleRefresh} />
        </TabsContent>

        <TabsContent value="auth">
          <Card>
            <CardHeader>
              <CardTitle>Authentication Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Authenticated</label>
                  <Badge variant={isAuthenticated ? 'default' : 'secondary'}>
                    {isAuthenticated ? 'Yes' : 'No'}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium">User</label>
                  <p className="text-sm">{user?.username || 'None'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Role</label>
                  <p className="text-sm">{user?.role || 'None'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <p className="text-sm">{user?.email || 'None'}</p>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <Button onClick={handleTestLogin} disabled={isAuthenticated}>
                  <Play className="h-4 w-4 mr-2" />
                  Test Login (admin)
                </Button>
                <Button onClick={logout} disabled={!isAuthenticated} variant="outline">
                  <Square className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>WebSocket Service</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Status</span>
                    <Badge variant={socketConnected ? 'default' : 'destructive'}>
                      {socketConnected ? 'Connected' : 'Disconnected'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {socketConnected 
                      ? 'Real-time updates are active' 
                      : 'No real-time connection'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Camera Service</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Cameras</span>
                    <Badge variant="outline">{cameras.length}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Online</span>
                    <Badge variant="default">
                      {cameras.filter(c => c.status === 'online').length}
                    </Badge>
                  </div>
                  <Button onClick={refreshCameras} size="sm" className="w-full">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Cameras
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="logs">
          <LogViewer />
        </TabsContent>

        <TabsContent value="logs">
          <LogViewer />
        </TabsContent>

        <TabsContent value="actions">
          <Card>
            <CardHeader>
              <CardTitle>Test Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button onClick={() => console.log('Test action 1')} variant="outline">
                  Console Log Test
                </Button>
                <Button onClick={() => alert('Alert test')} variant="outline">
                  Alert Test
                </Button>
                <Button onClick={() => navigator.clipboard.writeText('Test text')} variant="outline">
                  Copy to Clipboard
                </Button>
                <Button onClick={handleRefresh} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Environment Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Node Environment:</span> {import.meta.env.MODE}
            </div>
            <div>
              <span className="font-medium">Base URL:</span> {import.meta.env.BASE_URL}
            </div>
            <div>
              <span className="font-medium">API URL:</span> {import.meta.env.VITE_API_URL || 'Not set'}
            </div>
            <div>
              <span className="font-medium">WS URL:</span> {import.meta.env.VITE_WS_URL || 'Not set'}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Debug;