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
  Loader2
} from 'lucide-react';
import apiService, { ApiError } from '@/services/ApiService';
import { SystemSettings } from '@/types/security';
import { FaceRecognitionManager } from '@/components/settings/FaceRecognitionManager';

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
    },
    notifications: {
      emailEnabled: false,
      emailAddress: '',
      pushEnabled: false,
      pushSoundEnabled: false,
    },
  });

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

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

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
          Configure your security system preferences.
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
            <TabsTrigger value="detection">Detection</TabsTrigger>
            <TabsTrigger value="storage">Storage</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
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

          <TabsContent value="detection" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Automatic Detection Settings</CardTitle>
                <CardDescription>
                  Configure automatic object and face detection during motion events.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Automatically Detect Objects</Label>
                    <p className="text-sm text-muted-foreground">
                      Run object detection when motion is detected
                    </p>
                  </div>
                  <Switch
                    checked={systemSettings.general.autoBackup}
                    onCheckedChange={(checked) => {
                      console.log('Auto detect objects:', checked);
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Automatically Detect Faces</Label>
                    <p className="text-sm text-muted-foreground">
                      Run face recognition when motion is detected
                    </p>
                  </div>
                  <Switch
                    checked={systemSettings.general.autoBackup}
                    onCheckedChange={(checked) => {
                      console.log('Auto detect faces:', checked);
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="detectionPriority">Detection Priority</Label>
                  <Select 
                    defaultValue="immediate"
                    onValueChange={(value) => {
                      console.log('Detection priority:', value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">Immediate (detect during motion)</SelectItem>
                      <SelectItem value="deferred">Deferred (process in background)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    When to run detection relative to motion detection
                  </p>
                </div>

                <div className="space-y-2 pt-4 border-t">
                  <h4 className="font-semibold">Detection Information</h4>
                  <p className="text-sm text-muted-foreground">
                    Automatic detection runs when motion is detected and saves results directly to Gallery.
                    This provides a unified view of all detection data.
                  </p>
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-blue-500"></div>
                      <span className="text-muted-foreground">Persons</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-green-500"></div>
                      <span className="text-muted-foreground">Faces</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-purple-500"></div>
                      <span className="text-muted-foreground">Objects</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <FaceRecognitionManager />
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