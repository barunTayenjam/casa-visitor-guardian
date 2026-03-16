import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings as SettingsIcon,
  ChevronLeft,
  Save,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';
import { colors } from '@/styles/design-tokens';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const SettingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { changePassword } = useAuth();
  const [hasChanges, setHasChanges] = useState(false);

  const [settings, setSettings] = useState({
    systemName: 'SentryVision',
    timezone: 'Asia/Kolkata',
    language: 'en',
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

  const SettingCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={cn('p-5 rounded-xl border space-y-4', className)} style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
      {children}
    </div>
  );

  return (
    <div className="w-full min-h-screen flex flex-col" style={{ backgroundColor: colors.background.primary }}>
      <div className="px-4 md:px-6 py-4 border-b flex items-center justify-between" style={{ backgroundColor: colors.glass.light, backdropFilter: 'blur(10px)', borderColor: colors.border.subtle }}>
        <div className="flex items-center gap-4 md:gap-6">
          <Button size="sm" variant="ghost" className="text-white/80 hover:text-white hover:bg-white/5" onClick={() => navigate('/app/streams')}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${colors.status.info}15` }}>
              <SettingsIcon className="h-5 w-5" style={{ color: colors.status.info }} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Settings</h1>
              <p className="text-xs text-white/50 hidden sm:block">Configure your SentryVision system</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button size="sm" variant="ghost" className="text-white/70 hover:text-white hover:bg-white/5" onClick={handleReset}>
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
              <h2 className="text-xl font-semibold text-white">General Settings</h2>
              <p className="text-sm text-white/50 mt-1">Configure basic system preferences</p>
            </div>

            <SettingCard>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-white">System Name</Label>
                  <Input
                    type="text"
                    value={settings.systemName}
                    onChange={(e) => updateSetting('systemName', e.target.value)}
                    className="mt-2 bg-white/5 border-white/10 text-white focus:bg-white/10"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-white">Timezone</Label>
                  <select
                    value={settings.timezone}
                    onChange={(e) => updateSetting('timezone', e.target.value)}
                    className="mt-2 w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
                    <option value="America/New_York">America/New_York (EST, UTC-5)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST, UTC-8)</option>
                    <option value="Europe/London">Europe/London (GMT, UTC+0)</option>
                    <option value="UTC">UTC (UTC+0)</option>
                  </select>
                </div>

                <div>
                  <Label className="text-sm font-medium text-white">Language</Label>
                  <select
                    value={settings.language}
                    onChange={(e) => updateSetting('language', e.target.value)}
                    className="mt-2 w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500"
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
              <h2 className="text-xl font-semibold text-white">Change Password</h2>
              <p className="text-sm text-white/50 mt-1">Update your account password</p>
            </div>

            <SettingCard>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-white">Current Password</Label>
                  <div className="relative mt-2">
                    <Input
                      type={showPasswords.current ? 'text' : 'password'}
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                      className="bg-white/5 border-white/10 text-white focus:bg-white/10 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('current')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                    >
                      {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-white">New Password</Label>
                  <div className="relative mt-2">
                    <Input
                      type={showPasswords.new ? 'text' : 'password'}
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                      className="bg-white/5 border-white/10 text-white focus:bg-white/10 pr-10"
                      minLength={8}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('new')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                    >
                      {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-white">Confirm New Password</Label>
                  <div className="relative mt-2">
                    <Input
                      type={showPasswords.confirm ? 'text' : 'password'}
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className="bg-white/5 border-white/10 text-white focus:bg-white/10 pr-10"
                      minLength={8}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('confirm')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
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
