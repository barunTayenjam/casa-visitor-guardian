import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, Users, UserCheck, UserX, Mail, Play, Pause, Trash2, Edit, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface VisitorSchedule {
  id: string;
  reportType: 'daily' | 'weekly' | 'monthly';
  cronExpression: string;
  recipients: string[];
  enabled: boolean;
  createdAt: string;
  nextExecution?: Date;
}

interface ReportHistory {
  id: string;
  reportType: 'daily' | 'weekly' | 'monthly';
  periodStart: string;
  periodEnd: string;
  totalVisits: number;
  uniqueVisitors: number;
  knownVisitors: number;
  unknownVisitors: number;
  createdAt: string;
  filePath?: string;
}



const VisitorReports: React.FC = () => {
  const [schedules, setSchedules] = useState<VisitorSchedule[]>([]);
  const [reportHistory, setReportHistory] = useState<ReportHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateSchedule, setShowCreateSchedule] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<VisitorSchedule | null>(null);

  // Form state for creating/editing schedules
  const [formData, setFormData] = useState({
    reportType: 'daily' as 'daily' | 'weekly' | 'monthly',
    cronExpression: '0 9 * * *', // Default: 9:00 AM daily
    recipients: [''] // Array of email addresses
  });

  // Common cron expressions
  const commonCronExpressions = {
    daily: [
      { label: '9:00 AM', value: '0 9 * * *' },
      { label: '6:00 PM', value: '0 18 * * *' },
      { label: '12:00 PM', value: '0 12 * * *' }
    ],
    weekly: [
      { label: 'Monday 9:00 AM', value: '0 9 * * 1' },
      { label: 'Friday 6:00 PM', value: '0 18 * * 5' },
      { label: 'Sunday 12:00 PM', value: '0 12 * * 0' }
    ],
    monthly: [
      { label: '1st of month 9:00 AM', value: '0 9 1 * *' },
      { label: 'Last day of month 6:00 PM', value: '0 18 L * *' },
      { label: '15th of month 12:00 PM', value: '0 12 15 * *' }
    ]
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([
          loadSchedules(),
          loadReportHistory()
        ]);
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  const loadSchedules = async () => {
    try {
      const response = await fetch('/api/visitors/schedule');
      
      if (!response.ok) {
        throw new Error('Failed to load schedules from server');
      }

      const data = await response.json();
      
      if (data.success) {
        setSchedules(data.data.schedules);
      }
    } catch (err) {
      console.error('Error loading schedules:', err);
      setError('Failed to load schedules');
      setSchedules([]);
    }
  };

  const loadReportHistory = async () => {
    try {
      const response = await fetch('/api/visitors/report/history');
      const data = await response.json();
      
      if (data.success) {
        setReportHistory(data.reports || []);
      }
    } catch (err) {
      console.error('Error loading report history:', err);
      setReportHistory([]);
    }
  };

  const handleSubmitSchedule = async () => {
    try {
      // Validate form data
      if (formData.recipients.filter(r => r.trim()).length === 0) {
        alert('Please add at least one email recipient');
        return;
      }

      const validRecipients = formData.recipients.filter(r => r.trim());
      
      const scheduleData = {
        reportType: formData.reportType,
        cronExpression: formData.cronExpression,
        recipients: validRecipients
      };

      const endpoint = editingSchedule 
        ? `/api/visitors/schedule/${editingSchedule.id}`
        : '/api/visitors/schedule';
        
      const method = editingSchedule ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scheduleData),
      });

      if (!response.ok) {
        throw new Error('Failed to save schedule');
      }

      const result = await response.json();
      
      if (result.success) {
        // Reset form and reload schedules
        setShowCreateSchedule(false);
        setEditingSchedule(null);
        setFormData({
          reportType: 'daily',
          cronExpression: '0 9 * * *',
          recipients: ['']
        });
        
        await loadSchedules();
        alert(editingSchedule ? 'Schedule updated successfully' : 'Schedule created successfully');
      } else {
        throw new Error(result.error || 'Failed to save schedule');
      }

    } catch (err) {
      console.error('Error saving schedule:', err);
      alert('Failed to save schedule');
    }
  };

  const handleToggleSchedule = async (scheduleId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/visitors/schedule/${scheduleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle schedule');
      }

      await loadSchedules();
      alert(`Schedule ${enabled ? 'enabled' : 'disabled'} successfully`);

    } catch (err) {
      console.error('Error toggling schedule:', err);
      alert('Failed to toggle schedule');
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) {
      return;
    }

    try {
      const response = await fetch(`/api/visitors/schedule/${scheduleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete schedule');
      }

      await loadSchedules();
      alert('Schedule deleted successfully');

    } catch (err) {
      console.error('Error deleting schedule:', err);
      alert('Failed to delete schedule');
    }
  };

  const handleGenerateManualReport = async (reportType: 'daily' | 'weekly' | 'monthly') => {
    try {
      // Calculate date range based on report type
      const endDate = new Date();
      const startDate = new Date();
      
      switch (reportType) {
        case 'daily':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case 'weekly':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'monthly':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
      }

      const response = await fetch('/api/visitors/report/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          includeAnalytics: true,
          includeTimeline: true
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      const result = await response.json();
      
      if (result.success) {
        alert(`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} report generated successfully!`);
        await loadReportHistory();
        
        // Optionally open the generated report
        if (result.data.reportFilePath) {
          window.open(result.data.reportFilePath, '_blank');
        }
      } else {
        throw new Error(result.error || 'Failed to generate report');
      }

    } catch (err) {
      console.error('Error generating manual report:', err);
      alert('Failed to generate report');
    }
  };

  const handleViewReport = async (reportId: string, filePath?: string) => {
    if (filePath) {
      // Open report in new tab
      window.open(filePath, '_blank');
    } else {
      // Show message that report is not available
      alert('Report file not available');
    }
  };

  const handleAddRecipient = () => {
    setFormData(prev => ({
      ...prev,
      recipients: [...prev.recipients, '']
    }));
  };

  const handleRemoveRecipient = (index: number) => {
    setFormData(prev => ({
      ...prev,
      recipients: prev.recipients.filter((_, i) => i !== index)
    }));
  };

  const handleRecipientChange = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      recipients: prev.recipients.map((r, i) => i === index ? value : r)
    }));
  };

  const getNextExecutionTime = (cronExpression: string): string => {
    // This is a simplified implementation
    // In production, you'd use a proper cron parser
    try {
      const [minute, hour] = cronExpression.split(' ');
      const now = new Date();
      const nextExecution = new Date(now);
      
      if (hour !== '*' && minute !== '*') {
        nextExecution.setHours(parseInt(hour), parseInt(minute), 0, 0);
        if (nextExecution <= now) {
          nextExecution.setDate(nextExecution.getDate() + 1);
        }
      }
      
      return nextExecution.toLocaleString();
    } catch {
      return 'Invalid cron expression';
    }
  };

  const getReportTypeColor = (type: string) => {
    switch (type) {
      case 'daily': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'weekly': return 'bg-green-100 text-green-800 border-green-200';
      case 'monthly': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Visitor Reports</h1>
            <p className="text-gray-600 mt-2">Automated visitor reporting and scheduling</p>
          </div>
          
          <div className="flex gap-4">
            <Button onClick={() => setShowCreateSchedule(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Schedule
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Daily Report</CardTitle>
              <CardDescription>Generate daily visitor summary</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full" 
                onClick={() => handleGenerateManualReport('daily')}
              >
                Generate Daily Report
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Weekly Report</CardTitle>
              <CardDescription>Generate weekly visitor analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full" 
                onClick={() => handleGenerateManualReport('weekly')}
              >
                Generate Weekly Report
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Report</CardTitle>
              <CardDescription>Generate monthly visitor trends</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full" 
                onClick={() => handleGenerateManualReport('monthly')}
              >
                Generate Monthly Report
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Scheduled Reports */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Scheduled Reports</h2>
          
          {schedules.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-gray-500">
                  <Mail className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No scheduled reports configured</p>
                  <p className="text-sm mt-2">Create a schedule to receive automated visitor reports</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {schedules.map((schedule) => (
                <motion.div
                  key={schedule.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <Mail className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold capitalize">{schedule.reportType} Report</h3>
                            <p className="text-sm text-gray-600">
                              {schedule.recipients.length} recipient{schedule.recipients.length !== 1 ? 's' : ''}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className={getReportTypeColor(schedule.reportType)}>
                                {schedule.reportType}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {schedule.cronExpression}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <div className="text-right mr-4">
                            <p className="text-xs text-gray-500">Next execution</p>
                            <p className="text-sm font-medium">
                              {schedule.nextExecution 
                                ? new Date(schedule.nextExecution).toLocaleString()
                                : getNextExecutionTime(schedule.cronExpression)
                              }
                            </p>
                          </div>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleSchedule(schedule.id, !schedule.enabled)}
                          >
                            {schedule.enabled ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingSchedule(schedule);
                              setFormData({
                                reportType: schedule.reportType,
                                cronExpression: schedule.cronExpression,
                                recipients: schedule.recipients
                              });
                              setShowCreateSchedule(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteSchedule(schedule.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Report History */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Report History</h2>
          
          {reportHistory.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No reports generated yet</p>
                  <p className="text-sm mt-2">Generated reports will appear here</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {reportHistory.map((report) => (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <Calendar className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold capitalize">{report.reportType} Report</h3>
                            <p className="text-sm text-gray-600">
                              {new Date(report.createdAt).toLocaleDateString()} at {new Date(report.createdAt).toLocaleTimeString()}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                              <span>{report.uniqueVisitors} unique visitors</span>
                              <span>{report.knownVisitors} known</span>
                              <span>{report.unknownVisitors} unknown</span>
                              <span>{report.totalVisits} total visits</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge className={getReportTypeColor(report.reportType)}>
                            {report.reportType}
                          </Badge>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewReport(report.id, report.filePath)}
                          >
                            View Report
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Create/Edit Schedule Modal */}
        <AnimatePresence>
          {(showCreateSchedule || editingSchedule) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
              onClick={() => {
                setShowCreateSchedule(false);
                setEditingSchedule(null);
              }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-lg p-6 w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold mb-4">
                  {editingSchedule ? 'Edit Schedule' : 'Create New Schedule'}
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="reportType">Report Type</Label>
                    <Select
                      value={formData.reportType}
                      onValueChange={(value: 'daily' | 'weekly' | 'monthly') =>
                        setFormData(prev => ({ ...prev, reportType: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily Report</SelectItem>
                        <SelectItem value="weekly">Weekly Report</SelectItem>
                        <SelectItem value="monthly">Monthly Report</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="cronExpression">Schedule Time</Label>
                    <Select
                      value={formData.cronExpression}
                      onValueChange={(value) =>
                        setFormData(prev => ({ ...prev, cronExpression: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {commonCronExpressions[formData.reportType].map((expr) => (
                          <SelectItem key={expr.value} value={expr.value}>
                            {expr.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="mt-2"
                      type="text"
                      placeholder="Custom cron expression (e.g., 0 9 * * *)"
                      value={formData.cronExpression}
                      onChange={(e) =>
                        setFormData(prev => ({ ...prev, cronExpression: e.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <Label>Email Recipients</Label>
                    {formData.recipients.map((recipient, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <Input
                          type="email"
                          placeholder="Enter email address"
                          value={recipient}
                          onChange={(e) => handleRecipientChange(index, e.target.value)}
                        />
                        {formData.recipients.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveRecipient(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddRecipient}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Recipient
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowCreateSchedule(false);
                      setEditingSchedule(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleSubmitSchedule}
                  >
                    {editingSchedule ? 'Update Schedule' : 'Create Schedule'}
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default VisitorReports;