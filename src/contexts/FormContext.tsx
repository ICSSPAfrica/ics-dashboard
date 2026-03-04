import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { Form, FormResponse, FormQuestion } from '../components/dashboard/form-creation-wizard/types';
import { formsApi, CreateFormDto, CreateFormResponseDto, UpdateFormResponseDto } from '../lib/api/formsApi';
import { toast } from '@/hooks/use-toast';
import { Project } from '../types/dashboard';
import { useAuth } from './AuthContext';

// Media types matching original system
export interface MediaMetadata {
  id: string;
  fileName: string;
  originalFileName: string;
  fileSize: number;
  fileType: string;
  mediaType: 'image' | 'video' | 'audio' | 'file';
  countryCode: string;
  projectCode: string;
  projectId: string;
  formId: string;
  formName: string;
  questionId: string;
  questionTitle: string;
  uploadedAt: Date;
  uploadedBy: string;
  tags?: string[];
  description?: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    address?: string;
  };
}

export interface StoredMediaFile {
  id: string;
  metadata: MediaMetadata;
  url?: string;
  filePath?: string;
}

// Offline queue types
interface OfflineQueueItem {
  id: string;
  type: 'form_response' | 'form_create' | 'form_update' | 'form_delete' | 'media_upload' | 'media_delete';
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

interface OfflineSyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  pendingItems: number;
  failedItems: number;
  syncProgress: number;
}

interface FormContextType {
  // Current form being edited/created
  currentForm: Form | null;
  setCurrentForm: (form: Form | Partial<Form> | null) => void;
  updateCurrentForm: (updates: Partial<Form>) => void;
  
  // Form responses for preview/testing
  formResponses: FormResponse[];
  addFormResponse: (response: FormResponse) => void;
  clearFormResponses: () => void;
  
  // Form preview state
  isPreviewMode: boolean;
  setIsPreviewMode: (mode: boolean) => void;
  
  // Form validation state
  formErrors: Record<string, string>;
  setFormErrors: (errors: Record<string, string>) => void;
  clearFormErrors: () => void;
  
  // Unsaved changes tracking
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  
  // Loading and error states
  loading: boolean;
  error: string | null;
  
  // Form CRUD operations
  createForm: (projectId: string, formData: CreateFormDto) => Promise<Form | null>;
  updateForm: (projectId: string, formId: string, updates: Partial<Form>) => Promise<Form | null>;
  deleteForm: (projectId: string, formId: string) => Promise<boolean>;
  duplicateForm: (projectId: string, formId: string) => Promise<Form | null>;
  loadForm: (projectId: string, formId: string) => Promise<Form | null>;
  loadProjectForms: (projectId: string) => Promise<Form[]>;
  
  // Form response management
  getFormResponses: (projectId: string, formId: string, options?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: 'all' | 'complete' | 'incomplete';
  }) => Promise<{ 
    responses: FormResponse[]; 
    total: number; 
    page: number; 
    limit: number; 
    totalPages: number;
    stats: { totalAll: number; totalComplete: number; totalIncomplete: number }
  }>;
  addFormResponseToStorage: (response: FormResponse) => Promise<FormResponse | null>;
  updateFormResponse: (projectId: string, formId: string, responseId: string, updates: UpdateFormResponseDto) => Promise<FormResponse | null>;
  deleteFormResponse: (projectId: string, formId: string, responseId: string) => Promise<void>;
  getProjectForms: (projectId: string) => Promise<Form[]>;
  
  // Media management
  uploadMediaFile: (
    file: File,
    project: Project,
    form: Form,
    questionId: string,
    questionTitle: string,
    uploadedBy: string,
    mediaType: 'image' | 'video' | 'audio' | 'file',
    location?: { latitude: number; longitude: number; accuracy?: number; address?: string },
    tags?: string[],
    description?: string
  ) => Promise<StoredMediaFile>;
  getMediaFiles: (projectId?: string, formId?: string) => Promise<StoredMediaFile[]>;
  getProjectMediaFiles: (projectId: string) => Promise<StoredMediaFile[]>;
  getFormMediaFiles: (formId: string, projectId: string) => Promise<StoredMediaFile[]>;
  searchMediaFiles: (projectId: string, query: string) => Promise<StoredMediaFile[]>;
  removeMediaFile: (projectId: string, formId: string, fileId: string) => Promise<boolean>;
  updateMediaFileMetadata: (projectId: string, formId: string, fileId: string, updates: Partial<MediaMetadata>) => Promise<StoredMediaFile | null>;
  getProjectMediaStats: (projectId: string) => Promise<any>;
  exportProjectMedia: (projectId?: string) => Promise<string>;
  importProjectMedia: (importData: string) => Promise<boolean>;
  refreshMediaFiles: () => void;
  
  // Offline support
  isOnline: boolean;
  syncStatus: OfflineSyncStatus;
  addToOfflineQueue: (type: OfflineQueueItem['type'], data: any) => void;
  processOfflineQueue: () => Promise<void>;
  retryFailedItems: () => Promise<void>;
  clearOfflineQueue: () => void;
  getOfflineQueue: () => OfflineQueueItem[];
  getFailedItems: () => OfflineQueueItem[];
  
  // Conditional question utilities
  getConditionalQuestions: (form: Form) => FormQuestion[];
  getConditionalResponses: (response: FormResponse, questionId: string) => Record<string, any>;
  validateConditionalQuestions: (form: Form, responses: Record<string, any>) => Record<string, string>;
  shouldShowSection: (section: any, responses: Record<string, any>) => boolean;
  getFormStatistics: (form: Form) => { totalQuestions: number; conditionalQuestions: number; conditionalSections: number; totalOptions: number };
  projectForms: Record<string, Form[]>;
}

