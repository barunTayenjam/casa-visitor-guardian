import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { logger, LogEntry } from '@/lib/logger';
import { Download, Trash2, RefreshCw, Settings, Filter, Search } from 'lucide-react';

interface LogViewerProps {
  className?: string;
}

export function LogViewer({ className }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [config, setConfig] = useState(logger.getConfiguration());
  const [filter, setFilter] = useState({
    level: 'ALL' as 'ALL' | 'INFO' | 'WARN' | 'ERROR' | 'DEBUG',
    source: '',
    search: ''
  });
  const [showSettings, setShowSettings] = useState(false);
  const [remoteEndpoint, setRemoteEndpoint] = useState(config.remoteEndpoint || '');
  
  useEffect(() => {
    const applyFilters = () => {
      let filtered = [...logs];
      
      if (filter.level !== 'ALL') {
        filtered = filtered.filter(log => log.level === filter.level);
      }
      
      if (filter.source) {
        filtered = filtered.filter(log => 
          log.source?.toLowerCase().includes(filter.source.toLowerCase())
        );
      }
      
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        filtered = filtered.filter(log => 
          log.message.toLowerCase().includes(searchLower) ||
          log.source?.toLowerCase().includes(searchLower) ||
          JSON.stringify(log.metadata).toLowerCase().includes(searchLower)
        );
      }
      
      setFilteredLogs(filtered.reverse()); // Show newest first
    };

    loadLogs();
    const interval = setInterval(loadLogs, 1000); // Refresh every second
    return () => clearInterval(interval);
  }, [filter, logs]);

  useEffect(() => {
    const applyFilters = () => {
      let filtered = [...logs];
      
      if (filter.level !== 'ALL') {
        filtered = filtered.filter(log => log.level === filter.level);
      }
      
      if (filter.source) {
        filtered = filtered.filter(log => 
          log.source?.toLowerCase().includes(filter.source.toLowerCase())
        );
      }
      
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        filtered = filtered.filter(log => 
          log.message.toLowerCase().includes(searchLower) ||
          log.source?.toLowerCase().includes(searchLower) ||
          JSON.stringify(log.metadata).toLowerCase().includes(searchLower)
        );
      }
      
      setFilteredLogs(filtered.reverse()); // Show newest first
    };
    
    applyFilters();
  }, [logs, filter]);
  
  const loadLogs = () => {
    const recentLogs = logger.getRecentLogs(200);
    setLogs(recentLogs);
  };
  
  
  const clearLogs = () => {
    logger.clearLogs();
    setLogs([]);
    setFilteredLogs([]);
  };
  
  const exportLogs = () => {
    const data = logger.exportLogs();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const updateConfig = (updates: Partial<typeof config>) => {
    const newConfig = { ...config, ...updates };
    logger.configure(newConfig);
    setConfig(newConfig);
  };
  
  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'ERROR': return 'destructive';
      case 'WARN': return 'secondary';
      case 'DEBUG': return 'outline';
      case 'INFO': return 'default';
      default: return 'default';
    }
  };
  
  const formatLogEntry = (entry: LogEntry) => {
    const date = new Date(entry.timestamp);
    const timeString = date.toLocaleTimeString();
    const dateString = date.toLocaleDateString();
    
    return {
      ...entry,
      timeString,
      dateString
    };
  };
  
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Application Logs</CardTitle>
            <CardDescription>
              Real-time application logs and debugging information
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={loadLogs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportLogs}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={clearLogs}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {showSettings && (
          <div className="mt-4 p-4 bg-muted rounded-lg space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Switch 
                  id="console-logging"
                  checked={config.enableConsoleLogging}
                  onCheckedChange={(checked) => updateConfig({ enableConsoleLogging: checked })}
                />
                <Label htmlFor="console-logging">Console Logging</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch 
                  id="storage-logging"
                  checked={config.enableLocalStorage}
                  onCheckedChange={(checked) => updateConfig({ enableLocalStorage: checked })}
                />
                <Label htmlFor="storage-logging">Local Storage</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch 
                  id="remote-logging"
                  checked={config.enableRemoteLogging}
                  onCheckedChange={(checked) => updateConfig({ enableRemoteLogging: checked })}
                />
                <Label htmlFor="remote-logging">Remote Logging</Label>
              </div>
            </div>
            
            {config.enableRemoteLogging && (
              <div className="space-y-2">
                <Label htmlFor="remote-endpoint">Remote Endpoint</Label>
                <Input
                  id="remote-endpoint"
                  placeholder="https://your-log-server.com/logs"
                  value={remoteEndpoint}
                  onChange={(e) => setRemoteEndpoint(e.target.value)}
                  onBlur={() => updateConfig({ remoteEndpoint })}
                />
              </div>
            )}
            
            <div className="text-sm text-muted-foreground">
              Total logs: {config.totalLogs} / {config.maxLogs}
            </div>
          </div>
        )}
        
        <div className="flex flex-wrap gap-2 mt-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4" />
            <Select value={filter.level} onValueChange={(value: 'ALL' | 'INFO' | 'WARN' | 'ERROR' | 'DEBUG') => setFilter(prev => ({ ...prev, level: value }))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Levels</SelectItem>
                <SelectItem value="ERROR">Errors</SelectItem>
                <SelectItem value="WARN">Warnings</SelectItem>
                <SelectItem value="INFO">Info</SelectItem>
                <SelectItem value="DEBUG">Debug</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Input
            placeholder="Filter by source..."
            value={filter.source}
            onChange={(e) => setFilter(prev => ({ ...prev, source: e.target.value }))}
            className="w-40"
          />
          
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={filter.search}
              onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <ScrollArea className="h-96 w-full rounded-md border">
          <div className="p-4 space-y-2">
            {filteredLogs.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No logs found matching the current filters
              </div>
            ) : (
              filteredLogs.map((entry, index) => {
                const formatted = formatLogEntry(entry);
                return (
                  <div key={index} className="border-b pb-2 last:border-b-0">
                    <div className="flex items-start space-x-2">
                      <Badge variant={getLevelColor(entry.level)} className="shrink-0">
                        {entry.level}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm text-muted-foreground">
                            {formatted.timeString}
                          </span>
                          {entry.source && (
                            <Badge variant="outline" className="text-xs">
                              {entry.source}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm mt-1">
                          {entry.message}
                        </div>
                        {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                          <details className="mt-1">
                            <summary className="text-xs text-muted-foreground cursor-pointer">
                              Metadata
                            </summary>
                            <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                              {JSON.stringify(entry.metadata, null, 2)}
                            </pre>
                          </details>
                        )}
                        {entry.error && (
                          <details className="mt-1">
                            <summary className="text-xs text-red-600 cursor-pointer">
                              Error Details
                            </summary>
                            <pre className="text-xs bg-red-50 p-2 rounded mt-1 overflow-x-auto text-red-800">
                              {JSON.stringify(entry.error, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default LogViewer;