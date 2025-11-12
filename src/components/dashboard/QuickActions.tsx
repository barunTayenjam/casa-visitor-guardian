import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Eye,
  EyeOff,
  MonitorSpeaker,
  Camera,
  CameraOff,
  Activity,
  AlertTriangle,
  Settings,
  Play,
  Pause,
  RotateCw,
  Zap,
  Shield,
  ShieldOff,
  ShieldCheck,
  Volume2,
  VolumeX,
  Bell,
  BellOff,
  Users,
  UserCheck,
  MapPin,
  Clock,
  Wifi,
  WifiOff,
  CheckCircle2,
  Sun,
  Moon,
  Thermometer,
  Wind,
  Droplets,
  Maximize2,
  Minimize2,
  Grid3x3,
  List,
  Calendar,
  Filter,
  Download,
  Upload,
  Scan,
  RefreshCw,
  Copy,
  Share2,
  Bookmark,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Video
} from 'lucide-react';
import { format, formatDistanceToNow, subHours, subDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  onClick: () => void;
  color: string;
}

interface SystemStatus {
  armed: boolean;
  recording: boolean;
  nightVision: boolean;
  notifications: boolean;
  motionDetection: boolean;
  faceRecognition: boolean;
  aiAnalysis: boolean;
  autoCleanup: boolean;
}

interface QuickActionsProps {
  systemStatus: SystemStatus;
  onArmDisarm: () => void;
  onStartStopRecording: () => void;
  onToggleNightVision: () => void;
  onToggleNotifications: () => void;
  onMotionDetectionToggle: () => void;
  onFaceRecognitionToggle: () => void;
  onAIAnalysisToggle: () => void;
  onSnapshotAll: () => void;
  onRecordClip: () => void;
  onExportData: () => void;
  className?: string;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  systemStatus,
  onArmDisarm,
  onStartStopRecording,
  onToggleNightVision,
  onToggleNotifications,
  onMotionDetectionToggle,
  onFaceRecognitionToggle,
  onAIAnalysisToggle,
  onSnapshotAll,
  onRecordClip,
  onExportData,
  className
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const executeAction = (actionId: string, action: () => void, isInProgress?: string) => {
    if (isInProgress) {
      setActionInProgress(isInProgress);
    }
    
    action();
    setLastAction(actionId);
    
    // Clear the action progress after a delay
    setTimeout(() => {
      setActionInProgress(null);
    }, 2000);
    
    // Clear last action
    setTimeout(() => {
      setLastAction(null);
    }, 3000);
  };

  const primaryActions: QuickAction[] = [
    {
      id: 'arm-disarm',
      title: systemStatus.armed ? 'Disarm System' : 'Arm System',
      description: systemStatus.armed ? 'Disable all security measures' : 'Enable security monitoring',
      icon: systemStatus.armed ? <ShieldOff className="w-6 h-6" /> : <Shield className="w-6 h-6" />,
      badge: systemStatus.armed ? 'ARMED' : 'DISARMED',
      onClick: () => executeAction('arm-disarm', onArmDisarm),
      color: systemStatus.armed ? 'text-red-600' : 'text-green-600'
    },
    {
      id: 'recording',
      title: systemStatus.recording ? 'Stop Recording' : 'Start Recording',
      description: systemStatus.recording ? 'Stop continuous recording' : 'Start continuous recording',
      icon: systemStatus.recording ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />,
      badge: systemStatus.recording ? 'REC' : '',
      onClick: () => executeAction('recording', onStartStopRecording, 'recording'),
      color: systemStatus.recording ? 'text-red-600' : 'text-blue-600'
    },
    {
      id: 'snapshot',
      title: 'Take Snapshot',
      description: 'Capture snapshots from all cameras',
      icon: <Camera className="w-6 h-6" />,
      onClick: () => executeAction('snapshot', onSnapshotAll, 'snapshot'),
      color: 'text-purple-600'
    },
    {
      id: 'motion-detection',
      title: 'Motion Detection',
      description: systemStatus.motionDetection ? 'Motion detection is active' : 'Enable motion detection',
      icon: <Activity className="w-6 h-6" />,
      badge: systemStatus.motionDetection ? 'ON' : 'OFF',
      onClick: () => executeAction('motion-detection', onMotionDetectionToggle),
      color: systemStatus.motionDetection ? 'text-green-600' : 'text-gray-600'
    }
  ];

