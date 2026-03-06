import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft,
  MessageSquare, 
  AlertTriangle, 
  Phone,
  Users,
  Calendar,
  User,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  Eye,
  Flag
} from 'lucide-react';
import { FeedbackResolutionWorkflow } from './FeedbackResolutionWorkflow';
import { FeedbackStatusTracker } from './FeedbackStatusTracker';
import { useFeedback } from '@/contexts/FeedbackContext';
import { FeedbackSubmission } from '@/types/feedback';
import { getClosureDueDate, isSensitiveSopCategory, SOP_CATEGORY_LABELS } from '@/types/feedback';

interface FeedbackSubmissionDetailProps {
  submissionId: string;
  onBack: () => void;
}

export function FeedbackSubmissionDetail({ submissionId, onBack }: FeedbackSubmissionDetailProps) {
  const [activeTab, setActiveTab] = useState('details');
  const [resolutionNote, setResolutionNote] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [assignTo, setAssignTo] = useState('');
  const [submission, setSubmission] = useState<FeedbackSubmission | null>(null);
  
  const { getSubmissionById, loading } = useFeedback();

  useEffect(() => {
    if (submissionId) {
      const foundSubmission = getSubmissionById(submissionId);
      setSubmission(foundSubmission || null);
    }
  }, [submissionId, getSubmissionById]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading submission details...</p>
        </div>
      </div>
    );
  }

  // Not found state
  if (!submission) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-600">Submission not found</p>
          <Button variant="outline" onClick={onBack} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Submissions
          </Button>
        </div>
      </div>
    );
  }

  const sopCat = submission.category?.sopCategory;
  const closureDue = getClosureDueDate(
    submission.submittedAt,
    sopCat,
    submission.category?.closureDeadlineHours
  );

  // Transform submission data for display
  const displayData = {
    id: submission.id,
    title: submission.data?.title || `${submission.category?.name || 'Feedback'} Submission`,
    type: submission.category?.name || 'General',
    priority: submission.priority,
    status: submission.status,
    submitter: submission.isAnonymous ? 'Anonymous' : (submission.submitterName || 'Unknown'),
    submitterEmail: submission.submitterEmail,
    isAnonymous: submission.isAnonymous,
    submittedAt: submission.submittedAt,
    assignedTo: submission.assignedTo,
    assignedAt: submission.assignedAt,
    description: submission.data?.description || submission.data?.feedback || submission.data?.details || 'No description provided',
    location: submission.data?.location || 'Not specified',
    attachments: submission.attachments || [],
    data: submission.data,
    stakeholderType: submission.stakeholderType,
    communications: submission.communications || [],
    internalNotes: submission.internalNotes || [],
    sopCategory: sopCat,
    sopCategoryLabel: sopCat != null && sopCat >= 1 && sopCat <= 8 ? SOP_CATEGORY_LABELS[sopCat as keyof typeof SOP_CATEGORY_LABELS] : null,
    closureDueDate: closureDue,
    isSensitive: isSensitiveSopCategory(sopCat),
  };


  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'destructive';
      case 'HIGH':
        return 'destructive';
      case 'MEDIUM':
        return 'default';
      case 'LOW':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return 'secondary';
      case 'ACKNOWLEDGED':
        return 'default';
      case 'IN_PROGRESS':
        return 'default';
      case 'RESOLVED':
        return 'default';
      case 'CLOSED':
        return 'outline';
      case 'ESCALATED':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return <Clock className="w-4 h-4" />;
      case 'ACKNOWLEDGED':
        return <MessageSquare className="w-4 h-4" />;
      case 'IN_PROGRESS':
        return <AlertCircle className="w-4 h-4" />;
      case 'RESOLVED':
        return <CheckCircle className="w-4 h-4" />;
      case 'CLOSED':
        return <XCircle className="w-4 h-4" />;
      case 'ESCALATED':
        return <Flag className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getActionIcon = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return <MessageSquare className="w-4 h-4" />;
      case 'ACKNOWLEDGED':
        return <CheckCircle className="w-4 h-4" />;
      case 'IN_PROGRESS':
        return <AlertCircle className="w-4 h-4" />;
      case 'RESOLVED':
        return <CheckCircle className="w-4 h-4" />;
      case 'CLOSED':
        return <XCircle className="w-4 h-4" />;
      case 'ESCALATED':
        return <Flag className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const handleStatusUpdate = () => {
    console.log('Updating status to:', newStatus);
    console.log('Resolution note:', resolutionNote);
    console.log('Assign to:', assignTo);
  };


  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Submissions
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{displayData.title}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <Badge variant={getPriorityColor(displayData.priority)}>
                {displayData.priority} Priority
              </Badge>
              {displayData.sopCategory != null && (
                <Badge variant={displayData.isSensitive ? 'destructive' : 'secondary'}>
                  SOP {displayData.sopCategory}: {displayData.sopCategoryLabel ?? 'Category ' + displayData.sopCategory}
                </Badge>
              )}
              {displayData.closureDueDate != null && displayData.status !== 'CLOSED' && displayData.status !== 'RESOLVED' && (
                <span className="text-sm text-gray-600">
                  Close by: {new Date(displayData.closureDueDate).toLocaleString()}
                  {displayData.isSensitive && ' (72h)'}
                </span>
              )}
              <Badge variant={getStatusColor(displayData.status)} className="flex items-center gap-1">
                {getStatusIcon(displayData.status)}
                {displayData.status.replace('_', ' ')}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-500" />
                <span className="text-sm">Assigned to: <strong>{displayData.assignedTo}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-sm">Submitted: {new Date(displayData.submittedAt).toLocaleDateString()}</span>
              </div>
            </div>
         
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="resolution">Resolution</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Submission Details */}
            <Card>
              <CardHeader>
                <CardTitle>Submission Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Description</label>
                  <p className="mt-1 text-sm">{displayData.description}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Location</label>
                  <p className="mt-1 text-sm">{displayData.location}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Submitter</label>
                  <p className="mt-1 text-sm">
                    {displayData.isAnonymous ? 'Anonymous' : displayData.submitter}
                    {!displayData.isAnonymous && displayData.submitterEmail && (
                      <span className="text-gray-500 ml-2">({displayData.submitterEmail})</span>
                    )}
                    {displayData.stakeholderType === 'community_facilitator' && (
                      <span className="ml-2 text-xs font-medium text-blue-600">(Community facilitator)</span>
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Submitted At</label>
                  <p className="mt-1 text-sm">{new Date(displayData.submittedAt).toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>

            {/* Form Data */}
            <Card>
              <CardHeader>
                <CardTitle>Form Responses</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(displayData.data).map(([key, value]) => (
                  <div key={key}>
                    <label className="text-sm font-medium text-gray-600 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </label>
                    <p className="mt-1 text-sm">{String(value)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Attachments */}
          {displayData.attachments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Attachments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {displayData.attachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-gray-500" />
                        <div>
                          <p className="text-sm font-medium">{file.filename}</p>
                          <p className="text-xs text-gray-500">{file.size}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>


        <TabsContent value="resolution" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Resolution Workflow */}
            <div>
              <FeedbackResolutionWorkflow
                submissionId={displayData.id}
                currentStatus={displayData.status}
                assignedTo={displayData.assignedTo}
                onStatusUpdate={(status, notes, assignTo) => {
                  console.log('Status update:', { status, notes, assignTo });
                }}
              />
            </div>

            {/* Status Tracker */}
            <div>
              <FeedbackStatusTracker
                statusHistory={(submission.statusHistory || []).map(entry => ({
                  id: entry.id,
                  status: entry.status,
                  previousStatus: entry.previousStatus,
                  timestamp: entry.createdAt,
                  user: entry.changedBy,
                  changedByName: entry.changedByName,
                  reason: entry.reason,
                  details: entry.details,
                  assignee: entry.assignedTo
                }))}
                currentStatus={displayData.status}
                assignedTo={displayData.assignedTo}
                submittedAt={new Date(displayData.submittedAt).toISOString()}
                resolvedAt={displayData.status === 'RESOLVED' ? (submission.resolvedAt ? new Date(submission.resolvedAt).toISOString() : (displayData.assignedAt ? new Date(displayData.assignedAt).toISOString() : undefined)) : undefined}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          {/* Status change history from feedback_status_history */}
          <Card>
            <CardHeader>
              <CardTitle>Status History</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const history = [...(submission.statusHistory || [])].sort(
                  (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
                if (history.length === 0) {
                  return <p className="text-sm text-gray-500">No status changes recorded yet.</p>;
                }

                const getStatusIcon = (status: string) => {
                  switch (status) {
                    case 'RESOLVED': return <CheckCircle className="w-4 h-4 text-green-600" />;
                    case 'CLOSED': return <XCircle className="w-4 h-4 text-gray-600" />;
                    case 'ESCALATED': return <Flag className="w-4 h-4 text-red-600" />;
                    case 'ACKNOWLEDGED': return <Eye className="w-4 h-4 text-blue-600" />;
                    case 'IN_PROGRESS': return <AlertCircle className="w-4 h-4 text-orange-600" />;
                    default: return <MessageSquare className="w-4 h-4 text-gray-600" />;
                  }
                };

                const getStatusLabel = (status: string) =>
                  status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

                return (
                  <div className="space-y-4">
                    {history.map((entry, index) => (
                      <div key={entry.id} className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`p-2 rounded-full ${index === 0 ? 'bg-blue-100' : 'bg-gray-100'}`}>
                            {getStatusIcon(entry.status)}
                          </div>
                          {index < history.length - 1 && (
                            <div className="w-px h-6 bg-gray-200 mt-1" />
                          )}
                        </div>
                        <div className="flex-1 pb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {entry.previousStatus && (
                              <>
                                <Badge variant="outline" className="text-xs">{getStatusLabel(entry.previousStatus)}</Badge>
                                <span className="text-xs text-gray-400">→</span>
                              </>
                            )}
                            <Badge variant="default" className="text-xs">{getStatusLabel(entry.status)}</Badge>
                            <span className="text-xs text-gray-500">
                              {new Date(entry.createdAt).toLocaleString()}
                            </span>
                          </div>
                          {entry.reason && (
                            <p className="text-sm text-gray-600 mt-1">{entry.reason}</p>
                          )}
                          {entry.details && (
                            <p className="text-sm text-gray-500 mt-0.5">{entry.details}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                            <span>by {entry.changedByName || entry.changedBy}</span>
                            {entry.assignedTo && <span>assigned to {entry.assignedTo}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Internal notes */}
          {(displayData.internalNotes || []).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Internal Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {displayData.internalNotes.map((note) => (
                    <div key={note.id} className="flex items-start gap-3 p-3 border rounded-lg">
                      <div className="p-2 bg-gray-100 rounded-full">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">Internal Note</span>
                          <span className="text-xs text-gray-500">
                            {new Date(note.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{note.content}</p>
                        <p className="text-xs text-gray-500 mt-1">by {note.authorName}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
