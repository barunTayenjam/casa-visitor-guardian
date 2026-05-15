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
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { type Theme, getStoredTheme, storeTheme, applyTheme } from '@/lib/theme';

const SettingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { changePassword } = useAuth();
  const [hasChanges, setHasChanges] = useState(false);
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  const [settings, setSettings] = useState({
    systemName: 'SentryVision',
    timezone: 'Asia/Kolkata',
    language: 'en',
  });

  const [retentionSettings, setRetentionSettings] = useState({
    imageRetentionDays: 7,
    eventRetentionDays: 30,
    cleanupEnabled: true,
  });

  const [originalSettings] = useState(settings);

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

  const updateSetting = <K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    setHasChanges(false);
    toast({
      title: 'Settings saved',
      description: 'Your settings have been updated successfully.',
    });
  };

  const handleReset = () => {
    setSettings(originalSettings);
    setHasChanges(false);
    toast({
      title: 'Changes discarded',
      description: 'Your settings have been reset to the last saved values.',
    });
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
      toast({
        title: 'Password changed',
        description: 'Your password has been updated successfully.',
      });
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Password change failed',
        description: error instanceof Error ? error.message : 'Failed to change password. Please check your current password and try again.',
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

  const SettingCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={cn('bg-card border border-border rounded-xl p-5 space-y-4', className)}>
      {children}
    </div>
  );

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
          <Button size="sm" onClick={handleSave} disabled={!hasChanges}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
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
              <h2 className="text-xl font-semibold text-foreground">Data & Storage</h2>
              <p className="text-sm text-muted-foreground mt-1">Configure data retention and cleanup</p>
            </div>

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
                    onValueChange={(v) => setRetentionSettings(s => ({ ...s, imageRetentionDays: parseInt(v) }))}
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
                    onValueChange={(v) => setRetentionSettings(s => ({ ...s, eventRetentionDays: parseInt(v) }))}
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
                    onClick={() => setRetentionSettings(s => ({ ...s, cleanupEnabled: !s.cleanupEnabled }))}
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
