import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  CheckCircle,
  AlertTriangle,
  Users,
  MessageSquare,
  BarChart3,
  Calendar
} from 'lucide-react';
import { useFeedback } from '@/contexts/FeedbackContext';
import { FeedbackSubmission } from '@/types/feedback';
import { userManagementService, User } from '@/services/userManagementService';

type DateRangeFilter = 'all' | '30';

interface FeedbackResolutionDashboardProps {
  projectId: string;
}

export function FeedbackResolutionDashboard({ projectId }: FeedbackResolutionDashboardProps) {
  const { submissions, loading } = useFeedback();
  const [dateRange, setDateRange] = useState<DateRangeFilter>('all');
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  useEffect(() => {
    userManagementService.getUsers({ limit: 500 })
      .then(res => {
        const map: Record<string, string> = {};
        (res.users ?? []).forEach((u: User) => {
          map[u.id] = `${u.firstName} ${u.lastName}`.trim() || u.email;
        });
        setUserMap(map);
      })
      .catch(() => {});
  }, []);

  const resolveUserName = (id: string) => userMap[id] ?? id;

  const isResolvedOrClosed = (sub: FeedbackSubmission) =>
    sub.status === 'RESOLVED' || sub.status === 'CLOSED';

  // Completion date: when the submission was resolved or closed (backend sets resolvedAt/closedAt on status update).
  // We use only these so analytics reflect the actual completion event, not other edits.
  const getCompletionDate = (sub: FeedbackSubmission): Date | null => {
    if (sub.status === 'RESOLVED' && sub.resolvedAt) return new Date(sub.resolvedAt);
    if (sub.status === 'CLOSED' && sub.closedAt) return new Date(sub.closedAt);
    return null;
  };

  // Submissions filtered by date range (last 30 days or all)
  const filteredSubmissions = useMemo(() => {
    if (dateRange !== '30') return submissions;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return submissions.filter(sub => new Date(sub.submittedAt) >= cutoff);
  }, [submissions, dateRange]);

  // Calculate real metrics from submissions data
  const calculateMetrics = (subs: FeedbackSubmission[]) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    // Filter submissions by time periods
    const currentMonthSubmissions = subs.filter(sub => {
      const date = new Date(sub.submittedAt);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const lastMonthSubmissions = subs.filter(sub => {
      const date = new Date(sub.submittedAt);
      return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear;
    });

    // Resolution metrics: use current status only (each submission has one final state).
    // "Resolved this month" = current status is RESOLVED/CLOSED and completion date (resolvedAt/closedAt) is in current month.
    const resolvedSubmissions = subs.filter(sub => isResolvedOrClosed(sub));
    const resolvedThisMonth = resolvedSubmissions.filter(sub => {
      const completed = getCompletionDate(sub);
      if (!completed) return false;
      return completed.getMonth() === currentMonth && completed.getFullYear() === currentYear;
    });

    // Calculate average resolution time (uses resolvedAt or closedAt)
    const averageResolutionTime = calculateAverageResolutionTime(resolvedSubmissions);

    // Calculate escalation rate (status ESCALATED or escalationLevel not NONE)
    const escalatedSubmissions = subs.filter(sub =>
      sub.status === 'ESCALATED' || (sub.escalationLevel && sub.escalationLevel !== 'NONE')
    );
    const escalationRate = subs.length > 0
      ? (escalatedSubmissions.length / subs.length * 100).toFixed(1)
      : '0';

    // Calculate active and overdue cases
    const activeCases = subs.filter(sub =>
      ['SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(sub.status)
    ).length;

    const overdueCases = subs.filter(sub => {
      if (!['SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(sub.status)) return false;
      const submittedDate = new Date(sub.submittedAt);
      const daysSinceSubmission = Math.floor((now.getTime() - submittedDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysSinceSubmission > 7; // Consider overdue after 7 days
    }).length;

    // Calculate team workload
    const teamWorkload = calculateTeamWorkload(subs);

    return {
      totalSubmissions: subs.length,
      resolvedThisMonth: resolvedThisMonth.length,
      averageResolutionTime,
      escalationRate: `${escalationRate}%`,
      activeCases,
      overdueCases,
      teamWorkload
    };
  };

  // Average resolution/closure time: only submissions with a real completion date (resolvedAt or closedAt).
  const calculateAverageResolutionTime = (resolvedSubmissions: FeedbackSubmission[]): string => {
    const withDate = resolvedSubmissions.filter(s => getCompletionDate(s) != null);
    if (withDate.length === 0) return 'N/A';

    const totalDays = withDate.reduce((sum, submission) => {
      const submittedAt = new Date(submission.submittedAt);
      const completed = getCompletionDate(submission)!;
      const diffDays = Math.ceil(Math.abs(completed.getTime() - submittedAt.getTime()) / (1000 * 60 * 60 * 24));
      return sum + diffDays;
    }, 0);

    const averageDays = (totalDays / withDate.length).toFixed(1);
    return `${averageDays} days`;
  };

  // Calculate team workload
  const calculateTeamWorkload = (submissions: FeedbackSubmission[]) => {
    const workload: Record<string, number> = {};
    
    submissions.forEach(submission => {
      if (submission.assignedTo && ['SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(submission.status)) {
        workload[submission.assignedTo] = (workload[submission.assignedTo] || 0) + 1;
      }
    });

    return workload;
  };

  // Helper: average resolution/closure days (only submissions with resolvedAt/closedAt).
  const getAvgResolutionDays = (resolvedSubs: FeedbackSubmission[]): number | null => {
    const withDate = resolvedSubs.filter(sub => getCompletionDate(sub) != null);
    if (withDate.length === 0) return null;
    const totalDays = withDate.reduce((sum, sub) => {
      const submittedAt = new Date(sub.submittedAt);
      const endAt = getCompletionDate(sub)!;
      const diffDays = Math.ceil(Math.abs(endAt.getTime() - submittedAt.getTime()) / (1000 * 60 * 60 * 24));
      return sum + diffDays;
    }, 0);
    return totalDays / withDate.length;
  };

  // Calculate trends from real data (current month vs previous month)
  const calculateTrends = (subs: FeedbackSubmission[]) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const currentMonthSubs = subs.filter(sub => {
      const date = new Date(sub.submittedAt);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });
    const lastMonthSubs = subs.filter(sub => {
      const date = new Date(sub.submittedAt);
      return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear;
    });

    const currentCount = currentMonthSubs.length;
    const previousCount = lastMonthSubs.length;
    const submissionChange = previousCount > 0 ? ((currentCount - previousCount) / previousCount * 100) : 0;

    const isEscalated = (sub: FeedbackSubmission) =>
      sub.status === 'ESCALATED' || (sub.escalationLevel && sub.escalationLevel !== 'NONE');
    const currentEscalated = currentMonthSubs.filter(isEscalated).length;
    const previousEscalated = lastMonthSubs.filter(isEscalated).length;
    const escalationChange = previousEscalated > 0
      ? ((currentEscalated - previousEscalated) / previousEscalated * 100)
      : (currentEscalated > 0 ? 100 : 0);

    const currentResolved = subs.filter(sub => {
      const d = getCompletionDate(sub);
      return d != null && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const lastResolved = subs.filter(sub => {
      const d = getCompletionDate(sub);
      return d != null && d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
    });
    const currentAvgDays = getAvgResolutionDays(currentResolved);
    const previousAvgDays = getAvgResolutionDays(lastResolved);
    let resolutionTimeChange = 0;
    if (previousAvgDays != null && previousAvgDays > 0 && currentAvgDays != null) {
      resolutionTimeChange = ((currentAvgDays - previousAvgDays) / previousAvgDays) * 100;
    }

    return {
      submissions: {
        current: currentCount,
        previous: previousCount,
        change: submissionChange.toFixed(1),
        trend: submissionChange >= 0 ? 'up' : 'down'
      },
      resolutionTime: {
        current: currentAvgDays ?? 0,
        previous: previousAvgDays ?? 0,
        change: resolutionTimeChange,
        trend: resolutionTimeChange <= 0 ? 'down' : 'up' // down = improvement (faster resolution)
      },
      escalations: {
        current: currentEscalated,
        previous: previousEscalated,
        change: escalationChange.toFixed(1),
        trend: escalationChange <= 0 ? 'down' : 'up'
      }
    };
  };

  const metrics = useMemo(() => calculateMetrics(filteredSubmissions), [filteredSubmissions]);
  const trends = useMemo(() => calculateTrends(filteredSubmissions), [filteredSubmissions]);

  // Helper function to format time ago
  const getTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return `${Math.floor(diffInSeconds / 2592000)} months ago`;
  };

  /** Icon that matches the actual trend: up arrow (increase), down arrow (decrease), minus (no change). */
  const getTrendIcon = (trend: string, change?: number) => {
    if (change !== undefined && Math.abs(change) < 0.01) {
      return <Minus className="w-4 h-4 text-gray-500" />;
    }
    return trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />;
  };

  const getTrendColor = (trend: string, change: number) => {
    if (Math.abs(change) < 0.01) return 'text-gray-500';
    if (trend === 'up') {
      return change > 0 ? 'text-green-600' : 'text-red-600';
    } else {
      return change < 0 ? 'text-green-600' : 'text-red-600';
    }
  };

  const handleExportReport = () => {
    const resolved = filteredSubmissions.filter(s => isResolvedOrClosed(s));
    const active = filteredSubmissions.filter(s => ['SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(s.status));
    const escalated = filteredSubmissions.filter(s =>
      s.status === 'ESCALATED' || (s.escalationLevel && s.escalationLevel !== 'NONE')
    );

    const rows: string[] = [
      'Feedback Resolution Report',
      `Generated,${new Date().toISOString()}`,
      `Period,${dateRange === '30' ? 'Last 30 days' : 'All time'}`,
      '',
      'Summary',
      `Total Submissions,${metrics.totalSubmissions}`,
      `Resolved / Closed This Month,${metrics.resolvedThisMonth}`,
      `Avg Resolution Time,${metrics.averageResolutionTime}`,
      `Active Cases,${metrics.activeCases}`,
      `Overdue Cases (>7 days),${metrics.overdueCases}`,
      `Escalation Rate,${metrics.escalationRate}`,
      `Escalated Count,${escalated.length}`,
      '',
      'Month-over-Month Trends',
      `Submissions Change,${trends.submissions.change}%`,
      `Resolution Time Change,${trends.resolutionTime.change.toFixed(1)}%`,
      `Escalation Change,${trends.escalations.change}%`,
      '',
      'Status Breakdown',
      `Submitted,${filteredSubmissions.filter(s => s.status === 'SUBMITTED').length}`,
      `Acknowledged,${filteredSubmissions.filter(s => s.status === 'ACKNOWLEDGED').length}`,
      `In Progress,${filteredSubmissions.filter(s => s.status === 'IN_PROGRESS').length}`,
      `Resolved,${filteredSubmissions.filter(s => s.status === 'RESOLVED').length}`,
      `Closed,${filteredSubmissions.filter(s => s.status === 'CLOSED').length}`,
      `Escalated,${filteredSubmissions.filter(s => s.status === 'ESCALATED').length}`,
      '',
      'Team Workload (active cases)',
      'Team Member,Active Cases',
      ...Object.entries(metrics.teamWorkload)
        .sort(([, a], [, b]) => b - a)
        .map(([memberId, count]) => `"${resolveUserName(memberId)}",${count}`),
      '',
      'All Submissions',
      'Title,Status,Priority,Submitted,Completed,Assigned To',
      ...filteredSubmissions
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
        .map(s => {
          const title = (s.data?.title || s.data?.description || s.category?.name || 'Feedback').replace(/"/g, '""');
          const completed = getCompletionDate(s);
          const completedStr = completed ? completed.toISOString() : '';
          const assignee = s.assignedTo ? resolveUserName(s.assignedTo).replace(/"/g, '""') : '';
          return `"${title}",${s.status},${s.priority},${new Date(s.submittedAt).toISOString()},${completedStr},"${assignee}"`;
        })
    ];
    const csv = rows.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feedback-resolution-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Feedback Resolution Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Monitor and track feedback resolution performance and team workload
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangeFilter)}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleExportReport}>
            <BarChart3 className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Submissions</p>
                <p className="text-2xl font-bold">{metrics.totalSubmissions}</p>
                <div className="flex items-center gap-1 mt-1">
                  {getTrendIcon(trends.submissions.trend, parseFloat(trends.submissions.change))}
                  <span className={`text-sm ${getTrendColor(trends.submissions.trend, parseFloat(trends.submissions.change))}`}>
                    {parseFloat(trends.submissions.change) > 0 ? '+' : ''}{trends.submissions.change}% vs last month
                  </span>
                </div>
              </div>
              <MessageSquare className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Resolved / closed this month</p>
                <p className="text-2xl font-bold">{metrics.resolvedThisMonth}</p>
                <div className="flex items-center gap-1 mt-1">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-600">
                    {metrics.totalSubmissions > 0 ? Math.round((metrics.resolvedThisMonth / metrics.totalSubmissions) * 100) : 0}% resolution rate
                  </span>
                </div>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Resolution Time</p>
                <p className="text-2xl font-bold">{metrics.averageResolutionTime}</p>
                <div className="flex items-center gap-1 mt-1">
                  {trends.resolutionTime.previous > 0 || trends.resolutionTime.current > 0 ? (
                    <>
                      {getTrendIcon(trends.resolutionTime.trend, trends.resolutionTime.change)}
                      <span className={`text-sm ${getTrendColor(trends.resolutionTime.trend, trends.resolutionTime.change)}`}>
                        {trends.resolutionTime.change > 0 ? '+' : ''}{trends.resolutionTime.change.toFixed(1)}% vs last month
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-gray-500">No trend data</span>
                  )}
                </div>
              </div>
              <Clock className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Escalation Rate</p>
                <p className="text-2xl font-bold">{metrics.escalationRate}</p>
                <div className="flex items-center gap-1 mt-1">
                  {getTrendIcon(trends.escalations.trend, parseFloat(trends.escalations.change))}
                  <span className={`text-sm ${getTrendColor(trends.escalations.trend, parseFloat(trends.escalations.change))}`}>
                    {parseFloat(trends.escalations.change) > 0 ? '+' : ''}{trends.escalations.change}% vs last month
                  </span>
                </div>
              </div>
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Overview and Team Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Status Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                  <span className="font-medium">Active Cases</span>
                </div>
                <Badge variant="default">{metrics.activeCases}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  <span className="font-medium">Overdue Cases</span>
                </div>
                <Badge variant="destructive">{metrics.overdueCases}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-red-600" />
                  <span className="font-medium">Escalation Rate</span>
                </div>
                <Badge variant="destructive">{metrics.escalationRate}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Team Workload */}
        <Card>
          <CardHeader>
            <CardTitle>Team Workload</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const entries = Object.entries(metrics.teamWorkload)
                .sort(([, a], [, b]) => b - a);
              if (entries.length === 0) {
                return (
                  <div className="text-center py-6 text-gray-500">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No active cases assigned to team members.</p>
                  </div>
                );
              }
              const maxWorkload = Math.max(...entries.map(([, v]) => v), 1);
              return (
                <div className="space-y-4">
                  {entries.map(([memberId, workload]) => (
                    <div key={memberId} className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <Users className="w-4 h-4 text-gray-500 shrink-0" />
                        <span className="font-medium truncate">{resolveUserName(memberId)}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              workload > 6 ? 'bg-red-500' :
                              workload > 3 ? 'bg-orange-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min((workload / maxWorkload) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 w-8 text-right">
                          {workload}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity: one row per submission (deduped by id), showing status and relevant date together */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Resolution Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(() => {
              const seen = new Set<string>();
              const uniqueSubmissions = filteredSubmissions.filter(s => {
                if (seen.has(s.id)) return false;
                seen.add(s.id);
                return true;
              });
              return uniqueSubmissions
                .sort((a, b) => {
                  const aDate = getCompletionDate(a) || new Date(a.updatedAt);
                  const bDate = getCompletionDate(b) || new Date(b.updatedAt);
                  return bDate.getTime() - aDate.getTime();
                })
                .slice(0, 5)
                .map((submission) => {
                  const completed = getCompletionDate(submission);
                  const displayDate = completed ?? new Date(submission.updatedAt);
                  const timeAgo = getTimeAgo(displayDate);
                  const dateLabel = completed
                    ? (submission.status === 'CLOSED' ? 'Closed ' : 'Resolved ') + timeAgo
                    : 'Updated ' + timeAgo;
                  const title = submission.data?.title || submission.data?.description || `${submission.category?.name || 'Feedback'} Submission`;
                  return (
                    <div key={submission.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-gray-100 rounded-full shrink-0">
                          {isResolvedOrClosed(submission) ? <CheckCircle className="w-4 h-4 text-green-600" /> :
                           submission.status === 'ESCALATED' ? <AlertTriangle className="w-4 h-4 text-red-600" /> :
                           submission.status === 'ACKNOWLEDGED' ? <MessageSquare className="w-4 h-4 text-blue-600" /> :
                           <Clock className="w-4 h-4 text-orange-600" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{title}</p>
                          <p className="text-sm text-gray-500">by {submission.assignedTo ? resolveUserName(submission.assignedTo) : 'Unassigned'}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant={isResolvedOrClosed(submission) ? 'default' : 'secondary'}>
                          {submission.status.replace('_', ' ')}
                        </Badge>
                        <p className="text-sm text-gray-500 mt-1">{dateLabel}</p>
                      </div>
                    </div>
                  );
                });
            })()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
