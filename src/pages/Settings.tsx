import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  RefreshCw,
  Download,
  Trash2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import apiService, { ApiError } from '@/services/ApiService';
import { SystemSettings } from '@/types/security';

// Interfaces for system data
interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source?: string;
}

const Settings = () => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    general: {
      systemName: '',
      timezone: '',
      language: '',
      theme: '',
      autoBackup: false,
      backupFrequency: '',
    },
    storage: {
      retentionDays: 0,
      maxStorageGB: 0,
      autoCleanup: false,
      compressionEnabled: false,
      compressionQuality: 0,
    },
    notifications: {
      emailEnabled: false,
      emailAddress: '',
      pushEnabled: false,
      pushSoundEnabled: false,
      quietHoursEnabled: false,
      quietHoursStart: '',
      quietHoursEnd: '',
    },
  });

  // Logging and diagnostics state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [autoRefreshLogs, setAutoRefreshLogs] = useState(false);
  const [logLevel, setLogLevel] = useState<'all' | 'info' | 'warn' | 'error' | 'debug'>('all');

  const loadSettings = useCallback(async () => {
    setIsLoadingSettings(true);
    setSettingsError(null);
    try {
      const fetchedSettings = await apiService.getSystemSettings();
      setSystemSettings(fetchedSettings);
    } catch (err) {
      console.error('Failed to load settings:', err);
      setSettingsError(`Failed to load settings: ${err instanceof ApiError ? err.message : String(err)}`);
    } finally {
      setIsLoadingSettings(false);
    }
  }, []);

  // Load logs
  const loadLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const logs = await apiService.getSystemLogs(logLevel === 'all' ? undefined : logLevel, 50);
      setLogs(logs);
    } catch (error) {
      console.error('Failed to load logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load system logs',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingLogs(false);
    }
  }, [logLevel, toast]);

  // Clear logs
  const clearLogs = async () => {
    try {
      await apiService.clearSystemLogs();
      setLogs([]);
      toast({
        title: 'Logs cleared',
        description: 'All system logs have been cleared.',
      });
    } catch (error) {
      console.error('Failed to clear logs:', error);
      // Still clear local logs even if API fails
      setLogs([]);
      toast({
        title: 'Warning',
        description: 'Local logs cleared, but backend clear may have failed',
        variant: 'destructive',
      });
    }
  };

  // Download logs
  const downloadLogs = () => {
    const logText = logs.map(log => 
      `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.source || 'SYSTEM'}] ${log.message}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Logs downloaded',
      description: 'System logs have been downloaded successfully.',
    });
  };

  // Filter logs based on level
  const filteredLogs = logs.filter(log => 
    logLevel === 'all' || log.level === logLevel
  );


  // Get log level badge color
  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'destructive';
      case 'warn':
        return 'secondary';
      case 'info':
        return 'default';
      case 'debug':
        return 'outline';
      default:
        return 'default';
    }
  };

  // Load data on component mount
  useEffect(() => {
    loadSettings();
    loadLogs();
  }, [loadSettings, loadLogs]);

  // Auto-refresh logs
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefreshLogs) {
      interval = setInterval(loadLogs, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefreshLogs, loadLogs]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiService.updateSystemSettings(systemSettings);
      
      toast({
        title: 'Settings saved',
        description: 'Your settings have been successfully updated.',
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast({
        title: 'Error',
        description: `Failed to save settings: ${error instanceof ApiError ? error.message : String(error)}`,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Configure your security system preferences and monitor system health.
        </p>
      </div>

      {isLoadingSettings ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : settingsError ? (
        <div className="text-center text-destructive py-8">
          <p>{settingsError}</p>
          <Button onClick={loadSettings} className="mt-4">Retry Load Settings</Button>
        </div>
      ) : (
        <Tabs defaultValue="general" className="space-y-4">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="storage">Storage</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="logs">System Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>
                  Configure basic system preferences and behavior.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="systemName">System Name</Label>
                    <Input
                      id="systemName"
                      value={systemSettings.general.systemName}
                      onChange={(e) => setSystemSettings(prev => ({ ...prev, general: { ...prev.general, systemName: e.target.value } }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select value={systemSettings.general.timezone} onValueChange={(value) => setSystemSettings(prev => ({ ...prev, general: { ...prev.general, timezone: value } }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="America/New_York">Eastern Time</SelectItem>
                        <SelectItem value="America/Chicago">Central Time</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto Backup</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically backup system configuration and data
                    </p>
                  </div>
                  <Switch
                    checked={systemSettings.general.autoBackup}
                    onCheckedChange={(checked) => setSystemSettings(prev => ({ ...prev, general: { ...prev.general, autoBackup: checked } }))}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="storage" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Storage Management</CardTitle>
                <CardDescription>
                  Configure data retention and storage optimization settings.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="retentionDays">Data Retention (days)</Label>
                    <Input
                      id="retentionDays"
                      type="number"
                      value={systemSettings.storage.retentionDays}
                      onChange={(e) => setSystemSettings(prev => ({ ...prev, storage: { ...prev.storage, retentionDays: parseInt(e.target.value) } }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxStorage">Max Storage (GB)</Label>
                    <Input
                      id="maxStorage"
                      type="number"
                      value={systemSettings.storage.maxStorageGB}
                      onChange={(e) => setSystemSettings(prev => ({ ...prev, storage: { ...prev.storage, maxStorageGB: parseInt(e.target.value) } }))}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto Cleanup</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically delete old recordings when storage is full
                    </p>
                  </div>
                  <Switch
                    checked={systemSettings.storage.autoCleanup}
                    onCheckedChange={(checked) => setSystemSettings(prev => ({ ...prev, storage: { ...prev.storage, autoCleanup: checked } }))}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
                <CardDescription>
                  Configure how and when you receive alerts and notifications.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive alerts via email
                    </p>
                  </div>
                  <Switch
                    checked={systemSettings.notifications.emailEnabled}
                    onCheckedChange={(checked) => setSystemSettings(prev => ({ ...prev, notifications: { ...prev.notifications, emailEnabled: checked } }))}
                  />
                </div>

                {systemSettings.notifications.emailEnabled && (
                  <div className="space-y-2">
                    <Label htmlFor="emailAddress">Email Address</Label>
                    <Input
                      id="emailAddress"
                      type="email"
                      value={systemSettings.notifications.emailAddress}
                      onChange={(e) => setSystemSettings(prev => ({ ...prev, notifications: { ...prev.notifications, emailAddress: e.target.value } }))}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Push Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive browser push notifications
                    </p>
                  </div>
                  <Switch
                    checked={systemSettings.notifications.pushEnabled}
                    onCheckedChange={(checked) => setSystemSettings(prev => ({ ...prev, notifications: { ...prev.notifications, pushEnabled: checked } }))}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            {/* System Logs */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>System Logs</CardTitle>
                    <CardDescription>
                      Real-time system logs and activity monitoring
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="autoRefresh" className="text-sm">Auto-refresh</Label>
                      <Switch
                        id="autoRefresh"
                        checked={autoRefreshLogs}
                        onCheckedChange={setAutoRefreshLogs}
                      />
                    </div>
                    <Select value={logLevel} onValueChange={(value: 'all' | 'info' | 'warn' | 'error' | 'debug') => setLogLevel(value)}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                        <SelectItem value="warn">Warn</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="debug">Debug</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={downloadLogs}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearLogs}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={loadLogs} disabled={isLoadingLogs}>
                      {isLoadingLogs ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96 w-full border rounded-lg p-4">
                  {filteredLogs.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-muted-foreground">
                      No logs available
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredLogs.map((log, index) => (
                        <div key={index} className="flex items-start gap-3 text-sm">
                          <Badge variant={getLogLevelColor(log.level)} className="text-xs">
                            {log.level.toUpperCase()}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground text-xs">
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </span>
                              {log.source && (
                                <span className="text-muted-foreground text-xs">
                                  [{log.source}]
                                </span>
                              )}
                            </div>
                            <p className="break-words">{log.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving || isLoadingSettings}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
};

export default Settings;