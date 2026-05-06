import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  CheckCircle, XCircle, MessageSquare, Clock, Download, FileText, Eye, SkipForward, 
  RotateCcw, X, UserPlus, AlertTriangle, Flag, Calendar, Users, Info
} from 'lucide-react';
import { reportWorkflowService } from '@/services/reportWorkflowService';
import { reportService } from '@/services/reportService';
import { useToast } from '@/hooks/use-toast';
import { useParams } from 'react-router-dom';
import { apiClient } from '@/lib/api/client';
import { ReportWorkflowProgress } from './ReportWorkflowProgress';
import { useAuth } from '@/contexts/AuthContext';

interface ReportWorkflowDetailProps {
  reportId: string;
  onClose: () => void;
  onChanged?: () => void;
}

export function ReportWorkflowDetail({ reportId, onClose, onChanged }: ReportWorkflowDetailProps) {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('details');
  const [report, setReport] = React.useState<any>(null);
  const [note, setNote] = React.useState('');
  const [comment, setComment] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [hasActed, setHasActed] = React.useState(false);
  const [downloadingFileId, setDownloadingFileId] = React.useState<string | null>(null);
  const [showDelegateDialog, setShowDelegateDialog] = React.useState(false);
  const [showEscalateDialog, setShowEscalateDialog] = React.useState(false);
  const [showSetDueDateDialog, setShowSetDueDateDialog] = React.useState(false);
  const [showRequestInfoDialog, setShowRequestInfoDialog] = React.useState(false);
  const [showReturnToStepDialog, setShowReturnToStepDialog] = React.useState(false);
  const [delegateToUserId, setDelegateToUserId] = React.useState('');
  const [delegationReason, setDelegationReason] = React.useState('');
  const [escalateToUserId, setEscalateToUserId] = React.useState('');
  const [escalationReason, setEscalationReason] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const [selectedStepId, setSelectedStepId] = React.useState<string | null>(null);
  const [returnToStepId, setReturnToStepId] = React.useState('');
  const [returnReason, setReturnReason] = React.useState('');
  const [availableUsers, setAvailableUsers] = React.useState<any[]>([]);
  const [requestInfoData, setRequestInfoData] = React.useState({ requestedFrom: '', informationNeeded: '', deadline: '' });
  const [weightedApproval, setWeightedApproval] = React.useState<any>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await reportWorkflowService.getReportById(reportId);
        setReport(data);
        console.log(data);

        // Load available users for delegation/escalation if projectId is available
        if (projectId) {
          try {
            const usersResponse = await apiClient.get<{ users: any[] }>(`/projects/${projectId}/users?limit=100`);
            if (usersResponse.success && usersResponse.data?.users) {
              setAvailableUsers(usersResponse.data.users);
            }
          } catch (e) {
            console.warn('Failed to load users:', e);
          }
        }

        // Load weighted approval status if available
        try {
          const weighted = await reportWorkflowService.getWeightedApproval(reportId);
          setWeightedApproval(weighted);
        } catch (e) {
          // Weighted approval might not be available, ignore
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [reportId, projectId]);

  const refetchWorkflow = async () => {
    try {
      const data = await reportWorkflowService.getReportById(reportId);
      setReport(data);
    } catch (e) {
      console.error('Failed to refresh workflow detail:', e);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading report...</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return null;
  }

  const steps = Array.isArray(report.approvalSteps)
    ? [...report.approvalSteps].sort((a: any, b: any) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0))
    : [];
  const totalSteps = steps.length || 1;
  const currentIndex = steps.findIndex((s: any) => !s.isCompleted);
  const currentStepOrder =
    currentIndex >= 0 && steps[currentIndex] ? (steps[currentIndex] as any).stepOrder : null;
  const currentStep = currentStepOrder ?? totalSteps;

  const statusColor = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'APPROVED') return 'default';
    if (s === 'REJECTED') return 'destructive';
    if (s === 'PENDING' || s === 'IN_REVIEW') return 'secondary';
    return 'outline';
  };

  return (
    <div className="w-full p-4 md:p-6 space-y-6">
      <DialogTitle>Report Review</DialogTitle>
      <DialogDescription>Review report details and take action</DialogDescription>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold truncate" title={report.name || 'Report'}>
            {report.name || 'Report'}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant={statusColor(report.status)} className="uppercase">{(report.status || 'PENDING').replace('_', ' ')}</Badge>
            <Badge variant="outline">Step {currentStep} of {totalSteps}</Badge>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 sticky top-0 bg-white z-10">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="review">Review</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="w-full">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Report Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">{report.description || 'No description'}</p>
              </div>
              
              {/* File Information */}
              {report.files && report.files.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Attached Files</h4>
                  <div className="space-y-2">
                    {report.files.map((file: any) => (
                      <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <FileText className="h-5 w-5 text-blue-500 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate" title={file.title}>{file.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {file.fileSize ? `${(parseInt(file.fileSize) / 1024).toFixed(2)} KB` : 'Unknown size'}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          {/* Preview button for PDFs and images */}
                          {file.fileUrl && file.title && (
                            (file.title.toLowerCase().endsWith('.pdf') || 
                             file.title.toLowerCase().match(/\.(jpg|jpeg|png|gif)$/)) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  if (!projectId) return;
                                  try {
                                    const previewUrl = await reportService.getPreviewUrl(projectId, file.id);
                                    window.open(previewUrl, '_blank');
                                  } catch (e: any) {
                                    toast({ 
                                      title: 'Preview Failed', 
                                      description: e?.message || 'Failed to open preview', 
                                      variant: 'destructive' 
                                    });
                                  }
                                }}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Preview
                              </Button>
                            )
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              if (!projectId || downloadingFileId === file.id) return;
                              try {
                                setDownloadingFileId(file.id);
                                await reportService.downloadReportFile(projectId, file.id);
                                toast({ title: 'Download Started', description: 'File download has started.' });
                              } catch (e: any) {
                                toast({ 
                                  title: 'Download Failed', 
                                  description: e?.message || 'Failed to download file', 
                                  variant: 'destructive' 
                                });
                              } finally {
                                setDownloadingFileId(null);
                              }
                            }}
                            disabled={downloadingFileId === file.id}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            {downloadingFileId === file.id ? 'Downloading...' : 'Download'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resubmit/Cancel Actions for submitter */}
              {report.submittedByUser && report.status && 
               (report.status === 'REJECTED' || report.status === 'CHANGES_REQUESTED' || 
                report.status === 'PENDING' || report.status === 'IN_REVIEW') && (
                <div className="pt-4 border-t space-y-2">
                  <h4 className="text-sm font-semibold">Workflow Actions</h4>
                  <div className="flex flex-wrap gap-2">
                    {(report.status === 'REJECTED' || report.status === 'CHANGES_REQUESTED') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (isSubmitting) return;
                          try {
                            setIsSubmitting(true);
                            await reportWorkflowService.resubmitWorkflow(report.id);
                            toast({ title: 'Resubmitted', description: 'Workflow has been resubmitted for review.' });
                            await refetchWorkflow();
                            onChanged?.();
                          } catch (e: any) {
                            toast({ 
                              title: 'Resubmit Failed', 
                              description: e?.message || 'Failed to resubmit workflow', 
                              variant: 'destructive' 
                            });
                          } finally {
                            setIsSubmitting(false);
                          }
                        }}
                        disabled={isSubmitting}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Resubmit
                      </Button>
                    )}
                    {(report.status === 'PENDING' || report.status === 'IN_REVIEW') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (isSubmitting) return;
                          const reason = window.prompt('Please provide a reason for cancellation:');
                          if (!reason) return;
                          try {
                            setIsSubmitting(true);
                            await reportWorkflowService.cancelWorkflow(report.id, reason);
                            toast({ title: 'Cancelled', description: 'Workflow has been cancelled.' });
                            await refetchWorkflow();
                            onChanged?.();
                          } catch (e: any) {
                            toast({ 
                              title: 'Cancel Failed', 
                              description: e?.message || 'Failed to cancel workflow', 
                              variant: 'destructive' 
                            });
                          } finally {
                            setIsSubmitting(false);
                          }
                        }}
                        disabled={isSubmitting}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel Workflow
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="progress" className="w-full">
          {report && <ReportWorkflowProgress workflow={report} />}
        </TabsContent>

        <TabsContent value="review" className="w-full">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Take Action</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Request changes note</label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Provide details on what changes are required..."
                  className="mt-1 min-h-[100px]"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button 
                  onClick={async () => {
                    if (hasActed || isSubmitting) return;
                    try {
                      setIsSubmitting(true);
                      await reportWorkflowService.review(report.id, 'APPROVE');
                      setHasActed(true);
                      toast({ title: 'Approved', description: 'Your approval was recorded.' });
                      setActiveTab('history');
                      await refetchWorkflow();
                      onChanged?.();
                    } catch (e: any) {
                      toast({ title: 'Action failed', description: e?.message || 'Unable to approve report', variant: 'destructive' });
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  disabled={isSubmitting || hasActed}
                  className="gap-2"
                >
                  <CheckCircle className="h-4 w-4" /> Approve
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={async () => {
                    if (hasActed || isSubmitting) return;
                    try {
                      setIsSubmitting(true);
                      await reportWorkflowService.review(report.id, 'REJECT');
                      setHasActed(true);
                      toast({ title: 'Rejected', description: 'Your rejection was recorded.' });
                      setActiveTab('history');
                      await refetchWorkflow();
                      onChanged?.();
                    } catch (e: any) {
                      toast({ title: 'Action failed', description: e?.message || 'Unable to reject report', variant: 'destructive' });
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  disabled={isSubmitting || hasActed}
                  className="gap-2"
                >
                  <XCircle className="h-4 w-4" /> Reject
                </Button>
                <Button 
                  variant="outline" 
                  onClick={async () => {
                    if (hasActed || isSubmitting) return;
                    try {
                      setIsSubmitting(true);
                      await reportWorkflowService.review(report.id, 'REQUEST_CHANGES', note);
                      setHasActed(true);
                      toast({ title: 'Changes requested', description: 'Your request for changes was recorded.' });
                      setActiveTab('history');
                      await refetchWorkflow();
                      onChanged?.();
                    } catch (e: any) {
                      toast({ title: 'Action failed', description: e?.message || 'Unable to request changes', variant: 'destructive' });
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  className="gap-2" 
                  disabled={!note.trim() || isSubmitting || hasActed}
                >
                  <MessageSquare className="h-4 w-4" /> Request Changes
                </Button>
                {/* Skip action - only show if current step allows skipping */}
                {steps.find((s: any) => !s.isCompleted && s.canSkip) && (
                  <Button 
                    variant="outline" 
                    onClick={async () => {
                      if (hasActed || isSubmitting) return;
                      try {
                        setIsSubmitting(true);
                        await reportWorkflowService.review(report.id, 'SKIP');
                        setHasActed(true);
                        toast({ title: 'Skipped', description: 'This step has been skipped.' });
                        setActiveTab('history');
                        await refetchWorkflow();
                        onChanged?.();
                      } catch (e: any) {
                        toast({ title: 'Action failed', description: e?.message || 'Unable to skip step', variant: 'destructive' });
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    className="gap-2"
                    disabled={isSubmitting || hasActed}
                  >
                    <SkipForward className="h-4 w-4" /> Skip
                  </Button>
                )}
              </div>

              {/* Enhanced Actions Section */}
              <div className="pt-4 border-t mt-4">
                <h4 className="text-sm font-semibold mb-3">Additional Actions</h4>
                <div className="flex flex-wrap gap-2">
                  {/* Delegate Review */}
                  {steps.find((s: any) => !s.isCompleted && (s.reviewerId === user?.id || (s as any).delegatedTo === user?.id)) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const currentStep = steps.find((s: any) => !s.isCompleted && (s.reviewerId === user?.id || (s as any).delegatedTo === user?.id));
                        if (currentStep) {
                          setSelectedStepId(currentStep.id);
                          setShowDelegateDialog(true);
                        }
                      }}
                      className="gap-2"
                    >
                      <UserPlus className="h-4 w-4" /> Delegate Review
                    </Button>
                  )}

                  {/* Escalate */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEscalateDialog(true)}
                    className="gap-2"
                  >
                    <Flag className="h-4 w-4" /> Escalate
                  </Button>

                  {/* Set Due Date */}
                  {steps.find((s: any) => !s.isCompleted) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const currentStep = steps.find((s: any) => !s.isCompleted);
                        if (currentStep) {
                          setSelectedStepId(currentStep.id);
                          setShowSetDueDateDialog(true);
                        }
                      }}
                      className="gap-2"
                    >
                      <Calendar className="h-4 w-4" /> Set Due Date
                    </Button>
                  )}

                  {/* Request Information */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRequestInfoDialog(true)}
                    className="gap-2"
                  >
                    <Info className="h-4 w-4" /> Request Information
                  </Button>

                  {/* Return to Step */}
                  {steps.find((s: any) => !s.isCompleted && (s.reviewerId === user?.id || (s as any).delegatedTo === user?.id)) && steps.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const currentStep = steps.find((s: any) => !s.isCompleted && (s.reviewerId === user?.id || (s as any).delegatedTo === user?.id));
                        if (currentStep) {
                          setSelectedStepId(currentStep.id);
                          setShowReturnToStepDialog(true);
                        }
                      }}
                      className="gap-2"
                    >
                      <RotateCcw className="h-4 w-4" /> Return to Step
                    </Button>
                  )}
                </div>
              </div>

              {/* Weighted Approval Display */}
              {weightedApproval && (
                <div className="pt-4 border-t mt-4">
                  <h4 className="text-sm font-semibold mb-2">Weighted Approval Status</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Approved Weight:</span>
                      <span className="font-medium">{weightedApproval.approvedWeight} / {weightedApproval.totalWeight}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Required Weight:</span>
                      <span className="font-medium">{weightedApproval.requiredWeight}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          weightedApproval.isApproved ? 'bg-green-500' : 'bg-yellow-500'
                        }`}
                        style={{ width: `${Math.min((weightedApproval.approvedWeight / weightedApproval.totalWeight) * 100, 100)}%` }}
                      />
                    </div>
                    <Badge variant={weightedApproval.isApproved ? 'default' : 'secondary'}>
                      {weightedApproval.isApproved ? 'Approved' : 'Pending Approval'}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comments" className="w-full">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Comments & Discussion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Comment Form */}
              <div className="space-y-2">
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="min-h-[100px]"
                />
                <Button
                  onClick={async () => {
                    if (!comment.trim() || isSubmitting) return;
                    try {
                      setIsSubmitting(true);
                      await reportWorkflowService.addComment(report.id, comment);
                      setComment('');
                      toast({ title: 'Comment Added', description: 'Your comment has been added.' });
                      await refetchWorkflow();
                    } catch (e: any) {
                      toast({ 
                        title: 'Failed', 
                        description: e?.message || 'Failed to add comment', 
                        variant: 'destructive' 
                      });
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  disabled={!comment.trim() || isSubmitting}
                  size="sm"
                >
                  Add Comment
                </Button>
              </div>

              {/* Comments List */}
              <div className="space-y-3 max-h-[50vh] overflow-auto">
                {report.comments && report.comments.length > 0 ? (
                  report.comments.map((comment: any) => (
                    <div key={comment.id} className="p-3 border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium">
                            {comment.author 
                              ? `${comment.author.firstName || ''} ${comment.author.lastName || ''}`.trim() || comment.author.email
                              : 'Unknown User'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(comment.createdAt).toLocaleString()}
                          </p>
                        </div>
                        {comment.isInternal && (
                          <Badge variant="outline" className="text-xs">Internal</Badge>
                        )}
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{comment.content}</p>
                      
                      {/* Replies */}
                      {comment.replies && comment.replies.length > 0 && (
                        <div className="mt-3 ml-4 space-y-2 border-l-2 pl-3">
                          {comment.replies.map((reply: any) => (
                            <div key={reply.id} className="p-2 bg-muted rounded">
                              <div className="flex items-start justify-between mb-1">
                                <div>
                                  <p className="text-xs font-medium">
                                    {reply.author 
                                      ? `${reply.author.firstName || ''} ${reply.author.lastName || ''}`.trim() || reply.author.email
                                      : 'Unknown User'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(reply.createdAt).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                              <p className="text-xs text-foreground whitespace-pre-wrap">{reply.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No comments yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="w-full">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Review Steps & Audit</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[50vh] overflow-auto">
              <div className="space-y-3">
                {steps.map((s: any) => (
                  <div key={s.id} className="p-3 border rounded">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>Step {s.stepOrder}</span>
                      </div>
                      <Badge variant={s.isCompleted ? 'default' : 'secondary'}>{s.isCompleted ? 'Completed' : 'Pending'}</Badge>
                    </div>
                    {s.reviewer && (
                      <div className="text-xs text-muted-foreground mt-1">Reviewer: {`${s.reviewer.firstName || ''} ${s.reviewer.lastName || ''}`.trim() || s.reviewer.email}</div>
                    )}
                    {s.action && (
                      <div className="mt-2 text-sm">
                        <span className="font-medium">Action:</span> {s.action}
                        {s.comment && (<div className="text-muted-foreground mt-1">Comment: {s.comment}</div>)}
                        {s.reasoning && (<div className="text-muted-foreground mt-1">Reasoning: {s.reasoning}</div>)}
                      </div>
                    )}
                    {s.completedAt && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Completed: {new Date(s.completedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delegate Review Dialog */}
      {showDelegateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Delegate Review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Delegate To</Label>
                <Select value={delegateToUserId} onValueChange={setDelegateToUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {`${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reason</Label>
                <Textarea
                  value={delegationReason}
                  onChange={(e) => setDelegationReason(e.target.value)}
                  placeholder="Why are you delegating this review?"
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => {
                  setShowDelegateDialog(false);
                  setDelegateToUserId('');
                  setDelegationReason('');
                }}>
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (!selectedStepId || !delegateToUserId || !delegationReason.trim()) return;
                    try {
                      setIsSubmitting(true);
                      await reportWorkflowService.delegateReview(selectedStepId, delegateToUserId, delegationReason);
                      toast({ title: 'Delegated', description: 'Review has been delegated successfully.' });
                      setShowDelegateDialog(false);
                      setDelegateToUserId('');
                      setDelegationReason('');
                      await refetchWorkflow();
                      onChanged?.();
                    } catch (e: any) {
                      toast({ title: 'Delegation Failed', description: e?.message || 'Failed to delegate review', variant: 'destructive' });
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  disabled={!delegateToUserId || !delegationReason.trim() || isSubmitting}
                >
                  Delegate
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Escalate Dialog */}
      {showEscalateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Escalate Review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Escalate To</Label>
                <Select value={escalateToUserId} onValueChange={setEscalateToUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {`${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Escalation Reason</Label>
                <Textarea
                  value={escalationReason}
                  onChange={(e) => setEscalationReason(e.target.value)}
                  placeholder="Why are you escalating this review?"
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => {
                  setShowEscalateDialog(false);
                  setEscalateToUserId('');
                  setEscalationReason('');
                }}>
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (!escalateToUserId || !escalationReason.trim()) return;
                    try {
                      setIsSubmitting(true);
                      await reportWorkflowService.escalateReview(report.id, escalationReason, escalateToUserId);
                      toast({ title: 'Escalated', description: 'Review has been escalated successfully.' });
                      setShowEscalateDialog(false);
                      setEscalateToUserId('');
                      setEscalationReason('');
                      await refetchWorkflow();
                      onChanged?.();
                    } catch (e: any) {
                      toast({ title: 'Escalation Failed', description: e?.message || 'Failed to escalate review', variant: 'destructive' });
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  disabled={!escalateToUserId || !escalationReason.trim() || isSubmitting}
                >
                  Escalate
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Set Due Date Dialog */}
      {showSetDueDateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Set Due Date</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Due Date</Label>
                <Input
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => {
                  setShowSetDueDateDialog(false);
                  setDueDate('');
                }}>
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (!selectedStepId || !dueDate) return;
                    try {
                      setIsSubmitting(true);
                      await reportWorkflowService.setStepDueDate(selectedStepId, new Date(dueDate));
                      toast({ title: 'Due Date Set', description: 'Due date has been set successfully.' });
                      setShowSetDueDateDialog(false);
                      setDueDate('');
                      await refetchWorkflow();
                      onChanged?.();
                    } catch (e: any) {
                      toast({ title: 'Failed', description: e?.message || 'Failed to set due date', variant: 'destructive' });
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  disabled={!dueDate || isSubmitting}
                >
                  Set Due Date
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Request Information Dialog */}
      {showRequestInfoDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Request Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Request From</Label>
                <Select value={requestInfoData.requestedFrom} onValueChange={(v) => setRequestInfoData({ ...requestInfoData, requestedFrom: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {`${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Information Needed</Label>
                <Textarea
                  value={requestInfoData.informationNeeded}
                  onChange={(e) => setRequestInfoData({ ...requestInfoData, informationNeeded: e.target.value })}
                  placeholder="What information do you need?"
                  rows={3}
                />
              </div>
              <div>
                <Label>Deadline (Optional)</Label>
                <Input
                  type="datetime-local"
                  value={requestInfoData.deadline}
                  onChange={(e) => setRequestInfoData({ ...requestInfoData, deadline: e.target.value })}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => {
                  setShowRequestInfoDialog(false);
                  setRequestInfoData({ requestedFrom: '', informationNeeded: '', deadline: '' });
                }}>
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (!requestInfoData.requestedFrom || !requestInfoData.informationNeeded.trim()) return;
                    try {
                      setIsSubmitting(true);
                      await reportWorkflowService.requestInformation(
                        report.id,
                        requestInfoData.requestedFrom,
                        requestInfoData.informationNeeded,
                        requestInfoData.deadline ? new Date(requestInfoData.deadline) : undefined
                      );
                      toast({ title: 'Request Sent', description: 'Information request has been sent.' });
                      setShowRequestInfoDialog(false);
                      setRequestInfoData({ requestedFrom: '', informationNeeded: '', deadline: '' });
                      await refetchWorkflow();
                      onChanged?.();
                    } catch (e: any) {
                      toast({ title: 'Request Failed', description: e?.message || 'Failed to send information request', variant: 'destructive' });
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  disabled={!requestInfoData.requestedFrom || !requestInfoData.informationNeeded.trim() || isSubmitting}
                >
                  Send Request
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Return to Step Dialog */}
      {showReturnToStepDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Return to Specific Step</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Return To Step</Label>
                <Select value={returnToStepId} onValueChange={setReturnToStepId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select step to return to" />
                  </SelectTrigger>
                  <SelectContent>
                    {steps
                      .filter((s: any) => {
                        const currentStep = steps.find((s: any) => !s.isCompleted && (s.reviewerId === user?.id || (s as any).delegatedTo === user?.id));
                        return currentStep && s.stepOrder < currentStep.stepOrder;
                      })
                      .map((step: any) => (
                        <SelectItem key={step.id} value={step.id}>
                          Step {step.stepOrder} - {step.reviewer ? `${step.reviewer.firstName || ''} ${step.reviewer.lastName || ''}`.trim() || step.reviewer.email : 'Unknown'}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reason for Return</Label>
                <Textarea
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="Why are you returning this to an earlier step?"
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => {
                  setShowReturnToStepDialog(false);
                  setReturnToStepId('');
                  setReturnReason('');
                }}>
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (!returnToStepId || !returnReason.trim()) return;
                    try {
                      setIsSubmitting(true);
                      await reportWorkflowService.returnToStep(report.id, returnToStepId, returnReason);
                      toast({ title: 'Returned to Step', description: 'Report has been returned to the selected step.' });
                      setShowReturnToStepDialog(false);
                      setReturnToStepId('');
                      setReturnReason('');
                      await refetchWorkflow();
                      onChanged?.();
                    } catch (e: any) {
                      toast({ title: 'Return Failed', description: e?.message || 'Failed to return to step', variant: 'destructive' });
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  disabled={!returnToStepId || !returnReason.trim() || isSubmitting}
                >
                  Return to Step
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}


