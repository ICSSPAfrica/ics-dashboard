import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { feedbackApi } from '../services/feedbackApi';
import { FeedbackForm, FeedbackSubmission, FeedbackCategory } from '../types/feedback';

interface FeedbackContextType {
  // Data
  forms: FeedbackForm[];
  submissions: FeedbackSubmission[];
  categories: FeedbackCategory[];
  
  // Loading states
  loading: boolean;
  formsLoading: boolean;
  submissionsLoading: boolean;
  categoriesLoading: boolean;
  
  // Actions
  refreshForms: () => Promise<void>;
  refreshSubmissions: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  refreshAll: () => Promise<void>;
  
  // Form actions
  createSubmission: (data: any) => Promise<FeedbackSubmission>;
  updateSubmissionStatus: (id: string, status: string, assignedTo?: string) => Promise<FeedbackSubmission>;
  addNote: (submissionId: string, noteData: any) => Promise<any>;
  
  // Utility
  getFormById: (id: string) => FeedbackForm | undefined;
  getSubmissionById: (id: string) => FeedbackSubmission | undefined;
  getSubmissionsByForm: (formId: string) => FeedbackSubmission[];
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

interface FeedbackProviderProps {
  children: ReactNode;
  projectId?: string;
}

export const FeedbackProvider: React.FC<FeedbackProviderProps> = ({ 
  children, 
  projectId = 'organization' 
}) => {
  const [forms, setForms] = useState<FeedbackForm[]>([]);
  const [submissions, setSubmissions] = useState<FeedbackSubmission[]>([]);
  const [categories, setCategories] = useState<FeedbackCategory[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [formsLoading, setFormsLoading] = useState(false);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  // Fetch forms
  const refreshForms = useCallback(async () => {
    try {
      setFormsLoading(true);
      const response = await feedbackApi.getForms(projectId);
      setForms((response as FeedbackForm[]) || []);
    } catch (error) {
      console.error('Error fetching forms:', error);
      setForms([]);
    } finally {
      setFormsLoading(false);
    }
  }, [projectId]);

  // Fetch submissions
  const refreshSubmissions = useCallback(async () => {
    try {
      setSubmissionsLoading(true);
      const response = await feedbackApi.getSubmissions(projectId);
      setSubmissions((response as FeedbackSubmission[]) || []);
    } catch (error: any) {
      console.error('Error fetching submissions:', error);
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        console.warn('Unauthorized access to submissions - user may need to login');
        // Could dispatch an auth event here if needed
      }
      setSubmissions([]);
    } finally {
      setSubmissionsLoading(false);
    }
  }, [projectId]);

  // Fetch categories
  const refreshCategories = useCallback(async () => {
    try {
      setCategoriesLoading(true);
      const response = await feedbackApi.getCategories();
      setCategories((response as FeedbackCategory[]) || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  // Refresh all data
  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      refreshForms(),
      refreshSubmissions(),
      refreshCategories()
    ]);
    setLoading(false);
  }, [refreshForms, refreshSubmissions, refreshCategories]);

  // Create submission
  const createSubmission = async (data: any): Promise<FeedbackSubmission> => {
    try {
      const response = await feedbackApi.createSubmission(data);
      const newSubmission = response as FeedbackSubmission;
      
      // Update local state
      setSubmissions(prev => [newSubmission, ...prev]);
      
      return newSubmission;
    } catch (error) {
      console.error('Error creating submission:', error);
      throw error;
    }
  };

  // Update submission status
  const updateSubmissionStatus = async (
    id: string, 
    status: string, 
    assignedTo?: string
  ): Promise<FeedbackSubmission> => {
    try {
      const updateData: any = { status };
      if (assignedTo !== undefined) {
        updateData.assignedTo = assignedTo || '';
      }
      
      const response = await feedbackApi.updateSubmissionStatus(id, updateData);
      const updatedSubmission = response as FeedbackSubmission;
      
      // Update local state
      setSubmissions(prev => 
        prev.map(submission => 
          submission.id === id ? updatedSubmission : submission
        )
      );
      
      return updatedSubmission;
    } catch (error: any) {
      console.error('Error updating submission status:', error);
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        console.warn('Unauthorized access to update submission - user may need to login');
      }
      throw error;
    }
  };

  // Add note to submission
  const addNote = async (submissionId: string, noteData: any): Promise<any> => {
    try {
      const response = await feedbackApi.addNote(submissionId, noteData);
      return response;
    } catch (error: any) {
      console.error('Error adding note:', error);
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        console.warn('Unauthorized access to add note - user may need to login');
      }
      throw error;
    }
  };

  // Utility functions
  const getFormById = (id: string): FeedbackForm | undefined => {
    return forms.find(form => form.id === id);
  };

  const getSubmissionById = (id: string): FeedbackSubmission | undefined => {
    return submissions.find(submission => submission.id === id);
  };

  const getSubmissionsByForm = (formId: string): FeedbackSubmission[] => {
    return submissions.filter(submission => submission.formId === formId);
  };

  // Initialize data on mount
  useEffect(() => {
    refreshAll();
  }, [projectId]);

  const contextValue: FeedbackContextType = {
    // Data
    forms,
    submissions,
    categories,
    
    // Loading states
    loading,
    formsLoading,
    submissionsLoading,
    categoriesLoading,
    
    // Actions
    refreshForms,
    refreshSubmissions,
    refreshCategories,
    refreshAll,
    
    // Form actions
    createSubmission,
    updateSubmissionStatus,
    addNote,
    
    // Utility
    getFormById,
    getSubmissionById,
    getSubmissionsByForm,
  };

  return (
    <FeedbackContext.Provider value={contextValue}>
      {children}
    </FeedbackContext.Provider>
  );
};

// Custom hook to use feedback context
export const useFeedback = (): FeedbackContextType => {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within a FeedbackProvider');
  }
  return context;
};

export default FeedbackContext;
