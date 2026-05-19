import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings as SettingsIcon,
  ChevronLeft,
  Save,
  Eye,
  EyeOff,
  Lock,
  Sun,
  Moon,
  Monitor,
  HardDrive,
  Trash2,
  Clock,
  Bell,
  BellOff,
  Volume2,
  Mail,
} from 'lucide-react';
import { colors } from '@/styles/design-tokens';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { type Theme, getStoredTheme, storeTheme, applyTheme } from '@/lib/theme';
import { OptimizationSettings } from '@/components/settings/OptimizationSettings';
import { MotionDetectionSettings } from '@/components/settings/MotionDetectionSettings';
import { settingsService } from '@/services/api/settingsService';
import { notificationService } from '@/services/api/notificationService';

interface GeneralSettings {
  systemName: string;
  timezone: string;
  language: string;
}

interface RetentionSettings {
  imageRetentionDays: number;
  eventRetentionDays: number;
  cleanupEnabled: boolean;
}

interface NotificationPrefs {
  motionEnabled: boolean;
  faceEnabled: boolean;
  objectEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  emailEnabled: boolean;
  emailAddress: string;
}

const SettingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { changePassword } = useAuth();
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  const [settings, setSettings] = useState<GeneralSettings>({
    systemName: 'SentryVision',
    timezone: 'Asia/Kolkata',
    language: 'en',
  });

  const [retentionSettings, setRetentionSettings] = useState<RetentionSettings>({
    imageRetentionDays: 7,
    eventRetentionDays: 30,
    cleanupEnabled: true,
  });

  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>({
    motionEnabled: true,
    faceEnabled: true,
    objectEnabled: true,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
    emailEnabled: false,
    emailAddress: '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      try {
        const sysSettings = await settingsService.getSettings();
        if (sysSettings) {
          setSettings({
            systemName: sysSettings.general?.systemName || 'SentryVision',
            timezone: sysSettings.general?.timezone || 'Asia/Kolkata',
            language: sysSettings.general?.language || 'en',
          });
          setRetentionSettings({
            imageRetentionDays: sysSettings.storage?.retentionDays || 7,
            eventRetentionDays: sysSettings.storage?.maxStorageGB || 30,
            cleanupEnabled: sysSettings.storage?.autoCleanup !== false,
          });
          setNotificationPrefs(prev => ({
            ...prev,
            emailEnabled: sysSettings.notifications?.emailEnabled || false,
            emailAddress: sysSettings.notifications?.emailAddress || '',
          }));
        }
      } catch (error) {
        console.error('Failed to load system settings:', error);
      }
      try {
        const prefs = await notificationService.getPreferences();
        if (prefs) {
          setNotificationPrefs(prev => ({
            ...prev,
            motionEnabled: prefs.motion_enabled,
            faceEnabled: prefs.face_enabled,
            objectEnabled: prefs.object_enabled,
            quietHoursEnabled: prefs.quiet_hours_enabled,
            quietHoursStart: prefs.quiet_hours_start,
            quietHoursEnd: prefs.quiet_hours_end,
          }));
        }
      } catch (error) {
        console.error('Failed to load notification preferences:', error);
      }
      try {
        const subStatus = await notificationService.getSubscriptionStatus();
        setPushSubscribed(subStatus.subscribed);
      } catch {
        setPushSubscribed(false);
      }
      setLoading(false);
    }
    loadSettings();
  }, []);

  const markChanged = () => setHasChanges(true);

  const updateSetting = <K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    markChanged();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsService.updateSettings({
        general: {
          systemName: settings.systemName,
          timezone: settings.timezone,
          language: settings.language,
          theme: 'system',
          autoBackup: true,
          backupFrequency: 'daily',
        },
        storage: {
          retentionDays: retentionSettings.imageRetentionDays,
          maxStorageGB: retentionSettings.eventRetentionDays,
          autoCleanup: retentionSettings.cleanupEnabled,
          compressionEnabled: true,
          compressionQuality: 80,
        },
        notifications: {
          emailEnabled: notificationPrefs.emailEnabled,
          emailAddress: notificationPrefs.emailAddress,
          pushEnabled: true,
          pushSoundEnabled: true,
          quietHoursEnabled: notificationPrefs.quietHoursEnabled,
          quietHoursStart: notificationPrefs.quietHoursStart,
          quietHoursEnd: notificationPrefs.quietHoursEnd,
        },
      });
      await notificationService.updatePreferences({
        motion_enabled: notificationPrefs.motionEnabled,
        face_enabled: notificationPrefs.faceEnabled,
        object_enabled: notificationPrefs.objectEnabled,
        quiet_hours_enabled: notificationPrefs.quietHoursEnabled,
        quiet_hours_start: notificationPrefs.quietHoursStart,
        quiet_hours_end: notificationPrefs.quietHoursEnd,
        quiet_hours_timezone: settings.timezone,
      });
      setHasChanges(false);
      toast({
        title: 'Settings saved',
        description: 'Your settings have been updated successfully.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save settings',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setHasChanges(false);
    toast({
      title: 'Changes discarded',
      description: 'Your settings have been reset to the last loaded values.',
    });
    window.location.reload();
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Passwords do not match',
        description: 'New password and confirm password must be the same.',
      });
      return;
    }
    if (passwordData.newPassword.length < 8) {
      toast({
        variant: 'destructive',
        title: 'Password too short',
        description: 'Password must be at least 8 characters long.',
      });
      return;
    }
    setIsChangingPassword(true);
    try {
      await changePassword(passwordData.currentPassword, passwordData.newPassword);
      toast({ title: 'Password changed', description: 'Your password has been updated successfully.' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Password change failed',
        description: error instanceof Error ? error.message : 'Failed to change password.',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleThemeChange = (value: Theme) => {
    setTheme(value);
    storeTheme(value);
    applyTheme(value);
    toast({
      title: 'Theme updated',
      description: `Switched to ${value === 'system' ? 'system preference' : value + ' mode'}.`,
    });
  };

  const handleTestNotification = async () => {
    try {
      await notificationService.sendTestNotification();
      toast({ title: 'Test notification sent', description: 'Check your device for the notification.' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Test notification failed',
        description: error instanceof Error ? error.message : 'Failed to send test notification',
      });
    }
  };

  const handlePushToggle = async () => {
    setPushLoading(true);
    try {
      if (pushSubscribed) {
        await notificationService.unsubscribeFromPush();
        setPushSubscribed(false);
        toast({ title: 'Push notifications disabled', description: 'You will no longer receive browser push notifications.' });
      } else {
        await notificationService.subscribeToPush();
        setPushSubscribed(true);
        toast({ title: 'Push notifications enabled', description: 'You will now receive browser push notifications.' });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: pushSubscribed ? 'Unsubscribe failed' : 'Subscribe failed',
        description: error instanceof Error ? error.message : 'Failed to update push subscription',
      });
    } finally {
      setPushLoading(false);
    }
  };

  const SettingCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={cn('bg-card border border-border rounded-xl p-5 space-y-4', className)}>
      {children}
    </div>
  );

  if (loading) {
    return (
      <div className="w-full min-h-screen flex flex-col bg-background">
        <div className="px-4 md:px-6 py-4 border-b flex items-center justify-between bg-background/80 backdrop-blur-sm border-border">
          <div className="flex items-center gap-4 md:gap-6">
            <Button size="sm" variant="ghost" onClick={() => navigate('/app/streams')}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Settings</h1>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen flex flex-col bg-background">
      <div className="px-4 md:px-6 py-4 border-b flex items-center justify-between bg-background/80 backdrop-blur-sm border-border">
        <div className="flex items-center gap-4 md:gap-6">
          <Button size="sm" variant="ghost" onClick={() => navigate('/app/streams')}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${colors.status.info}15` }}>
              <SettingsIcon className="h-5 w-5" style={{ color: colors.status.info }} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Settings</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Configure your SentryVision system</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button size="sm" variant="ghost" onClick={handleReset}>
              Reset
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={!hasChanges || saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-6 max-w-4xl">
          <div className="space-y-6">

            <div className="mb-6">
              <h2 className="text-xl font-semibold text-foreground">General Settings</h2>
              <p className="text-sm text-muted-foreground mt-1">Configure basic system preferences</p>
            </div>

            <SettingCard>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-foreground">System Name</Label>
                  <Input
                    type="text"
                    value={settings.systemName}
                    onChange={(e) => updateSetting('systemName', e.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-foreground">Timezone</Label>
                  <select
                    value={settings.timezone}
                    onChange={(e) => updateSetting('timezone', e.target.value)}
                    className="mt-2 w-full px-3 py-2 rounded-lg bg-muted border border-input text-foreground text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
                    <option value="America/New_York">America/New_York (EST, UTC-5)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST, UTC-8)</option>
                    <option value="Europe/London">Europe/London (GMT, UTC+0)</option>
                    <option value="UTC">UTC (UTC+0)</option>
                  </select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-foreground">Language</Label>
                  <select
                    value={settings.language}
                    onChange={(e) => updateSetting('language', e.target.value)}
                    className="mt-2 w-full px-3 py-2 rounded-lg bg-muted border border-input text-foreground text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="hi">Hindi</option>
                  </select>
                </div>
              </div>
            </SettingCard>

            <div className="mb-6 mt-8">
              <h2 className="text-xl font-semibold text-foreground">Notification Preferences</h2>
              <p className="text-sm text-muted-foreground mt-1">Configure which alerts you receive and when</p>
            </div>

            <SettingCard>
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-500/10">
                      <Bell className="h-5 w-5 text-orange-500" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-foreground">Browser Push Notifications</Label>
                      <p className="text-xs text-muted-foreground">Receive push notifications in your browser</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={pushSubscribed ? 'outline' : 'default'}
                    onClick={handlePushToggle}
                    disabled={pushLoading}
                  >
                    {pushLoading ? '...' : pushSubscribed ? 'Disable' : 'Enable'}
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <Bell className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-foreground">Motion Alerts</Label>
                      <p className="text-xs text-muted-foreground">Notify when motion is detected</p>
                    </div>
                  </div>
                  <Switch
                    checked={notificationPrefs.motionEnabled}
                    onCheckedChange={(v) => { setNotificationPrefs(s => ({ ...s, motionEnabled: v })); markChanged(); }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <Bell className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-foreground">Face Alerts</Label>
                      <p className="text-xs text-muted-foreground">Notify when a face is detected</p>
                    </div>
                  </div>
                  <Switch
                    checked={notificationPrefs.faceEnabled}
                    onCheckedChange={(v) => { setNotificationPrefs(s => ({ ...s, faceEnabled: v })); markChanged(); }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <BellOff className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-foreground">Object Alerts</Label>
                      <p className="text-xs text-muted-foreground">Notify when objects (cars, packages) are detected</p>
                    </div>
                  </div>
                  <Switch
                    checked={notificationPrefs.objectEnabled}
                    onCheckedChange={(v) => { setNotificationPrefs(s => ({ ...s, objectEnabled: v })); markChanged(); }}
                  />
                </div>

                <div className="pt-3 border-t border-border">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-500/10">
                        <Clock className="h-5 w-5 text-amber-500" />
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-foreground">Quiet Hours</Label>
                        <p className="text-xs text-muted-foreground">Suppress notifications during set hours</p>
                      </div>
                    </div>
                    <Switch
                      checked={notificationPrefs.quietHoursEnabled}
                      onCheckedChange={(v) => { setNotificationPrefs(s => ({ ...s, quietHoursEnabled: v })); markChanged(); }}
                    />
                  </div>
                  {notificationPrefs.quietHoursEnabled && (
                    <div className="flex items-center gap-3 ml-11">
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">Start</Label>
                        <Input
                          type="time"
                          value={notificationPrefs.quietHoursStart}
                          onChange={(e) => { setNotificationPrefs(s => ({ ...s, quietHoursStart: e.target.value })); markChanged(); }}
                          className="mt-1"
                        />
                      </div>
                      <span className="text-muted-foreground mt-6">to</span>
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">End</Label>
                        <Input
                          type="time"
                          value={notificationPrefs.quietHoursEnd}
                          onChange={(e) => { setNotificationPrefs(s => ({ ...s, quietHoursEnd: e.target.value })); markChanged(); }}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-sky-500/10">
                        <Volume2 className="h-5 w-5 text-sky-500" />
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-foreground">Test Notification</Label>
                        <p className="text-xs text-muted-foreground">Send a test push notification to your device</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={handleTestNotification}>
                      Send Test
                    </Button>
                  </div>
                </div>

                <div className="pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-rose-500/10">
                        <Mail className="h-5 w-5 text-rose-500" />
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-foreground">Email Notifications</Label>
                        <p className="text-xs text-muted-foreground">Receive notification summaries via email</p>
                      </div>
                    </div>
                    <Switch
                      checked={notificationPrefs.emailEnabled}
                      onCheckedChange={(v) => { setNotificationPrefs(s => ({ ...s, emailEnabled: v })); markChanged(); }}
                    />
                  </div>
                  {notificationPrefs.emailEnabled && (
                    <div className="ml-11 mt-2">
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        value={notificationPrefs.emailAddress}
                        onChange={(e) => { setNotificationPrefs(s => ({ ...s, emailAddress: e.target.value })); markChanged(); }}
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>
              </div>
            </SettingCard>

            <div className="mb-6 mt-8">
              <h2 className="text-xl font-semibold text-foreground">Detection Settings</h2>
              <p className="text-sm text-muted-foreground mt-1">Configure motion detection sensitivity</p>
            </div>

            <MotionDetectionSettings markChanged={markChanged} />

            <div className="mb-6 mt-8">
              <h2 className="text-xl font-semibold text-foreground">Data & Storage</h2>
              <p className="text-sm text-muted-foreground mt-1">Configure data retention and cleanup</p>
            </div>

            <OptimizationSettings />

            <SettingCard>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Clock className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-foreground">Image Retention</Label>
                      <p className="text-xs text-muted-foreground">Days to keep images before cleanup</p>
                    </div>
                  </div>
                  <Select
                    value={retentionSettings.imageRetentionDays.toString()}
                    onValueChange={(v) => { setRetentionSettings(s => ({ ...s, imageRetentionDays: parseInt(v) })); markChanged(); }}
                  >
                    <SelectTrigger className="w-24 bg-muted border-input">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 days</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="14">14 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <HardDrive className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-foreground">Event Records</Label>
                      <p className="text-xs text-muted-foreground">Days to keep event records in database</p>
                    </div>
                  </div>
                  <Select
                    value={retentionSettings.eventRetentionDays.toString()}
                    onValueChange={(v) => { setRetentionSettings(s => ({ ...s, eventRetentionDays: parseInt(v) })); markChanged(); }}
                  >
                    <SelectTrigger className="w-24 bg-muted border-input">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="60">60 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                      <SelectItem value="365">1 year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <Trash2 className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-foreground">Auto Cleanup</Label>
                      <p className="text-xs text-muted-foreground">Automatically clean old images (runs daily at 2 AM)</p>
                    </div>
                  </div>
                  <Button
                    variant={retentionSettings.cleanupEnabled ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setRetentionSettings(s => ({ ...s, cleanupEnabled: !s.cleanupEnabled })); markChanged(); }}
                  >
                    {retentionSettings.cleanupEnabled ? "Enabled" : "Disabled"}
                  </Button>
                </div>
              </div>
            </SettingCard>

            <div className="mb-6 mt-8">
              <h2 className="text-xl font-semibold text-foreground">Appearance</h2>
              <p className="text-sm text-muted-foreground mt-1">Customize the look and feel</p>
            </div>

            <SettingCard>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-foreground">Theme</Label>
                  <Select value={theme} onValueChange={(v) => handleThemeChange(v as Theme)}>
                    <SelectTrigger className="mt-2 w-full bg-muted border-input text-foreground">
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">
                        <span className="flex items-center gap-2">
                          <Sun className="h-4 w-4" />
                          Light
                        </span>
                      </SelectItem>
                      <SelectItem value="dark">
                        <span className="flex items-center gap-2">
                          <Moon className="h-4 w-4" />
                          Dark
                        </span>
                      </SelectItem>
                      <SelectItem value="system">
                        <span className="flex items-center gap-2">
                          <Monitor className="h-4 w-4" />
                          System
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground/70 mt-1.5">
                    System mode matches your operating system preference
                  </p>
                </div>
              </div>
            </SettingCard>

            <div className="mb-6 mt-8">
              <h2 className="text-xl font-semibold text-foreground">Change Password</h2>
              <p className="text-sm text-muted-foreground mt-1">Update your account password</p>
            </div>

            <SettingCard>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-foreground">Current Password</Label>
                  <div className="relative mt-2">
                    <Input
                      type={showPasswords.current ? 'text' : 'password'}
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('current')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPasswords.current ? 'Hide current password' : 'Show current password'}
                    >
                      {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-foreground">New Password</Label>
                  <div className="relative mt-2">
                    <Input
                      type={showPasswords.new ? 'text' : 'password'}
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                      className="pr-10"
                      minLength={8}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('new')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPasswords.new ? 'Hide new password' : 'Show new password'}
                    >
                      {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-foreground">Confirm New Password</Label>
                  <div className="relative mt-2">
                    <Input
                      type={showPasswords.confirm ? 'text' : 'password'}
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className="pr-10"
                      minLength={8}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('confirm')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPasswords.confirm ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isChangingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                    className="w-full sm:w-auto"
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    {isChangingPassword ? 'Changing Password...' : 'Change Password'}
                  </Button>
                </div>
              </form>
            </SettingCard>

          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
