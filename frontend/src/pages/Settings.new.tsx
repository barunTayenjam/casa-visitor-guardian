import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings,
  Shield,
  Bell,
  Camera,
  Database,
  Palette,
  User,
  Lock,
  Save,
  ChevronRight,
} from 'lucide-react';
import { colors } from '@/styles/design-tokens';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

type SettingsTab = 'general' | 'cameras' | 'notifications' | 'storage' | 'security' | 'appearance';

const SettingsPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [saving, setSaving] = useState(false);

  // Settings state
  const [settings, setSettings] = useState({
    // General
    systemName: 'SentryVision',
    timezone: 'Asia/Kolkata',
    language: 'en',

    // Cameras
    motionDetectionEnabled: true,
    nightModeEnabled: false,
    recordingEnabled: true,
    streamQuality: 'high' as 'low' | 'medium' | 'high',

    // Notifications
    pushNotifications: true,
    emailNotifications: false,
    alertSound: true,
    quietHoursEnabled: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',

    // Storage
    retentionDays: 30,
    autoCleanup: true,
    maxStorageGB: 500,

    // Security
    twoFactorEnabled: false,
    sessionTimeout: 30,
    auditLogEnabled: true,

    // Appearance
    theme: 'dark' as 'light' | 'dark' | 'auto',
    compactMode: false,
    showTimestamps: true,
  });

  const handleSave = async () => {
    setSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaving(false);
    // Show success toast
  };

  const tabs = [
    { id: 'general' as SettingsTab, label: 'General', icon: Settings },
    { id: 'cameras' as SettingsTab, label: 'Cameras', icon: Camera },
    { id: 'notifications' as SettingsTab, label: 'Notifications', icon: Bell },
    { id: 'storage' as SettingsTab, label: 'Storage', icon: Database },
    { id: 'security' as SettingsTab, label: 'Security', icon: Shield },
    { id: 'appearance' as SettingsTab, label: 'Appearance', icon: Palette },
  ];

  return (
    <div className="w-full min-h-screen flex flex-col" style={{ backgroundColor: colors.background.primary }}>
      {/* Header */}
      <div className="px-4 md:px-6 py-3 md:py-4 border-b" style={{ backgroundColor: colors.glass.light, backdropFilter: 'blur(10px)', borderColor: colors.border.subtle }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: colors.interactive.hover }}>
              <Settings className="h-4 w-4 md:h-5 md:w-5" style={{ color: colors.status.info }} />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-semibold text-white">Settings</h1>
              <p className="text-xs text-white/60 hidden sm:block">Configure your system</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="text-white/80 hover:text-white hover:bg-white/5" onClick={() => navigate('/app')}>
              Back
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Tabs */}
        <div className="w-48 md:w-64 border-r overflow-y-auto hidden md:block" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
          <nav className="p-4 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  'hover:bg-white/5',
                  activeTab === tab.id
                    ? 'bg-white/10 text-white'
                    : 'text-white/60 hover:text-white'
                )}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {activeTab === tab.id && <ChevronRight className="h-4 w-4 ml-auto" />}
              </button>
            ))}
          </nav>
        </div>

        {/* Mobile Tabs */}
        <div className="md:hidden w-full border-b overflow-x-auto" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
          <div className="flex p-2 gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all flex-shrink-0',
                  'hover:bg-white/5',
                  activeTab === tab.id
                    ? 'bg-white/10 text-white'
                    : 'text-white/60 hover:text-white'
                )}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* General Settings */}
          {activeTab === 'general' && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-4">General Settings</h2>
                <p className="text-sm text-white/60">Configure basic system preferences</p>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-lg border" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
                  <label className="block text-sm font-medium text-white mb-2">System Name</label>
                  <input
                    type="text"
                    value={settings.systemName}
                    onChange={(e) => setSettings({ ...settings, systemName: e.target.value })}
                    className="w-full px-3 py-2 rounded bg-black/30 border border-white/10 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="p-4 rounded-lg border" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
                  <label className="block text-sm font-medium text-white mb-2">Timezone</label>
                  <select
                    value={settings.timezone}
                    onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                    className="w-full px-3 py-2 rounded bg-black/30 border border-white/10 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
                    <option value="America/New_York">America/New_York (EST, UTC-5)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST, UTC-8)</option>
                    <option value="Europe/London">Europe/London (GMT, UTC+0)</option>
                    <option value="UTC">UTC (UTC+0)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Cameras Settings */}
          {activeTab === 'cameras' && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-4">Camera Settings</h2>
                <p className="text-sm text-white/60">Configure camera detection and recording</p>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-lg border flex items-center justify-between" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
                  <div>
                    <h3 className="text-sm font-medium text-white">Motion Detection</h3>
                    <p className="text-xs text-white/60 mt-1">Enable automatic motion detection</p>
                  </div>
                  <Switch checked={settings.motionDetectionEnabled} onCheckedChange={(checked) => setSettings({ ...settings, motionDetectionEnabled: checked })} />
                </div>

                <div className="p-4 rounded-lg border flex items-center justify-between" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
                  <div>
                    <h3 className="text-sm font-medium text-white">Night Mode</h3>
                    <p className="text-xs text-white/60 mt-1">Automatically switch to night mode</p>
                  </div>
                  <Switch checked={settings.nightModeEnabled} onCheckedChange={(checked) => setSettings({ ...settings, nightModeEnabled: checked })} />
                </div>

                <div className="p-4 rounded-lg border" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
                  <h3 className="text-sm font-medium text-white mb-3">Stream Quality</h3>
                  <div className="flex gap-2">
                    {(['low', 'medium', 'high'] as const).map((quality) => (
                      <button
                        key={quality}
                        onClick={() => setSettings({ ...settings, streamQuality: quality })}
                        className={cn(
                          'px-4 py-2 rounded text-sm font-medium transition-all capitalize',
                          settings.streamQuality === quality
                            ? 'bg-blue-600 text-white'
                            : 'bg-white/5 text-white/60 hover:bg-white/10'
                        )}
                      >
                        {quality}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Settings */}
          {activeTab === 'notifications' && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-4">Notification Settings</h2>
                <p className="text-sm text-white/60">Manage how you receive alerts</p>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-lg border flex items-center justify-between" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
                  <div>
                    <h3 className="text-sm font-medium text-white">Push Notifications</h3>
                    <p className="text-xs text-white/60 mt-1">Receive browser notifications</p>
                  </div>
                  <Switch checked={settings.pushNotifications} onCheckedChange={(checked) => setSettings({ ...settings, pushNotifications: checked })} />
                </div>

                <div className="p-4 rounded-lg border flex items-center justify-between" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
                  <div>
                    <h3 className="text-sm font-medium text-white">Email Notifications</h3>
                    <p className="text-xs text-white/60 mt-1">Receive alerts via email</p>
                  </div>
                  <Switch checked={settings.emailNotifications} onCheckedChange={(checked) => setSettings({ ...settings, emailNotifications: checked })} />
                </div>

                <div className="p-4 rounded-lg border flex items-center justify-between" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
                  <div>
                    <h3 className="text-sm font-medium text-white">Alert Sound</h3>
                    <p className="text-xs text-white/60 mt-1">Play sound on notifications</p>
                  </div>
                  <Switch checked={settings.alertSound} onCheckedChange={(checked) => setSettings({ ...settings, alertSound: checked })} />
                </div>

                <div className="p-4 rounded-lg border" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-medium text-white">Quiet Hours</h3>
                      <p className="text-xs text-white/60 mt-1">Disable notifications during specific hours</p>
                    </div>
                    <Switch checked={settings.quietHoursEnabled} onCheckedChange={(checked) => setSettings({ ...settings, quietHoursEnabled: checked })} />
                  </div>
                  {settings.quietHoursEnabled && (
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex-1">
                        <label className="block text-xs text-white/60 mb-1">Start Time</label>
                        <input
                          type="time"
                          value={settings.quietHoursStart}
                          onChange={(e) => setSettings({ ...settings, quietHoursStart: e.target.value })}
                          className="w-full px-3 py-2 rounded bg-black/30 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-white/60 mb-1">End Time</label>
                        <input
                          type="time"
                          value={settings.quietHoursEnd}
                          onChange={(e) => setSettings({ ...settings, quietHoursEnd: e.target.value })}
                          className="w-full px-3 py-2 rounded bg-black/30 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Storage Settings */}
          {activeTab === 'storage' && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-4">Storage Settings</h2>
                <p className="text-sm text-white/60">Manage data retention and storage</p>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-lg border" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
                  <label className="block text-sm font-medium text-white mb-2">Retention Period (days)</label>
                  <input
                    type="number"
                    value={settings.retentionDays}
                    onChange={(e) => setSettings({ ...settings, retentionDays: parseInt(e.target.value) || 30 })}
                    className="w-full px-3 py-2 rounded bg-black/30 border border-white/10 text-white focus:outline-none focus:border-blue-500"
                    min="1"
                    max="365"
                  />
                  <p className="text-xs text-white/50 mt-1">Events older than this will be automatically deleted</p>
                </div>

                <div className="p-4 rounded-lg border flex items-center justify-between" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
                  <div>
                    <h3 className="text-sm font-medium text-white">Auto Cleanup</h3>
                    <p className="text-xs text-white/60 mt-1">Automatically remove old recordings</p>
                  </div>
                  <Switch checked={settings.autoCleanup} onCheckedChange={(checked) => setSettings({ ...settings, autoCleanup: checked })} />
                </div>

                <div className="p-4 rounded-lg border" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
                  <label className="block text-sm font-medium text-white mb-2">Max Storage (GB)</label>
                  <input
                    type="number"
                    value={settings.maxStorageGB}
                    onChange={(e) => setSettings({ ...settings, maxStorageGB: parseInt(e.target.value) || 500 })}
                    className="w-full px-3 py-2 rounded bg-black/30 border border-white/10 text-white focus:outline-none focus:border-blue-500"
                    min="10"
                    max="5000"
                  />
                  <p className="text-xs text-white/50 mt-1">Maximum storage space for recordings</p>
                </div>
              </div>
            </div>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-4">Security Settings</h2>
                <p className="text-sm text-white/60">Configure security and authentication</p>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-lg border flex items-center justify-between" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
                  <div>
                    <h3 className="text-sm font-medium text-white">Two-Factor Authentication</h3>
                    <p className="text-xs text-white/60 mt-1">Add an extra layer of security</p>
                  </div>
                  <Switch checked={settings.twoFactorEnabled} onCheckedChange={(checked) => setSettings({ ...settings, twoFactorEnabled: checked })} />
                </div>

                <div className="p-4 rounded-lg border" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
                  <label className="block text-sm font-medium text-white mb-2">Session Timeout (minutes)</label>
                  <input
                    type="number"
                    value={settings.sessionTimeout}
                    onChange={(e) => setSettings({ ...settings, sessionTimeout: parseInt(e.target.value) || 30 })}
                    className="w-full px-3 py-2 rounded bg-black/30 border border-white/10 text-white focus:outline-none focus:border-blue-500"
                    min="5"
                    max="120"
                  />
                  <p className="text-xs text-white/50 mt-1">Auto-logout after period of inactivity</p>
                </div>

                <div className="p-4 rounded-lg border flex items-center justify-between" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
                  <div>
                    <h3 className="text-sm font-medium text-white">Audit Logging</h3>
                    <p className="text-xs text-white/60 mt-1">Log all security events</p>
                  </div>
                  <Switch checked={settings.auditLogEnabled} onCheckedChange={(checked) => setSettings({ ...settings, auditLogEnabled: checked })} />
                </div>
              </div>
            </div>
          )}

          {/* Appearance Settings */}
          {activeTab === 'appearance' && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-4">Appearance</h2>
                <p className="text-sm text-white/60">Customize the look and feel</p>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-lg border" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
                  <h3 className="text-sm font-medium text-white mb-3">Theme</h3>
                  <div className="flex gap-2">
                    {(['light', 'dark', 'auto'] as const).map((theme) => (
                      <button
                        key={theme}
                        onClick={() => setSettings({ ...settings, theme })}
                        className={cn(
                          'px-4 py-2 rounded text-sm font-medium transition-all capitalize flex-1',
                          settings.theme === theme
                            ? 'bg-blue-600 text-white'
                            : 'bg-white/5 text-white/60 hover:bg-white/10'
                        )}
                      >
                        {theme}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-lg border flex items-center justify-between" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
                  <div>
                    <h3 className="text-sm font-medium text-white">Compact Mode</h3>
                    <p className="text-xs text-white/60 mt-1">Use more compact layout</p>
                  </div>
                  <Switch checked={settings.compactMode} onCheckedChange={(checked) => setSettings({ ...settings, compactMode: checked })} />
                </div>

                <div className="p-4 rounded-lg border flex items-center justify-between" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
                  <div>
                    <h3 className="text-sm font-medium text-white">Show Timestamps</h3>
                    <p className="text-xs text-white/60 mt-1">Display timestamps on camera feeds</p>
                  </div>
                  <Switch checked={settings.showTimestamps} onCheckedChange={(checked) => setSettings({ ...settings, showTimestamps: checked })} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
