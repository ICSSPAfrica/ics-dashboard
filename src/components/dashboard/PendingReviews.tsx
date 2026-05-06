import React from 'react';
import { 
  Clock, 
  AlertTriangle, 
  FileText, 
  Eye, 
  CheckCircle, 
  Calendar,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge as BadgeComponent } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { reportWorkflowService } from '@/services/reportWorkflowService';
import { reportService } from '@/services/reportService';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ReportWorkflowDetail } from './ReportWorkflowDetail';
import { BulkReviewActions } from './BulkReviewActions';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api/client';

interface PendingReviewsProps {
  projectId?: string;
  refreshTrigger?: number; // When this changes, refresh the list
}

export function PendingReviews({ projectId, refreshTrigger }: PendingReviewsProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  if (!user) return null;

  const [pendingReviews, setPendingReviews] = React.useState<any[]>([]);
  const [submittedPendingReview, setSubmittedPendingReview] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [openDetailId, setOpenDetailId] = React.useState<string | null>(null);
  const [selectedReports, setSelectedReports] = React.useState<Set<string>>(new Set());
  const [availableUsers, setAvailableUsers] = React.useState<any[]>([]);

  const loadPendingReviews = React.useCallback(async () => {
    setLoading(true);
    try {
      const [pending, mine] = await Promise.all([
        reportWorkflowService.getPendingReviews(projectId),
        reportWorkflowService.getMyReports(projectId, 'PENDING'),
      ]);
      console.log('[PendingReviews] Pending reviews response:', {
        total: pending.total,
        count: pending.reports?.length || 0,
        reports: pending.reports?.map((r: any) => ({ id: r.id, name: r.name, status: r.status }))
      });
      console.log('[PendingReviews] My submitted reports:', {
        total: mine.total,
        count: mine.reports?.length || 0,
        reports: mine.reports?.map((r: any) => ({ id: r.id, name: r.name, status: r.status }))
      });
      const pendingNormalized = (pending.reports || []).map((r: any) => ({ ...r, workflowStatus: r.status }));
      const mineNormalized = (mine.reports || []).map((r: any) => ({ ...r, workflowStatus: r.status }));
      setPendingReviews(pendingNormalized);
      setSubmittedPendingReview(mineNormalized);
    } catch (e) {
      console.error('Failed to load workflow lists:', e);
      setPendingReviews([]);
      setSubmittedPendingReview([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    loadPendingReviews();
    
    // Load available users for bulk operations
    if (projectId) {
      apiClient.get<{ users: any[] }>(`/projects/${projectId}/users?limit=100`)
        .then((response) => {
          if (response.success && response.data?.users) {
            setAvailableUsers(response.data.users);
          }
        })
        .catch((e) => console.warn('Failed to load users:', e));
    }
  }, [projectId, refreshTrigger, loadPendingReviews]);

  const toggleReportSelection = (reportId: string) => {
    setSelectedReports(prev => {
      const next = new Set(prev);
      if (next.has(reportId)) {
        next.delete(reportId);
      } else {
        next.add(reportId);
      }
      return next;
    });
  };

  const handleQuickApprove = async (reportId: string) => {
    try {
      await reportWorkflowService.review(reportId, 'APPROVE');
      toast({ title: 'Approved', description: 'Report approved successfully.' });
      await loadPendingReviews();
    } catch (e: any) {
      toast({ title: 'Approval Failed', description: e?.message || 'Failed to approve report', variant: 'destructive' });
    }
  };

  const handleQuickRequestChanges = async (reportId: string) => {
    const note = window.prompt('Please provide details on what changes are required:');
    if (!note) return;
    
    try {
      await reportWorkflowService.review(reportId, 'REQUEST_CHANGES', note);
      toast({ title: 'Changes Requested', description: 'Request for changes has been submitted.' });
      await loadPendingReviews();
    } catch (e: any) {
      toast({ title: 'Request Failed', description: e?.message || 'Failed to request changes', variant: 'destructive' });
    }
  };

  const getAuthLevelDisplayName = (level: string): string => {
    const displayNames: Record<string, string> = {
      'branch-admin': 'Branch Administrator',
      'project-admin': 'Project Administrator', 
      'country-admin': 'Country Administrator',
      'global-admin': 'Global Administrator'
    };
    return displayNames[level] || level;
  };

  const getStatusBadge = (status: string) => {
    const normalizedStatus = (status || '').toLowerCase().replace(/_/g, '-');
    const variants: Record<string, string> = {
      'in-progress': 'bg-blue-100 text-blue-800',
      'in_review': 'bg-blue-100 text-blue-800',
      'in review': 'bg-blue-100 text-blue-800',
      'pending': 'bg-yellow-100 text-yellow-800',
      'approved': 'bg-green-100 text-green-800',
      'rejected': 'bg-red-100 text-red-800',
      'changes-requested': 'bg-orange-100 text-orange-800',
      'changes_requested': 'bg-orange-100 text-orange-800',
      'cancelled': 'bg-gray-100 text-gray-800',
    };
    return variants[normalizedStatus] || variants.pending;
  };

  const getCategoryBadge = (category: string) => {
    const normalizedCategory = (category || '').toLowerCase();
    const variants: Record<string, string> = {
      'weekly': 'bg-cyan-100 text-cyan-800',
      'bimonthly': 'bg-teal-100 text-teal-800',
      'monthly': 'bg-green-100 text-green-800',
      'quarterly': 'bg-blue-100 text-blue-800',
      'bi-annual': 'bg-indigo-100 text-indigo-800',
      'bi_annual': 'bg-indigo-100 text-indigo-800',
      'annual': 'bg-purple-100 text-purple-800',
      'adhoc': 'bg-gray-100 text-gray-800',
      'special': 'bg-pink-100 text-pink-800',
      'financial': 'bg-yellow-100 text-yellow-800',
      'technical': 'bg-orange-100 text-orange-800',
    };
    return variants[normalizedCategory] || variants.adhoc;
  };

  const handleViewReport = async (report: any) => {
    try {
      if (!projectId) throw new Error('Missing projectId');
      await reportService.downloadReportFile(projectId, report.id);
    } catch (e: any) {
      toast({ title: 'Download Failed', description: e?.message || 'Unable to download report', variant: 'destructive' });
    }
  };

  const handleOpenReview = (report: any) => {
    setOpenDetailId(report.id);
  };

  const handleReview = async (reportId: string, action: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES') => {
    try {
      await reportWorkflowService.review(reportId, action);
      toast({ title: 'Success', description: `Review submitted: ${action}` });
      // Refresh lists
      const [pending, mine] = await Promise.all([
        reportWorkflowService.getPendingReviews(projectId),
        reportWorkflowService.getMyReports(projectId, 'PENDING'),
      ]);
      setPendingReviews(pending.reports || []);
      setSubmittedPendingReview(mine.reports || []);
    } catch (e: any) {
      toast({ title: 'Review Failed', description: e?.message || 'Unable to submit review', variant: 'destructive' });
    }
  };

  const handleRefresh = React.useCallback(async () => {
    await loadPendingReviews();
  }, [loadPendingReviews]);

  if (loading) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading pending reviews...</p>
        </CardContent>
      </Card>
    );
  }

  if (!loading && pendingReviews.length === 0 && submittedPendingReview.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Pending Reviews</h3>
          <p className="text-muted-foreground">
            You have no reports pending your review or approval.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Dialog open={!!openDetailId} onOpenChange={(o) => !o && setOpenDetailId(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <div className="sr-only" id="report-dialog-title">Report Review</div>
          <div className="sr-only" id="report-dialog-desc">Review report details and take action</div>
          {openDetailId && (
            <ReportWorkflowDetail 
              reportId={openDetailId} 
              onClose={() => setOpenDetailId(null)}
              onChanged={handleRefresh}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Pending Your Review</p>
                <p className="text-2xl font-bold">{pendingReviews.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Your Reports Pending</p>
                <p className="text-2xl font-bold">{submittedPendingReview.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Reviews</p>
                <p className="text-2xl font-bold">{pendingReviews.length + submittedPendingReview.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions */}
      {selectedReports.size > 0 && (
        <BulkReviewActions
          selectedReports={Array.from(selectedReports)}
          availableUsers={availableUsers}
          onActionComplete={() => {
            setSelectedReports(new Set());
            loadPendingReviews();
          }}
        />
      )}

      {/* Pending Reviews for User - Table View */}
      {pendingReviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Pending Your Review ({pendingReviews.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedReports.size === pendingReviews.length && pendingReviews.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedReports(new Set(pendingReviews.map(r => r.id)));
                          } else {
                            setSelectedReports(new Set());
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead className="w-[300px]">Report Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingReviews.map((report) => {
                    const status = (report.status || report.workflowStatus || '').toString().toLowerCase();
                    const category = (report.category || '').toString().toLowerCase();
                    const steps = Array.isArray(report.approvalSteps)
                      ? [...report.approvalSteps].sort((a: any, b: any) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0))
                      : [];
                    const totalSteps = steps.length || 1;
                    const currentStepIndex = steps.findIndex((s: any) => !s.isCompleted);
                    const currentStep = currentStepIndex >= 0 ? currentStepIndex + 1 : totalSteps;
                    return (
                      <TableRow key={report.id} className="hover:bg-muted/50">
                        <TableCell>
                          <Checkbox
                            checked={selectedReports.has(report.id)}
                            onCheckedChange={() => toggleReportSelection(report.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-start gap-2">
                            <FileText className="h-4 w-4 text-blue-500 mt-1 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium text-foreground">{report.name || 'Report'}</p>
                              {report.description && (
                                <p className="text-sm text-muted-foreground truncate max-w-[250px]" title={report.description}>
                                  {report.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <BadgeComponent className={getCategoryBadge(category)}>
                            {category || 'adhoc'}
                          </BadgeComponent>
                        </TableCell>
                        <TableCell>
                          <BadgeComponent className={getStatusBadge(status)}>
                            {status || 'pending'}
                          </BadgeComponent>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              Step {currentStep} of {totalSteps}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {report.submittedAt ? new Date(report.submittedAt).toLocaleDateString() : '-'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              onClick={() => handleQuickApprove(report.id)}
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              title="Quick Approve"
                            >
                              <Zap className="h-3 w-3" />
                            </Button>
                            <Button 
                              onClick={() => handleViewReport(report)}
                              variant="outline"
                              size="sm"
                              className="gap-1"
                            >
                              <Eye className="h-3 w-3" />
                              View
                            </Button>
                            <Button 
                              onClick={() => handleOpenReview(report)}
                              size="sm"
                              className="gap-1"
                            >
                              <CheckCircle className="h-3 w-3" />
                              Review
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reports Submitted by User Pending Review - Table View */}
      {submittedPendingReview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              Your Submitted Reports Pending Review ({submittedPendingReview.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Report Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submittedPendingReview.map((report) => {
                    const status = (report.status || report.workflowStatus || '').toString().toLowerCase();
                    const category = (report.category || '').toString().toLowerCase();
                    const steps = Array.isArray(report.approvalSteps)
                      ? [...report.approvalSteps].sort((a: any, b: any) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0))
                      : [];
                    const totalSteps = steps.length || 1;
                    const currentStepIndex = steps.findIndex((s: any) => !s.isCompleted);
                    const currentStep = currentStepIndex >= 0 ? currentStepIndex + 1 : totalSteps;
                    return (
                      <TableRow key={report.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-start gap-2">
                            <FileText className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium text-foreground">{report.name || 'Report'}</p>
                              {report.description && (
                                <p className="text-sm text-muted-foreground truncate max-w-[250px]" title={report.description}>
                                  {report.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <BadgeComponent className={getCategoryBadge(category)}>
                            {category || 'adhoc'}
                          </BadgeComponent>
                        </TableCell>
                        <TableCell>
                          <BadgeComponent className={getStatusBadge(status)}>
                            {status || 'pending'}
                          </BadgeComponent>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              Step {currentStep} of {totalSteps}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {report.submittedAt ? new Date(report.submittedAt).toLocaleDateString() : '-'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              onClick={() => handleQuickApprove(report.id)}
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              title="Quick Approve"
                            >
                              <Zap className="h-3 w-3" />
                            </Button>
                            <Button 
                              onClick={() => handleViewReport(report)}
                              variant="outline"
                              size="sm"
                              className="gap-1"
                            >
                              <Eye className="h-3 w-3" />
                              View
                            </Button>
                            <Button 
                              onClick={() => handleOpenReview(report)}
                              size="sm"
                              className="gap-1"
                            >
                              <CheckCircle className="h-3 w-3" />
                              Review
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
