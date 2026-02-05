import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings as SettingsIcon,
  ChevronLeft,
  Save,
} from 'lucide-react';
import { colors } from '@/styles/design-tokens';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const SettingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [hasChanges, setHasChanges] = useState(false);

  const [settings, setSettings] = useState({
    systemName: 'SentryVision',
    timezone: 'Asia/Kolkata',
    language: 'en',
  });

  const [originalSettings] = useState(settings);

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
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
