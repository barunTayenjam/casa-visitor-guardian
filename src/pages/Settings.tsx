import { useState } from 'react';
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
import { Loader2 } from 'lucide-react';

const Settings = () => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  // System settings state
  const [systemSettings, setSystemSettings] = useState({
    retention: '30',
    storageLimit: '500',
    autoCleanup: true,
    notificationsEnabled: true,
    notificationTypes: ['motion', 'person', 'vehicle'],
  });

  // Storage settings state
  const [storageSettings, setStorageSettings] = useState({
    compressionEnabled: true,
    compressionQuality: '80',
    backupEnabled: false,
    backupPath: '/backups',
  });

  // Notification settings state
  const [notificationSettings, setNotificationSettings] = useState({
    emailEnabled: false,
    emailAddress: '',
    pushEnabled: true,
    pushSoundEnabled: true,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: 'Settings saved',
        description: 'Your settings have been successfully updated.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure your security system preferences
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>
                Configure general system settings and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="retention">Event Retention Period (days)</Label>
                <Input
                  id="retention"
                  type="number"
                  value={systemSettings.retention}
                  onChange={(e) => setSystemSettings({
                    ...systemSettings,
                    retention: e.target.value
                  })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="storageLimit">Storage Limit (GB)</Label>
                <Input
                  id="storageLimit"
                  type="number"
                  value={systemSettings.storageLimit}
                  onChange={(e) => setSystemSettings({
                    ...systemSettings,
                    storageLimit: e.target.value
                  })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="autoCleanup">Auto Cleanup</Label>
                <Switch
                  id="autoCleanup"
                  checked={systemSettings.autoCleanup}
                  onCheckedChange={(checked) => setSystemSettings({
                    ...systemSettings,
                    autoCleanup: checked
                  })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Storage Settings</CardTitle>
              <CardDescription>
                Configure image storage and backup settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="compression">Image Compression</Label>
                <Switch
                  id="compression"
                  checked={storageSettings.compressionEnabled}
                  onCheckedChange={(checked) => setStorageSettings({
                    ...storageSettings,
                    compressionEnabled: checked
                  })}
                />
              </div>

              {storageSettings.compressionEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="quality">Compression Quality (%)</Label>
                  <Input
                    id="quality"
                    type="number"
                    min="1"
                    max="100"
                    value={storageSettings.compressionQuality}
                    onChange={(e) => setStorageSettings({
                      ...storageSettings,
                      compressionQuality: e.target.value
                    })}
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label htmlFor="backup">Automatic Backup</Label>
                <Switch
                  id="backup"
                  checked={storageSettings.backupEnabled}
                  onCheckedChange={(checked) => setStorageSettings({
                    ...storageSettings,
                    backupEnabled: checked
                  })}
                />
              </div>

              {storageSettings.backupEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="backupPath">Backup Location</Label>
                  <Input
                    id="backupPath"
                    value={storageSettings.backupPath}
                    onChange={(e) => setStorageSettings({
                      ...storageSettings,
                      backupPath: e.target.value
                    })}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>
                Configure how and when you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="emailNotifications">Email Notifications</Label>
                <Switch
                  id="emailNotifications"
                  checked={notificationSettings.emailEnabled}
                  onCheckedChange={(checked) => setNotificationSettings({
                    ...notificationSettings,
                    emailEnabled: checked
                  })}
                />
              </div>

              {notificationSettings.emailEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="emailAddress">Email Address</Label>
                  <Input
                    id="emailAddress"
                    type="email"
                    value={notificationSettings.emailAddress}
                    onChange={(e) => setNotificationSettings({
                      ...notificationSettings,
                      emailAddress: e.target.value
                    })}
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label htmlFor="pushNotifications">Push Notifications</Label>
                <Switch
                  id="pushNotifications"
                  checked={notificationSettings.pushEnabled}
                  onCheckedChange={(checked) => setNotificationSettings({
                    ...notificationSettings,
                    pushEnabled: checked
                  })}
                />
              </div>

              {notificationSettings.pushEnabled && (
                <div className="flex items-center justify-between">
                  <Label htmlFor="notificationSound">Notification Sound</Label>
                  <Switch
                    id="notificationSound"
                    checked={notificationSettings.pushSoundEnabled}
                    onCheckedChange={(checked) => setNotificationSettings({
                      ...notificationSettings,
                      pushSoundEnabled: checked
                    })}
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label htmlFor="quietHours">Quiet Hours</Label>
                <Switch
                  id="quietHours"
                  checked={notificationSettings.quietHoursEnabled}
                  onCheckedChange={(checked) => setNotificationSettings({
                    ...notificationSettings,
                    quietHoursEnabled: checked
                  })}
                />
              </div>

              {notificationSettings.quietHoursEnabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quietStart">Start Time</Label>
                    <Input
                      id="quietStart"
                      type="time"
                      value={notificationSettings.quietHoursStart}
                      onChange={(e) => setNotificationSettings({
                        ...notificationSettings,
                        quietHoursStart: e.target.value
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quietEnd">End Time</Label>
                    <Input
                      id="quietEnd"
                      type="time"
                      value={notificationSettings.quietHoursEnd}
                      onChange={(e) => setNotificationSettings({
                        ...notificationSettings,
                        quietHoursEnd: e.target.value
                      })}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
};

export default Settings;
