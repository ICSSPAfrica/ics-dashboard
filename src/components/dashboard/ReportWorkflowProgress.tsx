import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, XCircle, AlertCircle, User, Calendar } from 'lucide-react';

interface ReportWorkflowProgressProps {
  workflow: {
    id: string;
    status: string;
    approvalSteps?: Array<{
      id: string;
      stepOrder: number;
      reviewerId: string;
      reviewer?: {
        id: string;
        firstName?: string;
        lastName?: string;
        email?: string;
      };
      isCompleted: boolean;
      action?: string;
      comment?: string;
      completedAt?: string;
      dueDate?: string;
      isDelegated?: boolean;
      delegatedTo?: string;
      escalationLevel?: number;
      approvalWeight?: number;
    }>;
  };
}

export function ReportWorkflowProgress({ workflow }: ReportWorkflowProgressProps) {
  const steps = [...(workflow.approvalSteps || [])].sort(
    (a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0)
  );
  const currentStepIndex = steps.findIndex((s) => !s.isCompleted);
  const currentStep = currentStepIndex >= 0 ? currentStepIndex : steps.length;
  const completedSteps = steps.filter((s) => s.isCompleted).length;
  const totalSteps = steps.length || 1;

  const getReviewerName = (step: any) => {
    if (step.reviewer) {
      const name = `${step.reviewer.firstName || ''} ${step.reviewer.lastName || ''}`.trim();
      return name || step.reviewer.email || 'Unknown';
    }
    return 'Unknown Reviewer';
  };

  const getStepStatusIcon = (step: any, index: number) => {
    if (step.isCompleted) {
      if (step.action === 'REJECT') {
        return <XCircle className="h-5 w-5 text-red-500" />;
      }
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    if (index === currentStep) {
      return <Clock className="h-5 w-5 text-blue-500 animate-pulse" />;
    }
    return <Clock className="h-5 w-5 text-gray-400" />;
  };

  const getStepStatusBadge = (step: any, index: number) => {
    if (step.isCompleted) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          Completed
        </Badge>
      );
    }
    if (index === currentStep) {
      return (
        <Badge variant="default" className="bg-blue-100 text-blue-800">
          In Review
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-gray-100 text-gray-800">
        Pending
      </Badge>
    );
  };

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Workflow Progress</span>
          <Badge variant="outline">
            {completedSteps} of {totalSteps} steps
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {Math.round((completedSteps / totalSteps) * 100)}% complete
          </p>
        </div>

        {/* Timeline */}
        <div className="space-y-4">
          {steps.map((step, index) => {
            const isCurrent = index === currentStep;
            const isPast = index < currentStep;
            const isFuture = index > currentStep;
            const overdue = isOverdue(step.dueDate);

            return (
              <div key={step.id} className="relative">
                <div className="flex items-start gap-4">
                  {/* Step Circle */}
                  <div
                    className={`
                      w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0
                      ${step.isCompleted
                        ? 'bg-green-500 text-white'
                        : isCurrent
                        ? 'bg-blue-500 text-white ring-4 ring-blue-200'
                        : 'bg-gray-300 text-gray-600'
                      }
                    `}
                  >
                    {getStepStatusIcon(step, index)}
                  </div>

                  {/* Step Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          Step {step.stepOrder}
                        </span>
                        {step.isDelegated && (
                          <Badge variant="outline" className="text-xs">
                            Delegated
                          </Badge>
                        )}
                        {step.escalationLevel && step.escalationLevel > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            Escalated (Level {step.escalationLevel})
                          </Badge>
                        )}
                      </div>
                      {getStepStatusBadge(step, index)}
                    </div>

                    {/* Reviewer Info */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <User className="h-4 w-4" />
                      <span>{getReviewerName(step)}</span>
                      {step.approvalWeight && step.approvalWeight > 1 && (
                        <Badge variant="outline" className="text-xs">
                          Weight: {step.approvalWeight}
                        </Badge>
                      )}
                      {step.delegatedTo && step.isDelegated && (
                        <span className="text-xs">(Delegated from original reviewer)</span>
                      )}
                    </div>

                    {/* Due Date */}
                    {step.dueDate && (
                      <div className={`flex items-center gap-2 text-xs mb-2 ${overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                        <Calendar className="h-3 w-3" />
                        <span>
                          Due: {new Date(step.dueDate).toLocaleDateString()}
                          {overdue && ' (Overdue)'}
                        </span>
                      </div>
                    )}

                    {/* Action and Comment */}
                    {step.isCompleted && (
                      <div className="mt-2 space-y-1">
                        {step.action && (
                          <div className="text-sm">
                            <span className="font-medium">Action: </span>
                            <span className="text-muted-foreground">{step.action}</span>
                          </div>
                        )}
                        {step.comment && (
                          <div className="text-sm text-muted-foreground bg-gray-50 p-2 rounded">
                            {step.comment}
                          </div>
                        )}
                        {step.completedAt && (
                          <div className="text-xs text-muted-foreground">
                            Completed: {new Date(step.completedAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Current Step Indicator */}
                    {isCurrent && !step.isCompleted && (
                      <div className="mt-2 text-sm text-blue-600 font-medium">
                        ← Currently reviewing
                      </div>
                    )}
                  </div>
                </div>

                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div
                    className={`
                      absolute left-6 top-12 w-0.5 h-8
                      ${step.isCompleted ? 'bg-green-500' : 'bg-gray-300'}
                    `}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="mt-6 pt-4 border-t">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Status: </span>
              <span className="font-medium">{workflow.status}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Current Step: </span>
              <span className="font-medium">
                {currentStep < steps.length && steps[currentStep]
                  ? `Step ${steps[currentStep].stepOrder}`
                  : 'Completed'}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


