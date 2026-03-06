import React, { useState, useEffect } from 'react';
import { useFeedback } from '@/contexts/FeedbackContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Flag,
  MessageSquare,
  User,
  Loader2
} from 'lucide-react';
import { userManagementService } from '@/services/userManagementService';

/** Sentinel value for "Unassigned" - Radix Select does not allow value="" on items */
const UNASSIGNED_VALUE = '__unassigned__';

interface FeedbackResolutionWorkflowProps {
  submissionId: string;
  currentStatus: string;
  assignedTo?: string;
  onStatusUpdate: (status: string, notes: string, assignTo?: string) => void;
}

export function FeedbackResolutionWorkflow({ 
  submissionId, 
  currentStatus, 
  assignedTo,
  onStatusUpdate
}: FeedbackResolutionWorkflowProps) {
  const [newStatus, setNewStatus] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [assignTo, setAssignTo] = useState(assignedTo && assignedTo.trim() ? assignedTo : UNASSIGNED_VALUE);
  const [assigneeOptions, setAssigneeOptions] = useState<{ value: string; label: string }[]>([]);
  const [assigneesLoading, setAssigneesLoading] = useState(true);

  const { updateSubmissionStatus, addNote } = useFeedback();

  useEffect(() => {
    setAssignTo(assignedTo && assignedTo.trim() ? assignedTo : UNASSIGNED_VALUE);
  }, [assignedTo]);

  useEffect(() => {
    let cancelled = false;
    async function loadAssignees() {
      setAssigneesLoading(true);
      try {
        const baseOptions = [{ value: UNASSIGNED_VALUE, label: 'Unassigned' }];
        // Fetch all users in the system (requires users:read)
        const res = await userManagementService.getUsers({ limit: 500, isActive: true });
        const users = (res.users || []).map((u) => ({
          value: u.id,
          label: [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email || u.id,
        }));
        if (!cancelled) setAssigneeOptions([...baseOptions, ...users]);
      } catch (err) {
        console.warn('Failed to load assignable users for feedback:', err);
        if (!cancelled) setAssigneeOptions([{ value: UNASSIGNED_VALUE, label: 'Unassigned' }]);
      } finally {
        if (!cancelled) setAssigneesLoading(false);
      }
    }
    loadAssignees();
    return () => { cancelled = true; };
  }, []);

  const statusOptions = [
    { value: 'SUBMITTED', label: 'Submitted', icon: Clock, color: 'secondary' },
    { value: 'ACKNOWLEDGED', label: 'Acknowledged', icon: MessageSquare, color: 'default' },
    { value: 'IN_PROGRESS', label: 'In Progress', icon: AlertCircle, color: 'default' },
    { value: 'RESOLVED', label: 'Resolved', icon: CheckCircle, color: 'default' },
    { value: 'CLOSED', label: 'Closed', icon: XCircle, color: 'outline' },
    { value: 'ESCALATED', label: 'Escalated', icon: Flag, color: 'destructive' }
  ];

  const assignedToLabel = assignedTo && assignedTo !== UNASSIGNED_VALUE
    ? (assigneeOptions.find((o) => o.value === assignedTo)?.label ?? assignedTo)
    : null;

  const getStatusInfo = (status: string) => {
    return statusOptions.find(option => option.value === status) || statusOptions[0];
  };

  const currentStatusInfo = getStatusInfo(currentStatus);

  const [statusError, setStatusError] = useState<string | null>(null);

  const handleStatusUpdate = async () => {
    if (newStatus) {
      setStatusError(null);
      try {
        await updateSubmissionStatus(submissionId, newStatus, assignTo === UNASSIGNED_VALUE ? undefined : assignTo);
        
        if (resolutionNotes.trim()) {
          await addNote(submissionId, {
            content: resolutionNotes,
            authorId: 'current-user',
            authorName: 'Current User',
            isInternal: true
          });
        }
        
        onStatusUpdate(newStatus, resolutionNotes, assignTo === UNASSIGNED_VALUE ? undefined : assignTo);
        
        setNewStatus('');
        setResolutionNotes('');
      } catch (error: any) {
        console.error('Error updating status:', error);
        const msg = error?.message || 'Failed to update status. Please try again.';
        setStatusError(msg);
      }
    }
  };


  const allowedTransitions: Record<string, string[]> = {
    SUBMITTED:    ['ACKNOWLEDGED', 'IN_PROGRESS', 'ESCALATED', 'CLOSED'],
    ACKNOWLEDGED: ['IN_PROGRESS', 'ESCALATED', 'CLOSED'],
    IN_PROGRESS:  ['RESOLVED', 'ESCALATED', 'CLOSED'],
    ESCALATED:    ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    RESOLVED:     ['CLOSED'],
    CLOSED:       [],
  };

  const getNextStatusOptions = () => {
    const allowed = allowedTransitions[currentStatus] || [];
    return statusOptions.filter(option => allowed.includes(option.value));
  };

  const isTransitionAllowed = (target: string) =>
    (allowedTransitions[currentStatus] || []).includes(target);

  return (
    <div className="space-y-6">
      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <currentStatusInfo.icon className="w-5 h-5" />
            Current Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant={currentStatusInfo.color as any}>
                {currentStatusInfo.label}
              </Badge>
              {(assignedToLabel || (assignedTo && assignedTo !== UNASSIGNED_VALUE)) && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User className="w-4 h-4" />
                  Assigned to: {assignedToLabel ?? assignedTo}
                </div>
              )}
            </div>
            <div className="text-sm text-gray-500">
              Last updated: {new Date().toLocaleDateString()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Update */}
      <Card>
        <CardHeader>
          <CardTitle>Update Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">New Status</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select new status" />
                </SelectTrigger>
                <SelectContent>
                  {getNextStatusOptions().map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <option.icon className="w-4 h-4" />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Assign To</label>
              <Select value={assignTo} onValueChange={setAssignTo} disabled={assigneesLoading}>
                <SelectTrigger className="mt-1">
                  {assigneesLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading users…
                    </span>
                  ) : (
                    <SelectValue placeholder="Select assignee" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {assigneeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Resolution Notes</label>
            <Textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Add notes about the status update or resolution..."
              className="mt-1"
              rows={3}
            />
          </div>
          {statusError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{statusError}</p>
          )}
          <Button onClick={handleStatusUpdate} disabled={!newStatus || currentStatus === 'CLOSED'}>
            Update Status
          </Button>
        </CardContent>
      </Card>


      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          {currentStatus === 'CLOSED' ? (
            <p className="text-sm text-gray-500">This submission is closed. No further actions available.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {isTransitionAllowed('ACKNOWLEDGED') && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setNewStatus('ACKNOWLEDGED');
                    setResolutionNotes('Submission acknowledged and under review.');
                  }}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Acknowledge
                </Button>
              )}
              {isTransitionAllowed('IN_PROGRESS') && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setNewStatus('IN_PROGRESS');
                    setResolutionNotes('Work has begun on resolving this issue.');
                  }}
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Start Work
                </Button>
              )}
              {isTransitionAllowed('RESOLVED') && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setNewStatus('RESOLVED');
                    setResolutionNotes('Issue has been resolved successfully.');
                  }}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark Resolved
                </Button>
              )}
              {isTransitionAllowed('CLOSED') && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setNewStatus('CLOSED');
                    setResolutionNotes('Case closed.');
                  }}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Close
                </Button>
              )}
              {isTransitionAllowed('ESCALATED') && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setNewStatus('ESCALATED');
                    setResolutionNotes('Issue escalated for review.');
                  }}
                >
                  <Flag className="w-4 h-4 mr-2" />
                  Escalate
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