  const secondaryActions: QuickAction[] = [
    {
      id: 'night-vision',
      title: 'Night Vision',
      description: systemStatus.nightVision ? 'Night vision mode active' : 'Enable night vision mode',
      icon: <Moon className="w-6 h-6" />,
      badge: systemStatus.nightVision ? 'NIGHT' : '',
      onClick: () => executeAction('night-vision', onToggleNightVision),
      color: systemStatus.nightVision ? 'text-blue-600' : 'text-gray-600'
    },
    {
      id: 'notifications',
      title: 'Notifications',
      description: systemStatus.notifications ? 'Notifications enabled' : 'Enable notifications',
      icon: <Bell className="w-6 h-6" />,
      badge: systemStatus.notifications ? 'ON' : 'OFF',
      onClick: () => executeAction('notifications', onToggleNotifications),
      color: systemStatus.notifications ? 'text-blue-600' : 'text-gray-600'
    },
    {
      id: 'face-recognition',
      title: 'Face Recognition',
      description: systemStatus.faceRecognition ? 'Face recognition active' : 'Enable face recognition',
      icon: <UserCheck className="w-6 h-6" />,
      badge: systemStatus.faceRecognition ? 'FACE' : '',
      onClick: () => executeAction('face-recognition', onFaceRecognitionToggle),
      color: systemStatus.faceRecognition ? 'text-purple-600' : 'text-gray-600'
    },
    {
      id: 'ai-analysis',
      title: 'AI Analysis',
      description: systemStatus.aiAnalysis ? 'AI analysis enabled' : 'Enable AI-powered analysis',
      icon: <Zap className="w-6 h-6" />,
      badge: systemStatus.aiAnalysis ? 'AI' : '',
      onClick: () => executeAction('ai-analysis', onAIAnalysisToggle),
      color: systemStatus.aiAnalysis ? 'text-blue-600' : 'text-gray-600'
    }
  ];

  const advancedActions: QuickAction[] = [
    {
      id: 'record-clip',
      title: 'Record Clip',
      description: 'Record a video clip from selected camera',
      icon: <Video className="w-6 h-6" />,
      onClick: () => executeAction('record-clip', onRecordClip, 'record'),
      color: 'text-orange-600'
    },
    {
      id: 'export-data',
      title: 'Export Data',
      description: 'Export logs and recordings',
      icon: <Download className="w-6 h-6" />,
      onClick: () => executeAction('export-data', onExportData, 'export'),
      color: 'text-indigo-600'
    },
    {
      id: 'auto-cleanup',
      title: 'Auto Cleanup',
      description: systemStatus.autoCleanup ? 'Auto cleanup enabled' : 'Enable auto cleanup',
      icon: <RefreshCw className="w-6 h-6" />,
      badge: systemStatus.autoCleanup ? 'AUTO' : '',
      onClick: () => {},
      color: systemStatus.autoCleanup ? 'text-green-600' : 'text-gray-600'
    }
  ];

