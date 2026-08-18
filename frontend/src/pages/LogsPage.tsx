import { useEffect, useState } from 'react';
import { apiClient } from '../services/api/baseClient';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

interface LogEntry {
  id: string;
  timestamp: string;
  service: string;
  level: string;
  module?: string;
  camera_id?: string;
  message: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    apiClient.get<{ logs: LogEntry[] }>('/system/logs').then((res) => setLogs(res.logs));
  }, []);

  return (
    <Card className="w-full">
      <CardHeader><CardTitle>System Logs</CardTitle></CardHeader>
      <CardContent className="h-[600px] overflow-auto font-mono text-xs">
        {logs.map((log) => (
          <div key={log.id} className="border-b py-1">
            [{log.timestamp}] {log.level.toUpperCase()} [{log.service}] {log.module || ''} - {log.message}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
