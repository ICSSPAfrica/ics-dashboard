import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, Upload, Download, File, Eye, Trash2, Plus, FilePlus, Hash, MapPin, Building, FileText as FileTextIcon, RefreshCw, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects } from '@/contexts/ProjectsContext';
import { Report } from '@/types/dashboard';
import { ReportUpload } from './ReportUpload';
import { NamingConventionForm } from './NamingConventionForm';
import { NamingConventionData, generateFileName, parseFileName, REPORT_TYPES } from '@/lib/namingConvention';
import { PendingReviews } from './PendingReviews';
import { ReportWorkflowDetail } from './ReportWorkflowDetail';
import { ReviewerWorkloadDashboard } from './ReviewerWorkloadDashboard';
import { reportWorkflowService } from '@/services/reportWorkflowService';
import { useReport } from '@/contexts/ReportContext';
import { reportService } from '@/services/reportService';
import { useToast } from '@/hooks/use-toast';
import { useNotification } from '@/hooks/useNotification';

export function Reports() {
  const { user } = useAuth();
  const { getProjectActivities, getProjectOutputs, getProjectOutcomes } = useProjects();
  const { reports: contextReports } = useReport();
  const { toast } = useToast();
  const { showSuccess, showError } = useNotification();
  const { projectId } = useParams();
  if (!user || !projectId) return null;
  
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedFrequency, setSelectedFrequency] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedReportType, setSelectedReportType] = useState<string>('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('all');
  const [selectedActivity, setSelectedActivity] = useState<string>('all');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [namingDialogOpen, setNamingDialogOpen] = useState(false);
  const [reportType, setReportType] = useState<'activity' | 'output' | 'outcome' | ''>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [namingData, setNamingData] = useState<NamingConventionData>({
    countryCode: '',
    regionCode: '',
    projectCode: '',
    reportTypeCode: '',
    date: new Date(),
    versionControl: ''
  });
  const [generatedFileName, setGeneratedFileName] = useState<string>('');
  const [reports, setReports] = useState<any[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [openWorkflowId, setOpenWorkflowId] = useState<string | null>(null);
  const [pendingReviewsRefreshTrigger, setPendingReviewsRefreshTrigger] = useState(0);
  const [showWorkloadDashboard, setShowWorkloadDashboard] = useState(false);

  // Get project data for report creation
  const [activities, setActivities] = useState<any[]>([]);
  const [outputs, setOutputs] = useState<any[]>([]);
  const [outcomes, setOutcomes] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  useEffect(() => {
    const loadProjectData = async () => {
      if (projectId && user) {
        try {
          const [activitiesData, outputsData, outcomesData] = await Promise.all([
            getProjectActivities(projectId),
            getProjectOutputs(projectId),
            getProjectOutcomes(projectId)
          ]);
          setActivities(activitiesData);
          setOutputs(outputsData);
          setOutcomes(outcomesData);
        } catch (error) {
          console.error('Error loading project data:', error);
        }
      }
    };

    loadProjectData();
  }, [projectId, user, getProjectActivities, getProjectOutputs, getProjectOutcomes]);

  // Clear activity filter when report type changes away from ACT
  useEffect(() => {
    if (selectedReportType !== 'ACT') {
      setSelectedActivity('all');
    }
  }, [selectedReportType]);

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <FileText className="h-4 w-4 text-red-500" />;
      case 'excel':
        return <File className="h-4 w-4 text-green-500" />;
      case 'word':
        return <FileText className="h-4 w-4 text-blue-500" />;
      default:
        return <File className="h-4 w-4 text-gray-500" />;
    }
  };

  const getCategoryBadge = (category: string) => {
    const variants = {
      weekly: 'bg-cyan-100 text-cyan-800',
      bimonthly: 'bg-teal-100 text-teal-800',
      monthly: 'bg-green-100 text-green-800',
      quarterly: 'bg-blue-100 text-blue-800',
      'bi-annual': 'bg-indigo-100 text-indigo-800',
      annual: 'bg-purple-100 text-purple-800',
      adhoc: 'bg-gray-100 text-gray-800'
    };
    return variants[category as keyof typeof variants] || variants.adhoc;
  };

  const getStatusBadge = (status: string) => {
    const key = (status || '').toLowerCase().replace(/_/g, ' ').trim();
    const variants: Record<string, string> = {
      // File status
      draft: 'bg-yellow-100 text-yellow-800',
      final: 'bg-green-100 text-green-800',
      archived: 'bg-gray-100 text-gray-800',
      // Workflow status
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800',
      'in review': 'bg-blue-100 text-blue-800',
      'in_review': 'bg-blue-100 text-blue-800',
      'changes requested': 'bg-orange-100 text-orange-800',
      'changes_requested': 'bg-orange-100 text-orange-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };
    return variants[key] || variants.pending;
  };

  // Helper function to get file type from extension
  const getFileTypeFromExtension = (fileName?: string): 'pdf' | 'excel' | 'word' | 'other' => {
    if (!fileName || typeof fileName !== 'string') return 'other';
    const parts = fileName.split('.');
    const extension = parts.length > 1 ? parts.pop()?.toLowerCase() : undefined;
    switch (extension) {
      case 'pdf':
        return 'pdf';
      case 'xls':
      case 'xlsx':
        return 'excel';
      case 'doc':
      case 'docx':
        return 'word';
      default:
        return 'other';
    }
  };

 

  // Convert backend workflows to display format
  // Backend now returns workflows, each potentially containing multiple files
  const displayReports = reports.flatMap((workflow: any) => {
    // Helper function to format user name
    const formatUserName = (user: any) => {
      if (!user) return 'Unknown';
      if (typeof user === 'string') return user; // If it's just an ID
      return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown';
    };

    // Get workflow status
    const workflowStatus = (workflow.status || 'PENDING').toString().toUpperCase();
    const category = (workflow.category || 'ADHOC').toString().toLowerCase();
    
    // Get current step info
    const steps = Array.isArray(workflow.approvalSteps)
      ? [...workflow.approvalSteps].sort((a: any, b: any) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0))
      : [];
    const currentStepIndex = steps.findIndex((s: any) => !s.isCompleted);
    const currentStep = currentStepIndex >= 0 ? currentStepIndex + 1 : steps.length;

    // If workflow has files, create one display report per file
    const files = Array.isArray(workflow.files) ? workflow.files : [];
    
    if (files.length === 0) {
      // Workflow without files - show workflow as report
      return [{
        id: workflow.id,
        name: workflow.name,
        type: 'other' as const,
        size: '0',
        uploadDate: workflow.submittedAt || workflow.createdAt,
        description: workflow.description || '',
        category: category,
        status: workflowStatus.toLowerCase(),
        uploadedBy: formatUserName(workflow.submittedByUser || workflow.submittedBy),
        lastModified: workflow.updatedAt || workflow.submittedAt || workflow.createdAt,
        lastModifiedBy: formatUserName(workflow.submittedByUser || workflow.submittedBy),
        projectId: projectId,
        currentAuthLevel: 'branch-admin' as const,
        approvalWorkflow: {
          id: workflow.id,
          reportId: workflow.id,
          projectId: projectId,
          createdAt: workflow.createdAt,
          createdBy: formatUserName(workflow.submittedByUser || workflow.submittedBy),
          currentStep: currentStep,
          totalSteps: steps.length || 1,
          steps: steps,
          status: workflowStatus
        },
        isPendingReview: workflowStatus === 'PENDING' || workflowStatus === 'IN_REVIEW',
        fileUrl: null,
        workflowId: workflow.id,
        auditInfo: {
          createdBy: workflow.submittedByUser || workflow.submittedBy,
          updatedBy: workflow.submittedByUser || workflow.submittedBy,
          createdAt: workflow.createdAt,
          updatedAt: workflow.updatedAt
        }
      } as Report & { fileUrl: string | null; workflowId: string; auditInfo: any }];
    }

    // Map each file to a display report
    return files.map((file: any) => ({
      id: file.id,
      name: file.title,
      type: getFileTypeFromExtension(file.title),
      size: file.fileSize || '0',
      uploadDate: file.createdAt || workflow.submittedAt || workflow.createdAt,
      description: file.description || workflow.description || '',
      category: category,
      status: workflowStatus.toLowerCase(),
      uploadedBy: formatUserName(file.creator || workflow.submittedByUser || workflow.submittedBy),
      lastModified: file.updatedAt || workflow.updatedAt || workflow.submittedAt || workflow.createdAt,
      lastModifiedBy: formatUserName(file.updater || workflow.submittedByUser || workflow.submittedBy),
      projectId: projectId,
      currentAuthLevel: 'branch-admin' as const,
      approvalWorkflow: {
        id: workflow.id,
        reportId: workflow.id,
        projectId: projectId,
        createdAt: workflow.createdAt,
        createdBy: formatUserName(workflow.submittedByUser || workflow.submittedBy),
        currentStep: currentStep,
        totalSteps: steps.length || 1,
        steps: steps,
        status: workflowStatus
      },
      isPendingReview: workflowStatus === 'PENDING' || workflowStatus === 'IN_REVIEW',
      fileUrl: file.fileUrl,
      workflowId: workflow.id,
      auditInfo: {
        createdBy: file.creator || workflow.submittedByUser || workflow.submittedBy,
        updatedBy: file.updater || workflow.submittedByUser || workflow.submittedBy,
        createdAt: file.createdAt || workflow.createdAt,
        updatedAt: file.updatedAt || workflow.updatedAt
      }
    } as Report & { fileUrl: string | null; workflowId: string; auditInfo: any }));
  });


  // Filtering logic with proper case handling
  const filteredReports = displayReports.filter(report => {
    // Normalize category for comparison (backend uses uppercase, frontend uses lowercase)
    const reportCategory = (report.category || '').toLowerCase();
    const selectedFreq = selectedFrequency.toLowerCase();
    const selectedCat = selectedCategory.toLowerCase();
    
    // Frequency/Category filter - normalize case
    const frequencyMatch = selectedFreq === 'all' || reportCategory === selectedFreq;
    const categoryMatch = selectedCat === 'all' || reportCategory === selectedCat;

    // Workflow/file status filter
    const reportStatus = ((report as any).approvalWorkflow?.status || report.status || '')
      .toString()
      .toUpperCase();
    const statusMatch = selectedStatus === 'all' || reportStatus === selectedStatus;
    
    // Report type filter - check naming convention or name
    let reportTypeMatch = true;
    if (selectedReportType !== 'all') {
      const reportName = (report.name || '').toLowerCase();
      const selectedType = selectedReportType.toLowerCase();
      // Check if the report name contains the selected report type code
      reportTypeMatch = reportName.includes(`_${selectedType}_`) || 
                       reportName.includes(`-${selectedType}-`) ||
                       reportName.includes(selectedType);
    }
    
    // Activity filter - only apply if we have activity data
    const activityMatch = selectedActivity === 'all' || 
      !(report as any).activityId ||
      (report as any).activityId === selectedActivity;
    
    // Time filter
    let timeMatch = true;
    if (selectedTimeRange !== 'all') {
      const uploaded = new Date(report.uploadDate).getTime();
      const now = Date.now();
      const ranges: Record<string, number> = {
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
        '3m': 90 * 24 * 60 * 60 * 1000,
        '6m': 180 * 24 * 60 * 60 * 1000,
        '1y': 365 * 24 * 60 * 60 * 1000,
      };
      const windowMs = ranges[selectedTimeRange];
      if (windowMs) {
        timeMatch = uploaded >= (now - windowMs);
      }
    }

    return frequencyMatch && reportTypeMatch && activityMatch && categoryMatch && statusMatch && timeMatch;
  });


  // Helper for report type options
  const reportTypeOptions = [
    { value: 'activity', label: 'Activity' },
    { value: 'output', label: 'Output' },
    { value: 'outcome', label: 'Outcome' },
  ];

  // Get relevant items for the selected report type
  let relevantItems: { id: string; title: string }[] = [];
  if (reportType === 'activity') {
    relevantItems = activities.map(a => ({ id: a.id, title: a.title }));
  } else if (reportType === 'output') {
    relevantItems = outputs.map((o: any) => ({ id: o.id, title: o.title }));
  } else if (reportType === 'outcome') {
    relevantItems = outcomes.map(o => ({ id: o.id, title: o.title }));
  }

  const handleNamingDataChange = (data: NamingConventionData, fileName: string) => {
    setNamingData(data);
    setGeneratedFileName(fileName);
  };

  

  // Load reports from backend API (now returns workflows with files)
  const loadReports = async () => {
    setIsLoadingFiles(true);
    try {
      const response = await reportService.getReports(projectId);
      if (response.success && response.data) {
        // Backend now returns workflows, each with files array
        setReports(response.data);
      } else {
        setReports([]);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
      showError(
        "Load Failed",
        "Failed to load reports from the server"
      );
      setReports([]);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(0)} KB`;
    }
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  // Load reports on component mount and when projectId changes
  useEffect(() => {
    if (projectId) {
      loadReports();
    }
  }, [projectId]);

  const handleFilesUploaded = (files: any[]) => {
    setUploadDialogOpen(false);
    // Reload reports after upload
    loadReports();
  };

  // Handle file download
  const handleDownloadFile = async (reportId: string, fileName: string) => {
    try {
      await reportService.downloadReportFile(projectId, reportId);
      showSuccess(
        "Download Complete",
        "File downloaded successfully"
      );
    } catch (error) {
      console.error('Error downloading file:', error);
      showError(
        "Download Failed",
        error instanceof Error ? error.message : "Failed to download file"
      );
    }
  };

  const handleOpenAudit = async (reportId: string) => {
    try {
      // Prefer loading by file id (report id here is the file/report id from reports table)
      const wf = await reportWorkflowService.getByFile(reportId);
      if (wf && wf.id) {
        setOpenWorkflowId(wf.id);
      } else {
        // fallback: try directly as workflow id
        setOpenWorkflowId(reportId);
      }
    } catch (e) {
      console.error('Failed to load workflow for report:', e);
      // fallback
      setOpenWorkflowId(reportId);
    }
  };

  // Handle file deletion
  const handleDeleteFile = async (reportId: string, fileName: string) => {
    try {
      await reportService.deleteReportFile(projectId, reportId);
      showSuccess(
        "File Deleted",
        "Report file has been deleted successfully"
      );
      // Reload reports after deletion
      loadReports();
    } catch (error) {
      console.error('Error deleting file:', error);
      showError(
        "Delete Failed",
        error instanceof Error ? error.message : "Failed to delete file"
      );
    }
  };

  const parseNamingConvention = (fileName: string) => {
    const parsed = parseFileName(fileName);
    if (!parsed) return null;
    
    return {
      country: parsed.countryCode,
      region: parsed.regionCode,
      project: parsed.projectCode,
      reportType: parsed.reportTypeCode,
      date: parsed.date,
      version: parsed.versionControl
    };
  };

  const getNamingConventionDisplay = (fileName: string) => {
    const parsed = parseNamingConvention(fileName);
    if (!parsed) return null;

    return (
      <div className="flex flex-wrap gap-1 mt-2">
        <Badge variant="outline" className="text-xs">
          <MapPin className="w-3 h-3 mr-1" />
          {parsed.country}-{parsed.region}
        </Badge>
        <Badge variant="outline" className="text-xs">
          <Building className="w-3 h-3 mr-1" />
          {parsed.project}
        </Badge>
        <Badge variant="outline" className="text-xs">
          <FileTextIcon className="w-3 h-3 mr-1" />
          {parsed.reportType}
        </Badge>
        {parsed.version && (
          <Badge variant="secondary" className="text-xs">
            {parsed.version}
          </Badge>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1 w-full min-w-0">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-0 w-full min-w-0">
        <div className="w-full min-w-0">
          <h1 className="text-3xl font-bold text-foreground break-words whitespace-normal">Reports</h1>
          <p className="text-muted-foreground break-words whitespace-normal">Manage project reports and documentation</p>
        </div>
        <div className="flex gap-2 mt-2 md:mt-0 w-full min-w-0">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadReports}
            disabled={isLoadingFiles}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingFiles ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowWorkloadDashboard(!showWorkloadDashboard)}
            className="gap-2"
          >
            <Users className="h-4 w-4" />
            {showWorkloadDashboard ? 'Hide' : 'Show'} Workload
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              {/* <Button variant="secondary" className="gap-2">
                <FilePlus className="h-4 w-4" />
                Create from Data
              </Button> */}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Report from Existing Data</DialogTitle>
                <DialogDescription>
                  Generate a new report using current project data 
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="report-type">Report Type</Label>
                  <select
                    id="report-type"
                    className="w-full p-2 border rounded"
                    value={reportType}
                    onChange={e => {
                      setReportType(e.target.value as 'activity' | 'output' | 'outcome' );
                      setSelectedItemId('');
                    }}
                  >
                    <option value="">Select type...</option>
                    {reportTypeOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                {reportType && (
                  <div>
                    <Label htmlFor="report-item">Related {reportType.charAt(0).toUpperCase() + reportType.slice(1)}</Label>
                    <select
                      id="report-item"
                      className="w-full p-2 border rounded break-words whitespace-normal"
                      value={selectedItemId}
                      onChange={e => setSelectedItemId(e.target.value)}
                      style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}
                    >
                      <option value="">Select...</option>
                      {relevantItems.map(item => (
                        <option key={item.id} value={item.id} className="break-words whitespace-normal" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{item.title}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <Label htmlFor="report-title">Report Title</Label>
                  <Input id="report-title" placeholder="e.g. Custom Data Report" />
                </div>
                <div>
                  <Label htmlFor="report-desc">Description</Label>
                  <Textarea id="report-desc" placeholder="Describe the report..." />
                </div>
                <div>
                  <Label htmlFor="report-category">Category</Label>
                  <select id="report-category" className="w-full p-2 border rounded">
                    <option value="weekly">Weekly</option>
                    <option value="bimonthly">Bi-monthly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="bi-annual">Bi-annual</option>
                    <option value="annual">Annual</option>
                    <option value="adhoc">Ad-hoc</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => setCreateDialogOpen(false)}>
                    Create
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Upload Report
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Upload Reports with Naming Convention</DialogTitle>
                <DialogDescription>
                  Upload report files and automatically rename them according to the hierarchical geographic naming protocol
                </DialogDescription>
              </DialogHeader>
              <ReportUpload
                onFilesUploaded={handleFilesUploaded}
                maxFiles={10}
                allowedTypes={['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv']}
                maxFileSize={50}
              />
            </DialogContent>
          </Dialog>
        
        </div>
      </div>

      {/* Reviewer Workload Dashboard */}
      {showWorkloadDashboard && (
        <ReviewerWorkloadDashboard projectId={projectId} />
      )}

      {/* Pending Reviews Section */}
      <PendingReviews projectId={projectId} refreshTrigger={pendingReviewsRefreshTrigger} />

      {/* Loading indicator */}
      {isLoadingFiles && (
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading reports...</p>
          </div>
        </div>
      )}

      {/* Filter Controls */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4" />
            <span className="text-sm font-medium">Filters:</span>
          </div>
          
          {/* Frequency Filter */}
          <Select value={selectedFrequency} onValueChange={setSelectedFrequency}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="All Frequencies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Frequencies</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="bimonthly">Bi-monthly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="bi-annual">Bi-annual</SelectItem>
              <SelectItem value="annual">Annual</SelectItem>
              <SelectItem value="adhoc">Ad-hoc</SelectItem>
            </SelectContent>
          </Select>

          {/* Report Type Filter */}
          <Select value={selectedReportType} onValueChange={setSelectedReportType}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="All Report Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Report Types</SelectItem>
              {REPORT_TYPES.map((type) => (
                <SelectItem key={type.code} value={type.code}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="IN_REVIEW">In Review</SelectItem>
              <SelectItem value="CHANGES_REQUESTED">Changes Requested</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          {/* Time Range Filter */}
          <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="All Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="3m">Last 3 months</SelectItem>
              <SelectItem value="6m">Last 6 months</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>

          {/* Activity Filter - Only show for Activity Reports */}
          {selectedReportType === 'ACT' && (
            <Select value={selectedActivity} onValueChange={setSelectedActivity}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All Activities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Activities</SelectItem>
                {activities.map((activity) => (
                  <SelectItem key={activity.id} value={activity.id}>
                    {activity.title || activity.name || `Activity ${activity.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Clear Filters Button */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setSelectedFrequency('all');
              setSelectedStatus('all');
              setSelectedReportType('all');
              setSelectedActivity('all');
              setSelectedCategory('all');
              setSelectedTimeRange('all');
            }}
            className="w-full sm:w-auto"
          >
            Clear Filters
          </Button>
        </div>

        {/* Filter Summary */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {filteredReports.length} of {displayReports.length} reports
            {(selectedFrequency !== 'all' || selectedStatus !== 'all' || selectedReportType !== 'all' || selectedActivity !== 'all' || selectedTimeRange !== 'all') && (
              <span className="ml-2">
                • Filtered by: 
                {selectedFrequency !== 'all' && <span className="ml-1 font-medium">{selectedFrequency}</span>}
                {selectedStatus !== 'all' && <span className="ml-1 font-medium">{selectedStatus.replace(/_/g, ' ').toLowerCase()}</span>}
                {selectedReportType !== 'all' && <span className="ml-1 font-medium">{REPORT_TYPES.find(t => t.code === selectedReportType)?.name}</span>}
                {selectedActivity !== 'all' && <span className="ml-1 font-medium">{activities.find(a => a.id === selectedActivity)?.title || activities.find(a => a.id === selectedActivity)?.name}</span>}
                {selectedTimeRange !== 'all' && <span className="ml-1 font-medium">{selectedTimeRange}</span>}
              </span>
            )}
          </p>
        </div>

        {/* Reports Table */}
        <div className="w-full overflow-x-auto">
          {filteredReports.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-3 pr-4">Name</th>
                  <th className="py-3 pr-4">Category</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Uploaded</th>
                  <th className="py-3 pr-4">Uploaded By</th>
                  <th className="py-3 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((report) => (
                  <tr key={report.id} className="border-b last:border-0">
                    <td className="py-3 pr-4 max-w-[420px] cursor-pointer" onClick={() => setOpenWorkflowId((report as any).workflowId || report.id)}>
                      <div className="flex items-center gap-2">
                        {getFileIcon(report.type)}
                        <div className="min-w-0">
                          <div className="font-medium truncate max-w-[380px]" title={report.name}>{report.name}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[380px]" title={report.description}>{report.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge className={getCategoryBadge(report.category)}>{report.category}</Badge>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge className={getStatusBadge((report).approvalWorkflow?.status || report.status)}>
                        {((report).approvalWorkflow?.status || report.status || 'pending').toUpperCase().replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">{new Date(report.uploadDate).toLocaleDateString()}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">{report.uploadedBy}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => handleDownloadFile(report.id, report.name)}>
                          <Download className="h-4 w-4" />
                          Download
                        </Button>
                        <Button variant="destructive" size="sm" className="gap-2" onClick={() => handleDeleteFile(report.id, report.name)}>
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            !isLoadingFiles && (
              <Card className="w-full">
                <CardContent className="text-center py-8 w-full">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2 break-words whitespace-normal">No reports found</h3>
                  <p className="text-muted-foreground break-words whitespace-normal">
                    No reports available for the selected filters. Upload your first report to get started.
                  </p>
                </CardContent>
              </Card>
            )
          )}
        </div>
        {/* Audit Trail Dialog */}
        <Dialog open={!!openWorkflowId} onOpenChange={(o) => !o && setOpenWorkflowId(null)}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            {openWorkflowId && (
              <ReportWorkflowDetail 
                reportId={openWorkflowId} 
                onClose={() => setOpenWorkflowId(null)} 
                onChanged={() => loadReports()}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
} 