  const ActionCard = ({ action, size = 'default' }: { action: QuickAction; size?: 'default' | 'large' }) => (
    <Card 
      className={cn(
        "group relative overflow-hidden cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95",
        size === 'large' ? "p-6" : "p-4",
        "bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 hover:border-slate-600",
        actionInProgress === action.id && "ring-2 ring-blue-500"
      )}
      onClick={action.onClick}
    >
      <div className={cn(
        "flex flex-col items-center space-y-3",
        size === 'large' ? "space-y-4" : "space-y-3"
      )}>
        {/* Icon and Badge */}
        <div className="relative">
          <div className={cn(
            "p-3 rounded-full bg-slate-800 text-gray-400 group-hover:text-white transition-colors",
            size === 'large' ? "p-4" : "p-3",
            action.color.replace('text-', 'bg-')
          )}>
            {action.icon}
          </div>
          {action.badge && (
            <div className={cn(
              "absolute -top-1 -right-1 px-2 py-1 text-xs font-bold rounded-full",
              action.color.replace('text-', 'bg-') + ' text-white'
            )}>
              {action.badge}
            </div>
          )}
          {lastAction === action.id && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
          )}
        </div>

        {/* Title and Description */}
        <div className={cn(
          "text-center",
          size === 'large' ? "space-y-2" : "space-y-1"
        )}>
          <h3 className={cn(
            "font-semibold transition-colors",
            size === 'large' ? "text-lg" : "text-sm",
            action.color
          )}>
            {action.title}
          </h3>
          {size === 'large' && (
            <p className="text-gray-400 text-sm leading-relaxed">
              {action.description}
            </p>
          )}
          {size === 'default' && (
            <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">
              {action.description}
            </p>
          )}
        </div>
      </div>

      {/* Loading Indicator */}
      {actionInProgress === action.id && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
          <RefreshCw className="w-6 h-6 text-white animate-spin" />
        </div>
      )}
    </Card>
  );

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center space-x-3">
            <Zap className="w-8 h-8 text-yellow-500" />
            Quick Actions
          </h2>
          <p className="text-gray-400">
            Control your security system with one click
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            className="text-white border-slate-600 hover:bg-slate-700"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <MoreHorizontal className="w-4 h-4" />
            )}
            <span className="ml-2">
              {showAdvanced ? 'Less' : 'More'}
            </span>
          </Button>
        </div>
      </div>

      {/* Primary Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {primaryActions.map((action) => (
          <ActionCard key={action.id} action={action} />
        ))}
      </div>

      {/* Secondary Actions */}
      {showAdvanced && (
        <div className="space-y-4">
          <div className="flex items-center space-x-2 text-white">
            <ChevronRight className="w-4 h-4" />
            <span className="text-sm font-medium">Advanced Controls</span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {secondaryActions.map((action) => (
              <ActionCard key={action.id} action={action} size="default" />
            ))}
          </div>

          {/* Additional Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-700">
            {advancedActions.map((action) => (
              <ActionCard key={action.id} action={action} size="default" />
            ))}
          </div>
        </div>
      )}

      {/* Status Indicator */}
      <Card className="bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={cn(
                "w-3 h-3 rounded-full",
                systemStatus.armed ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
              )} />
              <span className="text-white font-medium">
                System {systemStatus.armed ? 'Armed' : 'Disarmed'}
              </span>
            </div>
            
            <div className="flex items-center space-x-6 text-sm text-gray-400">
              <div className="flex items-center space-x-1">
                <MonitorSpeaker className="w-4 h-4" />
                <span>{systemStatus.recording ? 'Recording' : 'Standby'}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Activity className="w-4 h-4" />
                <span>Motion: {systemStatus.motionDetection ? 'On' : 'Off'}</span>
              </div>
              <div className="flex items-center space-x-1">
                <UserCheck className="w-4 h-4" />
                <span>AI: {systemStatus.aiAnalysis ? 'Active' : 'Standby'}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Last Action Feedback */}
      {lastAction && (
        <div className="fixed bottom-4 right-4 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg border border-slate-600 flex items-center space-x-2 z-50">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span className="text-sm">
            {primaryActions.find(a => a.id === lastAction)?.title || 
             secondaryActions.find(a => a.id === lastAction)?.title || 
             advancedActions.find(a => a.id === lastAction)?.title} 
            completed
          </span>
        </div>
      )}
    </div>
  );
};

export default QuickActions;