const FormContext = createContext<FormContextType | undefined>(undefined);

interface FormProviderProps {
  children: ReactNode;
}

export function FormProvider({ children }: FormProviderProps) {
  const [currentForm, setCurrentFormState] = useState<Form | null>(null);
  const [formResponses, setFormResponses] = useState<FormResponse[]>([]);
  const [isPreviewMode, setIsPreviewModeState] = useState(false);
  const [formErrors, setFormErrorsState] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChangesState] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form response management state
  const [allFormResponses, setAllFormResponses] = useState<Record<string, FormResponse[]>>({});
  const [projectForms, setProjectForms] = useState<Record<string, Form[]>>({});
  
  // Media management state
  const [mediaFiles, setMediaFiles] = useState<StoredMediaFile[]>([]);
  const [isMediaLoading, setIsMediaLoading] = useState(false);
  
  const { isAuthenticated } = useAuth();

  // Offline support state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>([]);
  const [syncStatus, setSyncStatus] = useState<OfflineSyncStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSyncTime: null,
    pendingItems: 0,
    failedItems: 0,
    syncProgress: 0
  });

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus(prev => ({ ...prev, isOnline: true }));
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load offline queue from localStorage on mount
  useEffect(() => {
    try {
      const storedQueue = localStorage.getItem('formOfflineQueue');
      if (storedQueue) {
        const rawQueue = JSON.parse(storedQueue);
        // Sanitize any legacy queued items to only include API-allowed fields
        const queue = (rawQueue as OfflineQueueItem[]).map(item => {
          if (item.type === 'form_response') {
            const d = item.data || {};
            const sanitized = {
              formId: d.formId,
              respondentId: d.respondentId,
              respondentEmail: d.respondentEmail,
              isComplete: d.isComplete,
              ipAddress: d.ipAddress,
              userAgent: d.userAgent,
              source: d.source,
              data: d.data,
            };
            return { ...item, data: sanitized } as OfflineQueueItem;
          }
          return item;
        });
        setOfflineQueue(queue);
        setSyncStatus(prev => ({ ...prev, pendingItems: queue.length }));
      }
    } catch (error) {
      console.error('Error loading offline queue:', error);
    }
  }, []);

  // Save offline queue to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem('formOfflineQueue', JSON.stringify(offlineQueue));
      setSyncStatus(prev => ({ ...prev, pendingItems: offlineQueue.length }));
    } catch (error) {
      console.error('Error saving offline queue:', error);
    }
  }, [offlineQueue]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && offlineQueue.length > 0) {
      processOfflineQueue();
    }
  }, [isOnline]);

  // Callback setters
  const setCurrentForm = useCallback((form: Form | Partial<Form> | null) => {
    setCurrentFormState(form as Form | null);
    setHasUnsavedChangesState(false);
  }, []);

  const updateCurrentForm = useCallback((updates: Partial<Form>) => {
    setCurrentFormState(prev => prev ? { ...prev, ...updates } : null);
    setHasUnsavedChangesState(true);
  }, []);

  const addFormResponse = useCallback((response: FormResponse) => {
    setFormResponses(prev => [...prev, response]);
  }, []);

  const clearFormResponses = useCallback(() => {
    setFormResponses([]);
  }, []);

  const setFormErrors = useCallback((errors: Record<string, string>) => {
    setFormErrorsState(errors);
  }, []);

  const clearFormErrors = useCallback(() => {
    setFormErrorsState({});
  }, []);

  const setIsPreviewMode = useCallback((mode: boolean) => {
    setIsPreviewModeState(mode);
  }, []);

  const setHasUnsavedChanges = useCallback((hasChanges: boolean) => {
    setHasUnsavedChangesState(hasChanges);
  }, []);

  // Offline queue management
  const addToOfflineQueue = useCallback((type: OfflineQueueItem['type'], data: any) => {
    const queueItem: OfflineQueueItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3
    };
    setOfflineQueue(prev => [...prev, queueItem]);
  }, []);

  // Migrate legacy (flat) conditional responses into the new nested structure
  const migrateConditionalResponses = useCallback(async (queuedData: any) => {
    try {
      // Expect shape queuedData = { formId, data, ... }
      if (!queuedData || !queuedData.formId || !queuedData.data) return queuedData;

      const originalData = queuedData.data;
      // If already migrated, skip
      if (originalData && typeof originalData === 'object' && originalData._migrated) {
        return queuedData;
      }

      // Load form definition to resolve parent/conditional relationships
      let form: Form | null = null;
      try {
        const { getFormById } = await import('@/lib/formLocalStorageUtils');
        form = getFormById(queuedData.formId);
      } catch (e) {
        // no-op; fallback below
      }
      if (!form) {
        try {
          form = await formsApi.getFormByIdOnly(queuedData.formId);
        } catch (e) {
          // If we cannot resolve the form, return original to avoid data loss
          return queuedData;
        }
      }
      if (!form) return queuedData;

      // Build a quick lookup from conditional question id -> parent question id
      const conditionalToParent: Record<string, { parentId: string }> = {};
      form.sections.forEach(section => {
        section.questions.forEach(question => {
          if ((question as any).options && Array.isArray((question as any).options)) {
            (question as any).options.forEach((opt: any) => {
              if (opt.conditionalQuestions && Array.isArray(opt.conditionalQuestions)) {
                opt.conditionalQuestions.forEach((cq: any) => {
                  if (cq && cq.id) {
                    conditionalToParent[cq.id] = { parentId: question.id };
                  }
                });
              }
            });
          }
        });
      });

      // Detect if any top-level keys are conditional question ids (legacy flat structure)
      const processedData: Record<string, any> = {};
      const stagedConditional: Record<string, { parentId: string; value: any }> = {};

      Object.entries(originalData).forEach(([qid, value]) => {
        const mapping = conditionalToParent[qid];
        if (mapping) {
          // Legacy conditional response found at top-level; stage for merge
          stagedConditional[qid] = { parentId: mapping.parentId, value };
        } else {
          processedData[qid] = value;
        }
      });

      // If nothing to migrate, return as-is
      if (Object.keys(stagedConditional).length === 0) {
        return queuedData;
      }

      // Merge staged conditionals into their parent entries using the new schema
      Object.values(stagedConditional).forEach(({ parentId, value }, idx) => {
        const conditionalId = Object.keys(stagedConditional)[idx];
        const existingParent = processedData[parentId];
        if (existingParent === undefined || existingParent === null) {
          processedData[parentId] = { [conditionalId]: value };
        } else if (typeof existingParent === 'object' && !Array.isArray(existingParent)) {
          processedData[parentId] = { ...existingParent, [conditionalId]: value };
        } else {
          processedData[parentId] = { _parentValue: existingParent, [conditionalId]: value };
        }
      });

      return {
        ...queuedData,
        data: { ...processedData, _migrated: true }
      };
    } catch (e) {
      // On any error, return original data to avoid losing submissions
      return queuedData;
    }
  }, []);

  const processOfflineQueue = useCallback(async () => {
    if (!isOnline || offlineQueue.length === 0) return;

    setSyncStatus(prev => ({ ...prev, isSyncing: true, syncProgress: 0 }));
    // Migrate any legacy queued items into the latest schema before syncing
    const migratedQueue: OfflineQueueItem[] = await Promise.all(
      offlineQueue.map(async (item) => {
        if (item.type === 'form_response' && item.data && item.data.data) {
          const migrated = await migrateConditionalResponses(item.data);
          return { ...item, data: migrated } as OfflineQueueItem;
        }
        return item;
      })
    );

    const results = await formsApi.syncOfflineData(migratedQueue);
    const syncedCount = migratedQueue.length;
    
    if (results.success) {
      setOfflineQueue([]);
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: new Date(),
        pendingItems: 0,
        failedItems: 0,
        syncProgress: 100
      }));
      toast({
        title: "✅ Sync Complete!",
        description: `Successfully synced ${syncedCount} ${syncedCount === 1 ? 'item' : 'items'} to the server. All pending data has been uploaded.`,
        duration: 5000,
      });
    } else {
      setOfflineQueue(results.failedItems);
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        pendingItems: results.failedItems.length,
        failedItems: results.failedItems.length,
        syncProgress: 100
      }));
      toast({
        title: "Partial Sync",
        description: `${offlineQueue.length - results.failedItems.length} items synced, ${results.failedItems.length} failed`,
        variant: "destructive",
      });
    }
  }, [isOnline, offlineQueue]);

  const retryFailedItems = useCallback(async () => {
    const failedItems = offlineQueue.filter(item => item.retryCount >= item.maxRetries);
    const retryItems = failedItems.map(item => ({ ...item, retryCount: 0 }));
    
    setOfflineQueue(prev => [
      ...prev.filter(item => item.retryCount < item.maxRetries),
      ...retryItems
    ]);
    
    await processOfflineQueue();
  }, [offlineQueue, processOfflineQueue]);

  const clearOfflineQueue = useCallback(() => {
    setOfflineQueue([]);
    setSyncStatus(prev => ({ ...prev, pendingItems: 0, failedItems: 0 }));
  }, []);

  const getOfflineQueue = useCallback(() => offlineQueue, [offlineQueue]);

  const getFailedItems = useCallback(() => {
    return offlineQueue.filter(item => item.retryCount >= item.maxRetries);
  }, [offlineQueue]);

  // CRUD Operations
  const createForm = useCallback(async (projectId: string, formData: CreateFormDto): Promise<Form | null> => {
    setLoading(true);
    setError(null);
    
    try {
      if (!isOnline) {
        addToOfflineQueue('form_create', { ...formData, projectId });
        toast({
          title: "Offline Mode",
          description: "Form will be created when you're back online",
        });
        return null;
      }

      const form = await formsApi.createForm(projectId, formData);
      
      // Update local cache
      setProjectForms(prev => ({
        ...prev,
        [projectId]: [...(prev[projectId] || []), form]
      }));
      
      toast({
        title: "Success",
        description: "Form created successfully",
      });
      return form;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create form';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      addToOfflineQueue('form_create', { ...formData, projectId });
      return null;
    } finally {
      setLoading(false);
    }
  }, [isOnline, addToOfflineQueue]);

  const updateForm = useCallback(async (projectId: string, formId: string, updates: Partial<Form>): Promise<Form | null> => {
    setLoading(true);
    setError(null);
    
    try {
      if (!isOnline) {
        addToOfflineQueue('form_update', { ...updates, projectId, id: formId });
        toast({
          title: "Offline Mode",
          description: "Changes will be saved when you're back online",
        });
        return null;
      }

      const form = await formsApi.updateForm(projectId, formId, updates);
      
      // Update local cache
      setProjectForms(prev => ({
        ...prev,
        [projectId]: (prev[projectId] || []).map(f => f.id === formId ? form : f)
      }));
      
      if (currentForm?.id === formId) {
        setCurrentForm(form);
      }
      
      setHasUnsavedChangesState(false);
      toast({
        title: "Success",
        description: "Form updated successfully",
      });
      return form;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update form';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      addToOfflineQueue('form_update', { ...updates, projectId, id: formId });
      return null;
    } finally {
      setLoading(false);
    }
  }, [isOnline, addToOfflineQueue, currentForm]);

  const deleteForm = useCallback(async (projectId: string, formId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      if (!isOnline) {
        addToOfflineQueue('form_delete', { projectId, id: formId });
        toast({
          title: "Offline Mode",
          description: "Form will be deleted when you're back online",
        });
        return false;
      }

      await formsApi.deleteForm(projectId, formId);
      
      // Update local cache
      setProjectForms(prev => ({
        ...prev,
        [projectId]: (prev[projectId] || []).filter(f => f.id !== formId)
      }));
      
      if (currentForm?.id === formId) {
        setCurrentForm(null);
      }
      
      toast({
        title: "Success",
        description: "Form deleted successfully",
      });
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete form';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      addToOfflineQueue('form_delete', { projectId, id: formId });
      return false;
    } finally {
      setLoading(false);
    }
  }, [isOnline, addToOfflineQueue, currentForm]);

  const duplicateForm = useCallback(async (projectId: string, formId: string): Promise<Form | null> => {
    setLoading(true);
    setError(null);
    
    try {
      if (!isOnline) {
        toast({
          title: "Offline Mode",
          description: "Cannot duplicate forms while offline",
          variant: "destructive",
        });
        return null;
      }

      console.log('🔄 FormContext: Starting duplicate form for project:', projectId, 'formId:', formId);
      const form = await formsApi.duplicateForm(projectId, formId);
      console.log('📥 FormContext: Received duplicated form from API:', JSON.stringify(form, null, 2));
      
      // Log questions and their options
      if (form.sections) {
        form.sections.forEach((section, sectionIndex) => {
          console.log(`📋 FormContext: Section ${sectionIndex} (${section.title}):`, section.questions?.length || 0, 'questions');
          section.questions?.forEach((question, questionIndex) => {
            if (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') {
              console.log(`🎯 FormContext: Question ${questionIndex} (${question.title}):`, {
                type: question.type,
                optionsCount: question.options?.length || 0,
                options: question.options?.map(opt => ({ id: opt.id, label: opt.label, value: opt.value })) || []
              });
            }
          });
        });
      }
      
      // Update local cache
      setProjectForms(prev => ({
        ...prev,
        [projectId]: [...(prev[projectId] || []), form]
      }));
      
      console.log('✅ FormContext: Updated local cache with duplicated form');
      
      toast({
        title: "Success",
        description: "Form duplicated successfully",
      });
      return form;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to duplicate form';
      console.error('❌ FormContext: Error duplicating form:', errorMessage);
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [isOnline]);

  const loadForm = useCallback(async (projectId: string, formId: string): Promise<Form | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const form = await formsApi.getForm(projectId, formId);
      setCurrentForm(form);
      return form;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load form';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [setCurrentForm]);

  const loadProjectForms = useCallback(async (projectId: string): Promise<Form[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const forms = await formsApi.getProjectForms(projectId);
      
      // Update local cache
      setProjectForms(prev => ({ ...prev, [projectId]: forms }));
      
      return forms;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load project forms';
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getProjectForms = useCallback(async (projectId: string): Promise<Form[]> => {
    // Return cached forms if available, otherwise load from API
    const cached = projectForms[projectId];
    if (cached) {
      return cached;
    }
    return loadProjectForms(projectId);
  }, [projectForms, loadProjectForms]);

  // Form Response Management
  const getFormResponses = useCallback(async (
    projectId: string, 
    formId: string,
    options?: {
      page?: number;
      limit?: number;
      search?: string;
      status?: 'all' | 'complete' | 'incomplete';
    }
  ): Promise<{ 
    responses: FormResponse[]; 
    total: number; 
    page: number; 
    limit: number; 
    totalPages: number;
    stats: { totalAll: number; totalComplete: number; totalIncomplete: number }
  }> => {
    try {
      const result = await formsApi.getFormResponses(projectId, formId, options);
      
      // Update local cache with responses (for other components that might need them)
      setAllFormResponses(prev => ({ ...prev, [formId]: result.responses }));
      
      return result;
    } catch (err) {
      console.error('Failed to load form responses:', err);
      // Return empty result on error - don't rely on cache to avoid dependency issues
      return {
        responses: [],
        total: 0,
        page: options?.page || 1,
        limit: options?.limit || 100,
        totalPages: 0,
        stats: {
          totalAll: 0,
          totalComplete: 0,
          totalIncomplete: 0
        }
      };
    }
  }, []); // No dependencies - function is stable and doesn't cause re-renders

  const addFormResponseToStorage = useCallback(async (response: FormResponse): Promise<FormResponse | null> => {
    try {
      if (!isOnline) {
        // Queue only allowed DTO fields for API
        // Note: The response.data should already be processed with conditional responses merged
        // by the calling code (PublicFormFiller.handleSubmit)
        addToOfflineQueue('form_response', {
          formId: response.formId,
          respondentId: response.respondentId,
          respondentEmail: response.respondentEmail,
          isComplete: response.isComplete,
          ipAddress: (response as any).ipAddress,
          userAgent: (response as any).userAgent,
          source: (response as any).source,
          data: response.data // This should already contain merged conditional responses
        });
        toast({
          title: "Offline Mode",
          description: "Response will be submitted when you're back online",
        });
        return null;
      }

      const submitPayload = {
        formId: response.formId,
        respondentId: response.respondentId,
        respondentEmail: response.respondentEmail,
        isComplete: response.isComplete,
        data: response.data
      };
      const submittedResponse = isAuthenticated
        ? await formsApi.submitResponseAuthenticated(submitPayload)
        : await formsApi.submitResponse(submitPayload);

      // Update local cache
      setAllFormResponses(prev => ({
        ...prev,
        [response.formId]: [...(prev[response.formId] || []), submittedResponse]
      }));

      toast({
        title: "Success",
        description: "Response submitted successfully",
      });
      return submittedResponse;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit response';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      // Fallback to queueing allowed DTO only
      addToOfflineQueue('form_response', {
        formId: response.formId,
        respondentId: response.respondentId,
        respondentEmail: response.respondentEmail,
        isComplete: response.isComplete,
        ipAddress: (response as any).ipAddress,
        userAgent: (response as any).userAgent,
        source: (response as any).source,
        data: response.data
      });
      return null;
    }
  }, [isOnline, addToOfflineQueue, isAuthenticated]);

  const updateFormResponse = useCallback(async (projectId: string, formId: string, responseId: string, updates: UpdateFormResponseDto): Promise<FormResponse | null> => {
    try {
      if (!isOnline) {
        addToOfflineQueue('form_response', { ...updates, projectId, formId, responseId, type: 'update' });
        toast({
          title: "Offline Mode",
          description: "Changes will be saved when you're back online",
        });
        return null;
      }

      const updatedResponse = await formsApi.updateFormResponse(projectId, formId, responseId, updates);
      
      // Update local cache
      setAllFormResponses(prev => ({
        ...prev,
        [formId]: (prev[formId] || []).map(r => r.id === responseId ? updatedResponse : r)
      }));

      toast({
        title: "Success",
        description: "Response updated successfully",
        duration: 4000,
      });
      return updatedResponse;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update response';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
        duration: 4000,
      });
      
      addToOfflineQueue('form_response', { ...updates, projectId, formId, responseId, type: 'update' });
      return null;
    }
  }, [isOnline, addToOfflineQueue]);

  const deleteFormResponse = useCallback(async (projectId: string, formId: string, responseId: string): Promise<void> => {
    try {
      await formsApi.deleteFormResponse(projectId, formId, responseId);
      
      // Update local cache
      setAllFormResponses(prev => ({
        ...prev,
        [formId]: (prev[formId] || []).filter(r => r.id !== responseId)
      }));

      toast({
        title: "Success",
        description: "Response deleted successfully",
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete response';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, []);

  // Media Management
  const uploadMediaFile = useCallback(async (
    file: File,
    project: Project,
    form: Form,
    questionId: string,
    questionTitle: string,
    uploadedBy: string,
    mediaType: 'image' | 'video' | 'audio' | 'file',
    location?: { latitude: number; longitude: number; accuracy?: number; address?: string },
    tags?: string[],
    description?: string
  ): Promise<StoredMediaFile> => {
    try {
      if (!isOnline) {
        throw new Error('Cannot upload media files while offline');
      }

      const metadata = {
        tags,
        description,
        location
      };

      const uploadedFile = await formsApi.uploadMediaFile(
        project.id,
        form.id,
        file,
        questionId,
        '', // responseId - empty for form builder
        metadata
      );

      const storedMediaFile: StoredMediaFile = {
        id: uploadedFile.id,
        metadata: {
          id: uploadedFile.id,
          fileName: uploadedFile.fileName,
          originalFileName: uploadedFile.originalName,
          fileSize: uploadedFile.fileSize,
          fileType: uploadedFile.mimeType,
          mediaType,
          countryCode: project.country,
          projectCode: project.id,
          projectId: project.id,
          formId: form.id,
          formName: form.title,
          questionId,
          questionTitle,
          uploadedAt: new Date(uploadedFile.uploadedAt),
          uploadedBy,
          tags,
          description,
          location
        },
        url: uploadedFile.url,
        filePath: uploadedFile.filePath
      };

      // Update local cache
      setMediaFiles(prev => [...prev, storedMediaFile]);

      toast({
        title: "Success",
        description: "Media file uploaded successfully",
      });

      return storedMediaFile;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload media file';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      throw err;
    }
  }, [isOnline]);

  const getMediaFiles = useCallback(async (projectId?: string, formId?: string): Promise<StoredMediaFile[]> => {
    try {
      let files: any[];
      
      if (projectId && formId) {
        files = await formsApi.getFormMediaFiles(projectId, formId);
      } else if (projectId) {
        files = await formsApi.getProjectMediaFiles(projectId);
      } else {
        // Return cached files for now
        return mediaFiles;
      }

      const storedFiles: StoredMediaFile[] = files.map(file => ({
        id: file.id,
        metadata: {
          ...file.metadata,
          uploadedAt: new Date(file.uploadedAt)
        },
        url: file.url,
        filePath: file.filePath
      }));

      setMediaFiles(storedFiles);
      return storedFiles;
    } catch (err) {
      console.error('Failed to load media files:', err);
      return mediaFiles;
    }
  }, [mediaFiles]);

  const getProjectMediaFiles = useCallback(async (projectId: string): Promise<StoredMediaFile[]> => {
    return getMediaFiles(projectId);
  }, [getMediaFiles]);

  const getFormMediaFiles = useCallback(async (formId: string, projectId: string): Promise<StoredMediaFile[]> => {
    return getMediaFiles(projectId, formId);
  }, [getMediaFiles]);

  const searchMediaFiles = useCallback(async (projectId: string, query: string): Promise<StoredMediaFile[]> => {
    try {
      const files = await formsApi.getProjectMediaFiles(projectId, query);
      
      const storedFiles: StoredMediaFile[] = files.map(file => ({
        id: file.id,
        metadata: {
          ...file.metadata,
          uploadedAt: new Date(file.uploadedAt)
        },
        url: file.url,
        filePath: file.filePath
      }));

      return storedFiles;
    } catch (err) {
      console.error('Failed to search media files:', err);
      return [];
    }
  }, []);

  const removeMediaFile = useCallback(async (projectId: string, formId: string, fileId: string): Promise<boolean> => {
    try {
      await formsApi.deleteMediaFile(projectId, formId, fileId);
      
      // Update local cache
      setMediaFiles(prev => prev.filter(f => f.id !== fileId));
      
      toast({
        title: "Success",
        description: "Media file deleted successfully",
      });
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete media file';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      return false;
    }
  }, []);

  const updateMediaFileMetadata = useCallback(async (
    projectId: string,
    formId: string,
    fileId: string,
    updates: Partial<MediaMetadata>
  ): Promise<StoredMediaFile | null> => {
    try {
      const updatedFile = await formsApi.updateMediaFileMetadata(projectId, formId, fileId, updates);
      
      const storedFile: StoredMediaFile = {
        id: updatedFile.id,
        metadata: {
          ...updatedFile.metadata,
          uploadedAt: new Date(updatedFile.uploadedAt)
        },
        url: updatedFile.url,
        filePath: updatedFile.filePath
      };

      // Update local cache
      setMediaFiles(prev => prev.map(f => f.id === fileId ? storedFile : f));
      
      toast({
        title: "Success",
        description: "Media file metadata updated successfully",
      });
      return storedFile;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update media file metadata';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      return null;
    }
  }, []);

  const getProjectMediaStats = useCallback(async (projectId: string): Promise<any> => {
    try {
      const files = await getProjectMediaFiles(projectId);
      
      const stats = {
        totalFiles: files.length,
        totalSize: files.reduce((sum, file) => sum + file.metadata.fileSize, 0),
        byType: files.reduce((acc, file) => {
          const type = file.metadata.mediaType;
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        byForm: files.reduce((acc, file) => {
          const formId = file.metadata.formId;
          acc[formId] = (acc[formId] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };

      return stats;
    } catch (err) {
      console.error('Failed to get media stats:', err);
      return {
        totalFiles: 0,
        totalSize: 0,
        byType: {},
        byForm: {}
      };
    }
  }, [getProjectMediaFiles]);

  const exportProjectMedia = useCallback(async (projectId?: string): Promise<string> => {
    try {
      const files = projectId ? await getProjectMediaFiles(projectId) : mediaFiles;
      
      const exportData = {
        timestamp: new Date().toISOString(),
        projectId,
        files: files.map(file => ({
          ...file,
          // Don't export actual file data for now
          file: null
        }))
      };

      return JSON.stringify(exportData, null, 2);
    } catch (err) {
      console.error('Failed to export media:', err);
      return JSON.stringify({ error: 'Export failed' });
    }
  }, [getProjectMediaFiles, mediaFiles]);

  const importProjectMedia = useCallback(async (importData: string): Promise<boolean> => {
    try {
      const data = JSON.parse(importData);
      
      if (data.files) {
        // This would need to be implemented based on requirements
        // For now, just return success
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('Failed to import media:', err);
      return false;
    }
  }, []);

  const refreshMediaFiles = useCallback(() => {
    // Clear cache to force reload on next request
    setMediaFiles([]);
  }, []);

  // Conditional Questions Utilities
  const getConditionalQuestions = useCallback((form: Form): FormQuestion[] => {
    const conditionalQuestions: FormQuestion[] = [];
    
    form.sections?.forEach(section => {
      section.questions?.forEach(question => {
        if (question.conditional) {
          conditionalQuestions.push(question);
        }
      });
    });
    
    return conditionalQuestions;
  }, []);

  const getConditionalResponses = useCallback((response: FormResponse, questionId: string): Record<string, any> => {
    // Implementation for getting conditional responses based on a trigger question
    // This would analyze the response data and return relevant conditional responses
    return {};
  }, []);

  // Helper function to evaluate section conditionals
  const shouldShowSection = useCallback((section: any, responses: Record<string, any>, form?: Form): boolean => {
    // If section is not marked as conditional, show it
    if (!section.conditional) {
      return true;
    }

    // Check if any choice question option has assigned this section
    /* for (const [questionId, response] of Object.entries(responses)) {
      const question = form?.sections
        ?.flatMap(s => s.questions)
        ?.find(q => q.id === questionId);
      
      if (question && (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE')) {
        const options = question.options || [];
        
        if (question.type === 'SINGLE_CHOICE') {
          // Single choice: check if selected option has this section assigned
          const selectedOption = options.find(opt => opt.value === response);
          if (selectedOption?.assignedSectionId === section.id) {
            return true;
          }
        } else if (question.type === 'MULTIPLE_CHOICE') {
          // Multiple choice: check if any selected option has this section assigned
          const selectedValues = Array.isArray(response) ? response : [response];
          const hasAssignedSection = selectedValues.some(selectedValue => {
            const selectedOption = options.find(opt => opt.value === selectedValue);
            return selectedOption?.assignedSectionId === section.id;
          });
          if (hasAssignedSection) {
            return true;
          }
        }
      }
    } */

    return false; // Don't show section if no choice option assigned it
  }, []);

  const validateConditionalQuestions = useCallback((form: Form, responses: Record<string, any>): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    form.sections?.forEach(section => {
      // Only validate questions in visible sections
      if (!shouldShowSection(section, responses, form)) {
        return;
      }

      section.questions?.forEach(question => {
        if (question.conditional && question.isRequired) {
          const triggerQuestionId = question.conditional.dependsOn;
          const triggerValue = responses[triggerQuestionId];
          const showWhen = question.conditional.showWhen;
          
          // Simple equality check for now
          if (triggerValue === showWhen && !responses[question.id]) {
            errors[question.id] = `${question.title} is required`;
          }
        }
      });
    });
    
    return errors;
  }, [shouldShowSection]);

  const getFormStatistics = useCallback((form: Form): { totalQuestions: number; conditionalQuestions: number; conditionalSections: number; totalOptions: number } => {
    let totalQuestions = 0;
    let conditionalQuestions = 0;
    let conditionalSections = 0;
    let totalOptions = 0;
    
    form.sections?.forEach(section => {
      if (section.conditional) {
        conditionalSections++;
      }
      
      section.questions?.forEach(question => {
        totalQuestions++;
        
        if (question.conditional) {
          conditionalQuestions++;
        }
        
        // Count options for choice questions
        if ((question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') && 'options' in question && question.options) {
          totalOptions += question.options.length;
        }
      });
    });
    
    return {
      totalQuestions,
      conditionalQuestions,
      conditionalSections,
      totalOptions
    };
  }, []);

  const contextValue: FormContextType = {
    currentForm,
    setCurrentForm,
    updateCurrentForm,
    formResponses,
    addFormResponse,
    clearFormResponses,
    isPreviewMode,
    setIsPreviewMode,
    formErrors,
    setFormErrors,
    clearFormErrors,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    loading,
    error,
    createForm,
    updateForm,
    deleteForm,
    duplicateForm,
    loadForm,
    loadProjectForms,
    getFormResponses,
    addFormResponseToStorage,
    updateFormResponse,
    deleteFormResponse,
    getProjectForms,
    uploadMediaFile,
    getMediaFiles,
    getProjectMediaFiles,
    getFormMediaFiles,
    searchMediaFiles,
    removeMediaFile,
    updateMediaFileMetadata,
    getProjectMediaStats,
    exportProjectMedia,
    importProjectMedia,
    refreshMediaFiles,
    isOnline,
    syncStatus,
    addToOfflineQueue,
    processOfflineQueue,
    retryFailedItems,
    clearOfflineQueue,
    getOfflineQueue,
    getFailedItems,
    getConditionalQuestions,
    getConditionalResponses,
    validateConditionalQuestions,
    shouldShowSection,
    getFormStatistics,
    projectForms,
  };

  return (
    <FormContext.Provider value={contextValue}>
      {children}
    </FormContext.Provider>
  );
}

export function useFormContext() {
  const context = useContext(FormContext);
  if (context === undefined) {
    throw new Error('useFormContext must be used within a FormProvider');
  }
  return context;
}

// Export alias for backward compatibility
export const useForm = useFormContext;
