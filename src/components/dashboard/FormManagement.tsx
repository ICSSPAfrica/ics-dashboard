import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Eye, 
  Edit, 
  Share2, 
  BarChart3, 
  Download,
  Trash2,
  Copy,
  FileText,
  Calendar,
  Users,
  ArrowLeft,
  FolderOpen,
  CheckCircle,
  Upload,
  Archive,
  XCircle,
  RotateCcw
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useForm } from '@/contexts/FormContext';
import { createEnhancedPermissionManager } from '@/lib/permissions';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { toast } from '@/hooks/use-toast';
import { Form } from './form-creation-wizard/types';
import { formsApi } from '@/lib/api/formsApi';
import { FormImportModal } from './form-management/FormImportModal';
import { FormExportModal } from './form-management/FormExportModal';
import { 
  saveFormManagementFilters, 
  loadFormManagementFilters, 
  clearFormManagementFilters,
  getDefaultFormManagementFilters,
  FormManagementFilters,
  addForm,
  updateForm
} from '@/lib/formLocalStorageUtils';

export function FormManagement() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const permissionManager = createEnhancedPermissionManager({
    user,
    isAuthenticated,
    isLoading: authLoading,
  });
  const { getProjectForms, loadProjectForms, duplicateForm, deleteForm, projectForms } = useForm();
  
  // Get forms from context for the current project
  const forms = projectId ? (projectForms[projectId] || []) : [];
  // Permission flags (project-scoped)
  const canViewForms = projectId ? permissionManager.canViewForms(projectId) : false;
  const canCreateForms = projectId ? permissionManager.hasProjectPermission('forms', 'create', projectId) : false;
  const canEditForms = projectId ? permissionManager.canEditForms(projectId) : false;
  const canDeleteForms = projectId ? permissionManager.hasProjectPermission('forms', 'delete', projectId) : false;
  const canViewResponses = projectId ? permissionManager.canViewFormResponses(projectId) : false;
  const [isFormsLoading, setIsFormsLoading] = useState(true);
  const [copiedFormId, setCopiedFormId] = useState<string | null>(null);
  const [showCopyPopup, setShowCopyPopup] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formToDelete, setFormToDelete] = useState<Form | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load forms when component mounts or projectId changes
  useEffect(() => {
    const loadForms = async () => {
      if (projectId) {
        setIsFormsLoading(true);
        console.log('🔄 FormManagement: Loading fresh form data for project:', projectId);
        
        try {
          // Load forms using context method - this will update the context state
          await loadProjectForms(projectId);
          console.log('✅ FormManagement: Loaded forms from context');
        } catch (error) {
          console.error('Error loading forms:', error);
          toast({
            title: "Error",
            description: "Failed to load forms",
            variant: "destructive",
          });
        } finally {
          setIsFormsLoading(false);
        }
      }
    };

    loadForms();
  }, [projectId]); // Only depend on stable projectId, not functions
  
  // Load saved filters from localStorage
  const [filters, setFilters] = useState<FormManagementFilters>(() => {
    const savedFilters = loadFormManagementFilters();
    return savedFilters || getDefaultFormManagementFilters();
  });


  
  // Get project name from context or use a default
  const projectName = projectId ? `Project ${projectId.toUpperCase()}` : 'Unknown Project';

  // Save filters to localStorage when they change
  useEffect(() => {
    saveFormManagementFilters(filters);
  }, [filters]);

  // Refresh forms when window gains focus (user returns from form wizard)
  useEffect(() => {
    const handleFocus = async () => {
    if (projectId) {
      console.log('🔄 FormManagement: Refreshing forms on focus for project:', projectId);
      await loadProjectForms(projectId);
    }
    };

    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [projectId, loadProjectForms]);

  // Initialize with sample data if no forms exist (for demonstration)
  useEffect(() => {
    if (projectId && forms.length === 0) {
      // Check if we should initialize with sample data
      const hasInitialized = localStorage.getItem(`ics_forms_initialized_${projectId}`);
     /*  if (!hasInitialized) {
        const sampleForms: Form[] = [
          {
            id: `sample-form-1-${projectId}`,
    title: 'Baseline Survey - Education Project',
    description: 'Initial data collection for the education improvement project',
            projectId: projectId,
            createdBy: user?.id || 'user-1',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-20'),
    status: 'PUBLISHED',
    version: 1,
    sections: [],
    settings: {
      requireAuthentication: false,
      thankYouMessage: 'Thank you for your response!',
      notificationEmails: [],
    },
    responseCount: 127,
    lastResponseAt: new Date('2024-01-25'),
    tags: ['baseline', 'education'],
    category: 'Survey',
  },
  {
            id: `sample-form-2-${projectId}`,
    title: 'Monthly Progress Monitoring',
    description: 'Monthly check-in on project activities and outcomes',
            projectId: projectId,
            createdBy: user?.id || 'user-1',
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
    status: 'DRAFT',
    version: 1,
    sections: [],
    settings: {
      requireAuthentication: true,
      thankYouMessage: 'Thank you for your response!',
      notificationEmails: [],
    },
    responseCount: 0,
    tags: ['monitoring', 'monthly'],
    category: 'Monitoring',
  },
];

        sampleForms.forEach(form => addForm(form));
        localStorage.setItem(`ics_forms_initialized_${projectId}`, 'true');
      } */
    }
  }, [projectId, forms.length, user?.id]);

  // Update search term from filters
  const searchTerm = filters.searchTerm;
  const statusFilter = filters.status.length > 0 ? filters.status[0] : 'all';
  const categoryFilter = filters.projectId.length > 0 ? filters.projectId[0] : 'all';

  // Filter forms based on search and filters
  const filteredForms = forms.filter((form) => {
    const matchesSearch = form.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         form.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         form.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || form.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || form.category === categoryFilter;
    
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const getStatusColor = (status: Form['status']) => {
    switch (status) {
      case 'PUBLISHED': return 'default';
      case 'DRAFT': return 'secondary';
      case 'CLOSED': return 'destructive';
      case 'ARCHIVED': return 'outline';
      default: return 'secondary';
    }
  };

  const handleCreateForm = () => {
    navigate(`/dashboard/projects/${projectId}/forms/create`);
  };

  const handleEditForm = (formId: string) => {
    navigate(`/dashboard/projects/${projectId}/forms/edit/${formId}`);
  };

  const handleViewForm = (formId: string) => {
    navigate(`/dashboard/projects/${projectId}/forms/preview/${formId}`);
  };

  const handleViewResponses = (formId: string) => {
    navigate(`/dashboard/projects/${projectId}/forms/responses/${formId}`);
  };

  const handleDuplicateForm = async (form: Form) => {
    if (!projectId) {
      toast({
        title: "Error",
        description: "Project ID is required to duplicate forms.",
        variant: "destructive",
      });
      return;
    }

    try {
      const duplicatedForm = await duplicateForm(projectId, form.id);
      if (duplicatedForm) {
        // Refresh the forms list to include the new duplicated form
        await loadProjectForms(projectId);
        toast({
          title: "Form Duplicated",
          description: `"${form.title}" has been duplicated successfully.`,
        });
      }
    } catch (error) {
      toast({
        title: "Duplication Failed",
        description: "Could not duplicate the form. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteForm = (form: Form) => {
    if (!projectId) {
      toast({
        title: "Error",
        description: "Project ID is required to delete forms.",
        variant: "destructive",
      });
      return;
    }

    setFormToDelete(form);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!formToDelete || !projectId) return;

    setIsDeleting(true);
    try {
      const success = await deleteForm(projectId, formToDelete.id);
      if (success) {
        // The FormContext already updates the local state and shows success toast
        // No need for additional API call or toast here
        console.log('Form deleted successfully');
      } else {
        throw new Error('Delete operation failed');
      }
    } catch (error) {
      console.error('Error deleting form:', error);
      toast({
        title: "Delete Failed",
        description: "Could not delete the form. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setFormToDelete(null);
    }
  };

  const handleShareForm = async (form: Form) => {
    // Only allow sharing published forms
    if (form.status !== 'PUBLISHED') {
      toast({
        title: "Cannot Share Form",
        description: "Only published forms can be shared. Please publish the form first.",
        variant: "destructive",
        duration: 4000,
      });
      return;
    }

    try {
      const baseUrl = window.location.origin;
      const formUrl = `${baseUrl}/fill/${form.id}`;
      await navigator.clipboard.writeText(formUrl);
      
      // Show popup feedback
      setShowCopyPopup(true);
      setTimeout(() => setShowCopyPopup(false), 2000);
      
      toast({
        title: "Link Copied!",
        description: "Form link has been copied to clipboard.",
        duration: 4000,
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Could not copy link to clipboard. Please try again.",
        variant: "destructive",
        duration: 4000,
      });
    }
  };

  const handleArchiveForm = async (form: Form) => {
    if (!projectId) {
      toast({
        title: "Error",
        description: "Project ID is required to archive forms.",
        variant: "destructive",
      });
      return;
    }

    try {
      await formsApi.archiveForm(projectId, form.id);
      await loadProjectForms(projectId);
      toast({
        title: "Form Archived",
        description: `"${form.title}" has been archived. It is no longer accepting responses, but existing data is preserved.`,
      });
    } catch (error) {
      toast({
        title: "Archive Failed",
        description: "Could not archive the form. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDisableForm = async (form: Form) => {
    if (!projectId) {
      toast({
        title: "Error",
        description: "Project ID is required to disable forms.",
        variant: "destructive",
      });
      return;
    }

    try {
      await formsApi.disableForm(projectId, form.id);
      await loadProjectForms(projectId);
      toast({
        title: "Form Disabled",
        description: `"${form.title}" has been disabled. It is no longer accepting responses, but existing data is preserved.`,
      });
    } catch (error) {
      toast({
        title: "Disable Failed",
        description: "Could not disable the form. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRestoreForm = async (form: Form) => {
    if (!projectId) {
      toast({
        title: "Error",
        description: "Project ID is required to restore forms.",
        variant: "destructive",
      });
      return;
    }

    try {
      await formsApi.restoreForm(projectId, form.id);
      await loadProjectForms(projectId);
      toast({
        title: "Form Restored",
        description: `"${form.title}" has been restored and is now accepting responses again.`,
      });
    } catch (error) {
      toast({
        title: "Restore Failed",
        description: "Could not restore the form. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Filter handlers
  const handleSearchChange = (value: string) => {
    setFilters(prev => ({ ...prev, searchTerm: value }));
  };

  const handleStatusFilterChange = (value: string) => {
    setFilters(prev => ({ 
      ...prev, 
      status: value === 'all' ? [] : [value] 
    }));
  };

  const handleCategoryFilterChange = (value: string) => {
    setFilters(prev => ({ 
      ...prev, 
      projectId: value === 'all' ? [] : [value] 
    }));
  };

  const handleClearFilters = () => {
    setFilters(getDefaultFormManagementFilters());
    clearFormManagementFilters();
  };

  const handleImportSuccess = async (importedForms: Form[]) => {
    // Refresh the forms list to include the imported forms
    if (projectId) {
      await loadProjectForms(projectId);
    }
    
    toast({
      title: "Import Successful",
      description: `${importedForms.length} form(s) imported successfully.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Project Navigation Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button 
          variant="outline" 
          onClick={() => navigate(`/dashboard/projects/${projectId}`)}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Project
        </Button>
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-blue-600" />
          <span className="text-lg font-medium text-gray-700">{projectName}</span>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 break-words">Form Management</h1>
          <p className="text-gray-600 mt-2 text-sm md:text-base break-words">Create and manage data collection forms for {projectName}</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
          {projectId && permissionManager.canExportFormResponses(projectId) && (
            <FormExportModal 
              forms={forms}
              projectId={projectId}
              trigger={
                <Button variant="outline" className="flex items-center gap-2 w-full sm:w-auto justify-center">
                  <Download className="w-4 h-4" />
                  <span className="whitespace-nowrap">Export Forms ({forms.length})</span>
                </Button>
              }
            />
          )}
          {canCreateForms && (
            <FormImportModal 
              projectId={projectId || ''} 
              onImportSuccess={handleImportSuccess}
              trigger={
                <Button variant="outline" className="flex items-center gap-2 w-full sm:w-auto justify-center">
                  <Upload className="w-4 h-4" />
                  <span className="whitespace-nowrap">Import Forms</span>
                </Button>
              }
            />
          )}
          {canCreateForms && (
            <Button onClick={handleCreateForm} className="flex items-center gap-2 w-full sm:w-auto justify-center">
              <Plus className="w-4 h-4" />
              <span className="whitespace-nowrap">Create New Form</span>
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <FileText className="w-8 h-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-2xl font-bold">{forms.length}</p>
                <p className="text-xs text-gray-500">Total Forms</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Eye className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-2xl font-bold">{forms.filter(f => f.status === 'PUBLISHED').length}</p>
                <p className="text-xs text-gray-500">Published</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-2xl font-bold">{forms.reduce((sum, form) => sum + form.responseCount, 0)}</p>
                <p className="text-xs text-gray-500">Total Responses</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Edit className="w-8 h-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-2xl font-bold">{forms.filter(f => f.status === 'DRAFT').length}</p>
                <p className="text-xs text-gray-500">Drafts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="w-full">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search forms by title, description, or tags..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                <SelectTrigger className="w-full sm:w-auto sm:min-w-[140px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={categoryFilter} onValueChange={handleCategoryFilterChange}>
                <SelectTrigger className="w-full sm:w-auto sm:min-w-[140px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Survey">Survey</SelectItem>
                  <SelectItem value="Monitoring">Monitoring</SelectItem>
                  <SelectItem value="Evaluation">Evaluation</SelectItem>
                  <SelectItem value="Registration">Registration</SelectItem>
                </SelectContent>
              </Select>

              <Button 
                variant="outline" 
                onClick={handleClearFilters}
                className="w-full sm:w-auto"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Forms Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Forms ({filteredForms.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredForms.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">
                {forms.length === 0 ? 'No forms created yet' : 'No forms match your filters'}
              </p>
              <p className="text-sm text-gray-500 mb-4">
                {forms.length === 0 
                  ? 'Create your first form to start collecting data'
                  : 'Try adjusting your search or filter criteria'
                }
              </p>
              {forms.length === 0 && canCreateForms && (
                <Button onClick={handleCreateForm}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Form
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Form</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Responses</TableHead>
                      <TableHead>Last Response</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredForms.map((form) => (
                      <TableRow 
                        key={form.id} 
                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => { if (canViewResponses) handleViewResponses(form.id); }}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium break-words">{form.title}</p>
                            <p className="text-sm text-gray-500 break-words">{form.description}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {form.tags.map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusColor(form.status)}>
                            {form.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4 text-gray-400" />
                            {form.responseCount}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {form.lastResponseAt
                              ? new Date(form.lastResponseAt).toLocaleDateString()
                              : 'None'
                            }
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(form.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  className="h-8 w-8 p-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewForm(form.id); }}>
                                <Eye className="mr-2 h-4 w-4" />
                                Preview Form
                              </DropdownMenuItem>
                              {canEditForms && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditForm(form.id); }}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Form
                                </DropdownMenuItem>
                              )}
                              {canViewResponses && form.responseCount > 0 && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewResponses(form.id); }}>
                                  <BarChart3 className="mr-2 h-4 w-4" />
                                  View Responses ({form.responseCount})
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {form.status === 'PUBLISHED' && canViewForms && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleShareForm(form); }}>
                                <Share2 className="mr-2 h-4 w-4" />
                                Share Link
                              </DropdownMenuItem>
                              )}
                              {canCreateForms && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicateForm(form); }}>
                                  <Copy className="mr-2 h-4 w-4" />
                                  Duplicate
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {(form.status === 'PUBLISHED' || form.status === 'DRAFT') && canEditForms && (
                                <>
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleArchiveForm(form); }}>
                                    <Archive className="mr-2 h-4 w-4" />
                                    Archive
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDisableForm(form); }}>
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Disable
                                  </DropdownMenuItem>
                                </>
                              )}
                              {(form.status === 'ARCHIVED' || form.status === 'CLOSED') && canEditForms && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRestoreForm(form); }}>
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  Restore
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {canDeleteForms && (
                                <DropdownMenuItem 
                                  onClick={(e) => { e.stopPropagation(); handleDeleteForm(form); }}
                                  className="text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden space-y-4">
                {filteredForms.map((form) => (
                  <Card 
                    key={form.id} 
                    className="w-full cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => { if (canViewResponses) handleViewResponses(form.id); }}
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-col space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-base break-words">{form.title}</h3>
                            <p className="text-sm text-gray-500 break-words">{form.description}</p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                className="h-8 w-8 p-0 flex-shrink-0 ml-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewForm(form.id); }}>
                              <Eye className="mr-2 h-4 w-4" />
                              Preview Form
                            </DropdownMenuItem>
                            {canEditForms && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditForm(form.id); }}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Form
                              </DropdownMenuItem>
                            )}
                            {canViewResponses && form.responseCount > 0 && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewResponses(form.id); }}>
                                <BarChart3 className="mr-2 h-4 w-4" />
                                View Responses ({form.responseCount})
                              </DropdownMenuItem>
                            )}
                              <DropdownMenuSeparator />
                            {form.status === 'PUBLISHED' && canViewForms && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleShareForm(form); }}>
                                <Share2 className="mr-2 h-4 w-4" />
                                Share Link
                              </DropdownMenuItem>
                              )}
                            {canCreateForms && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicateForm(form); }}>
                                <Copy className="mr-2 h-4 w-4" />
                                Duplicate
                              </DropdownMenuItem>
                            )}
                              <DropdownMenuSeparator />
                            {(form.status === 'PUBLISHED' || form.status === 'DRAFT') && canEditForms && (
                              <>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleArchiveForm(form); }}>
                                  <Archive className="mr-2 h-4 w-4" />
                                  Archive
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDisableForm(form); }}>
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Disable
                                </DropdownMenuItem>
                              </>
                            )}
                            {(form.status === 'ARCHIVED' || form.status === 'CLOSED') && canEditForms && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRestoreForm(form); }}>
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Restore
                              </DropdownMenuItem>
                            )}
                              <DropdownMenuSeparator />
                            {canDeleteForms && (
                              <DropdownMenuItem 
                                onClick={(e) => { e.stopPropagation(); handleDeleteForm(form); }}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        
                        <div className="flex flex-wrap gap-1">
                          {form.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        
                        <div className="flex flex-col space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Status:</span>
                            <Badge variant={getStatusColor(form.status)}>
                              {form.status}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Responses:</span>
                            <div className="flex items-center gap-1">
                              <Users className="w-4 h-4 text-gray-400" />
                              {form.responseCount}
                            </div>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Last Response:</span>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              <span className="text-right">
                                {form.lastResponseAt
                                  ? new Date(form.lastResponseAt).toLocaleDateString()
                                  : 'None'
                                }
                              </span>
                            </div>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Created:</span>
                            <span>{new Date(form.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Copy Success Popup */}
      {showCopyPopup && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
          <div className="bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Link copied to clipboard!</span>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Form"
        description={`Are you sure you want to delete "${formToDelete?.title}"? This action cannot be undone and will permanently delete the form and all its responses.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={confirmDelete}
        isLoading={isDeleting}
      />
    </div>
  );
}