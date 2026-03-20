import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { createEnhancedPermissionManager } from '@/lib/permissions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  MessageSquare,
  AlertTriangle,
  Phone,
  Users,
  BarChart3,
  Calendar,
  User,
  Eye,
  Clock,
  FileText,
  ClipboardList,
  TrendingUp
} from 'lucide-react';
import FeedbackFormDetails  from './FeedbackFormDetails';
import { useNavigate } from 'react-router-dom';
import { useFeedback } from '@/contexts/FeedbackContext';
import { GeneralFeedbackForm } from './forms/GeneralFeedbackForm';
import { SafetyIncidentForm } from './forms/SafetyIncidentForm';
import { EmergencyReportForm } from './forms/EmergencyReportForm';
import { StaffFeedbackForm } from './forms/StaffFeedbackForm';

interface FeedbackFormManagementProps {
  projectId: string;
  projectName?: string;
}

export function FeedbackFormManagement({ projectId, projectName = "ICS Organization" }: FeedbackFormManagementProps) {
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const permissionManager = createEnhancedPermissionManager({
    user,
    isAuthenticated,
    isLoading: authLoading,
  });
  const canReadFeedback = permissionManager.hasPermission('feedback:read');
  const { forms, categories, submissions, loading } = useFeedback();

  // Form configuration with actual form components and metadata
  const formConfig = [
    {
      id: 'general_feedback_form',
      title: 'General Feedback Form',
      description: 'Collect general feedback from community members about the program',
      category: 'General',
      priority: 'LOW',
      status: 'active',
      icon: MessageSquare,
      color: 'blue',
      estimatedTime: '2-3 minutes',
      component: GeneralFeedbackForm,
      formId: 'general_feedback_form',
      categoryId: 'general_feedback'
    },
    {
      id: 'safety_incident_form',
      title: 'Safety Incident Report',
      description: 'Report safety concerns, incidents, or hazards in the community',
      category: 'Safety',
      priority: 'HIGH',
      status: 'active',
      icon: AlertTriangle,
      color: 'orange',
      estimatedTime: '5-7 minutes',
      component: SafetyIncidentForm,
      formId: 'safety_incident_form',
      categoryId: 'safety_incident'
    },
    {
      id: 'emergency_report_form',
      title: 'Emergency Report Form',
      description: 'Report emergency situations requiring immediate attention',
      category: 'Emergency',
      priority: 'CRITICAL',
      status: 'active',
      icon: Phone,
      color: 'red',
      estimatedTime: '3-5 minutes',
      component: EmergencyReportForm,
      formId: 'emergency_report_form',
      categoryId: 'emergency_report'
    },
    {
      id: 'staff_feedback_form',
      title: 'Staff Feedback Form',
      description: 'Provide feedback about program staff performance and interactions',
      category: 'Staff',
      priority: 'MEDIUM',
      status: 'active',
      icon: Users,
      color: 'purple',
      estimatedTime: '4-6 minutes',
      component: StaffFeedbackForm,
      formId: 'staff_feedback_form',
      categoryId: 'staff_feedback'
    }
  ];

  // Get submission counts for each form
  const getSubmissionCount = (formId: string) => {
    return submissions.filter(sub => sub.formId === formId).length;
  };

  // Get last modified date for each form (using current date as fallback)
  const getLastModified = (formId: string) => {
    const formSubmissions = submissions.filter(sub => sub.formId === formId);
    if (formSubmissions.length > 0) {
      const latestSubmission = formSubmissions.sort((a, b) => 
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      )[0];
      return new Date(latestSubmission.submittedAt).toLocaleDateString();
    }
    return 'N/A';
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
      case 'active':
        return 'default';
      case 'draft':
        return 'secondary';
      case 'archived':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const handleFormClick = (formId: string) => {
    navigate(`/dashboard/feedback/submit?form=${formId}`);
  };

  const handleViewForm = (formId: string) => {
    setSelectedFormId(formId);
  };

  const handleViewFormDetails = (formId: string) => {
    navigate(`/dashboard/feedback/forms/${formId}`);
  };

  // Calculate stats from actual data
  const totalForms = formConfig.length;
  const activeForms = formConfig.filter(f => f.status === 'active').length;
  const totalSubmissions = submissions.length;
  const thisMonthSubmissions = submissions.filter(sub => {
    const submissionDate = new Date(sub.submittedAt);
    const currentDate = new Date();
    return submissionDate.getMonth() === currentDate.getMonth() && 
           submissionDate.getFullYear() === currentDate.getFullYear();
  }).length;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Feedback Forms</h1>
          <p className="text-gray-600 mt-2">
            View available feedback forms for {projectName}
          </p>
        </div>
        {canReadFeedback && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/dashboard/feedback/submissions')}>
              <ClipboardList className="w-4 h-4 mr-2" />
              View Submissions
            </Button>
            <Button variant="outline" onClick={() => navigate('/dashboard/feedback/analytics')}>
              <TrendingUp className="w-4 h-4 mr-2" />
              Analytics
            </Button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MessageSquare className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Forms</p>
                <p className="text-2xl font-bold">{totalForms}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <BarChart3 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Forms</p>
                <p className="text-2xl font-bold">{activeForms}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Submissions</p>
                <p className="text-2xl font-bold">{totalSubmissions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">This Month</p>
                <p className="text-2xl font-bold">{thisMonthSubmissions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Forms List */}
      <Card>
        <CardHeader>
          <CardTitle>Available Feedback Forms</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500">Loading forms...</div>
            </div>
          ) : (
            <div className="space-y-4">
              {formConfig.map((form) => {
                const IconComponent = form.icon;
                const submissionCount = getSubmissionCount(form.formId);
                const lastModified = getLastModified(form.formId);
                
                return (
                  <div key={form.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`p-2 rounded-lg bg-${form.color}-100`}>
                            <IconComponent className={`w-5 h-5 text-${form.color}-600`} />
                          </div>
                          <h3 className="text-lg font-semibold">{form.title}</h3>
                          <Badge variant={getPriorityColor(form.priority)}>
                            {form.priority}
                          </Badge>
                          <Badge variant={getStatusColor(form.status)}>
                            {form.status}
                          </Badge>
                        </div>
                        <p className="text-gray-600 mb-3">{form.description}</p>
                        <div className="flex items-center gap-6 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <BarChart3 className="w-4 h-4" />
                            {submissionCount} submissions
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            Last activity: {lastModified}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {form.estimatedTime}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleViewForm(form.id)}>
                          <Eye className="w-4 h-4 mr-1" />
                          Preview
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleViewFormDetails(form.id)}>
                          <FileText className="w-4 h-4 mr-1" />
                          Details
                        </Button>
                        <Button size="sm" onClick={() => handleFormClick(form.id)}>
                          <MessageSquare className="w-4 h-4 mr-1" />
                          Submit
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Form Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {formConfig.map((form) => {
              const IconComponent = form.icon;
              const submissionCount = getSubmissionCount(form.formId);
              
              return (
                <div key={form.id} className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className={`p-2 rounded-lg bg-${form.color}-100`}>
                    <IconComponent className={`w-6 h-6 text-${form.color}-600`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{form.category}</h3>
                    <p className="text-sm text-gray-600">{submissionCount} submissions</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Form Preview Modal */}
      {selectedFormId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Form Preview</h2>
                <Button variant="outline" onClick={() => setSelectedFormId(null)}>
                  Close
                </Button>
              </div>
              <div className="border rounded-lg p-4">
                {(() => {
                  const selectedForm = formConfig.find(f => f.id === selectedFormId);
                  if (!selectedForm) return null;
                  
                  const FormComponent = selectedForm.component;
                  return (
                    <FormComponent 
                      onSubmit={() => {}} 
                      isSubmitting={false}
                    />
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
