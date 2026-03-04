import { apiClient } from './client';
import { Form, FormResponse, FormTemplate } from '@/components/dashboard/form-creation-wizard/types';

// DTO interfaces that match backend expectations
export interface CreateFormDto {
  title: string;
  description?: string;
  projectId: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';
  tags?: string[];
  category?: string;
  sections?: any[];
  settings?: any;
}

export interface UpdateFormDto {
  title?: string;
  description?: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';
  tags?: string[];
  category?: string;
  sections?: any[];
  settings?: any;
}

export interface CreateFormResponseDto {
  formId: string;
  respondentId?: string;
  respondentEmail?: string;
  isComplete?: boolean;
  ipAddress?: string;
  userAgent?: string;
  source?: string;
  data: Record<string, any>;
}

export interface UpdateFormResponseDto {
  respondentEmail?: string;
  isComplete?: boolean;
  data?: Record<string, any>;
}

export interface CreateFormTemplateDto {
  name: string;
  description: string;
  category: string;
  tags?: string[];
  previewImage?: string;
  isPublic?: boolean;
  sections: any[];
  settings: any;
}


export const formsApi = {
  // ========================================
  // PROJECT FORM MANAGEMENT
  // ========================================

  async createForm(projectId: string, formData: CreateFormDto): Promise<Form> {
    const response = await apiClient.post(`/forms/projects/${projectId}/forms`, formData);
    if (response.success && response.data) {
      return response.data as Form;
    }
    throw new Error(response.error || 'Failed to create form');
  },

  async getProjectForms(projectId: string): Promise<Form[]> {
    const response = await apiClient.get(`/forms/projects/${projectId}/forms`);
    if (response.success && response.data) {
      return response.data as Form[];
    }
    throw new Error(response.error || 'Failed to fetch project forms');
  },

  async getForm(projectId: string, formId: string): Promise<Form> {
    const response = await apiClient.get(`/forms/projects/${projectId}/forms/${formId}`);
    if (response.success && response.data) {
      return response.data as Form;
    }
    throw new Error(response.error || 'Failed to fetch form');
  },

  async updateForm(projectId: string, formId: string, updates: UpdateFormDto): Promise<Form> {
    const response = await apiClient.patch(`/forms/projects/${projectId}/forms/${formId}`, updates);
    if (response.success && response.data) {
      return response.data as Form;
    }
    throw new Error(response.error || 'Failed to update form');
  },

  async deleteForm(projectId: string, formId: string): Promise<void> {
    const response = await apiClient.delete(`/forms/projects/${projectId}/forms/${formId}`);
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete form');
    }
  },

  async duplicateForm(projectId: string, formId: string): Promise<Form> {
    console.log('🌐 FormsAPI: Making duplicate request for project:', projectId, 'formId:', formId);
    const response = await apiClient.post(`/forms/projects/${projectId}/forms/${formId}/duplicate`);
    console.log('📡 FormsAPI: Received response from backend:', {
      success: response.success,
      hasData: !!response.data,
      error: response.error
    });
    
    if (response.success && response.data) {
      const form = response.data as Form;
      console.log('📋 FormsAPI: Duplicated form structure:', {
        id: form.id,
        title: form.title,
        sectionsCount: form.sections?.length || 0,
        totalQuestions: form.sections?.reduce((total, section) => total + (section.questions?.length || 0), 0) || 0
      });
      
      // Log choice questions and their options
      if (form.sections) {
        form.sections.forEach((section, sectionIndex) => {
          section.questions?.forEach((question, questionIndex) => {
            if (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') {
              console.log(`🎯 FormsAPI: Question ${sectionIndex}-${questionIndex} (${question.title}):`, {
                type: question.type,
                optionsCount: question.options?.length || 0,
                options: question.options?.map(opt => ({ id: opt.id, label: opt.label, value: opt.value })) || []
              });
            }
          });
        });
      }
      
      return form;
    }
    throw new Error(response.error || 'Failed to duplicate form');
  },

  async archiveForm(projectId: string, formId: string): Promise<Form> {
    const response = await apiClient.post(`/forms/projects/${projectId}/forms/${formId}/archive`);
    if (response.success && response.data) {
      return response.data as Form;
    }
    throw new Error(response.error || 'Failed to archive form');
  },

  async disableForm(projectId: string, formId: string): Promise<Form> {
    const response = await apiClient.post(`/forms/projects/${projectId}/forms/${formId}/disable`);
    if (response.success && response.data) {
      return response.data as Form;
    }
    throw new Error(response.error || 'Failed to disable form');
  },

  async restoreForm(projectId: string, formId: string): Promise<Form> {
    const response = await apiClient.post(`/forms/projects/${projectId}/forms/${formId}/restore`);
    if (response.success && response.data) {
      return response.data as Form;
    }
    throw new Error(response.error || 'Failed to restore form');
  },


  // ========================================
  // FORM RESPONSES
  // ========================================

  async submitResponse(responseData: CreateFormResponseDto): Promise<FormResponse> {
    const response = await apiClient.post('/forms/responses', responseData);
    if (response.success && response.data) {
      return response.data as FormResponse;
    }
    throw new Error(response.error || 'Failed to submit response');
  },

  /** Submit as logged-in user so response is linked to respondentId (for community facilitators etc.) */
  async submitResponseAuthenticated(responseData: CreateFormResponseDto): Promise<FormResponse> {
    const response = await apiClient.post('/forms/responses/authenticated', responseData);
    if (response.success && response.data) {
      return response.data as FormResponse;
    }
    throw new Error(response.error || 'Failed to submit response');
  },

  async getFormResponses(
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
  }> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', String(options.page));
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.search) params.append('search', options.search);
    if (options?.status && options.status !== 'all') params.append('status', options.status);
    
    const queryString = params.toString();
    const url = `/forms/projects/${projectId}/forms/${formId}/responses${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiClient.get(url);
    if (response.success && response.data) {
      return response.data as { 
        responses: FormResponse[]; 
        total: number; 
        page: number; 
        limit: number; 
        totalPages: number;
        stats: { totalAll: number; totalComplete: number; totalIncomplete: number }
      };
    }
    throw new Error(response.error || 'Failed to fetch form responses');
  },

  async getFormResponse(projectId: string, formId: string, responseId: string): Promise<FormResponse> {
    const response = await apiClient.get(`/forms/projects/${projectId}/forms/${formId}/responses/${responseId}`);
    if (response.success && response.data) {
      return response.data as FormResponse;
    }
    throw new Error(response.error || 'Failed to fetch form response');
  },

  // Optimized endpoint for exporting ALL responses (no pagination limit)
  async getFormResponsesForExport(
    projectId: string, 
    formId: string,
    options?: {
      status?: 'all' | 'complete' | 'incomplete';
    }
  ): Promise<{ responses: FormResponse[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.status && options.status !== 'all') params.append('status', options.status);
    
    const queryString = params.toString();
    const url = `/forms/projects/${projectId}/forms/${formId}/responses/export${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiClient.get(url);
    if (response.success && response.data) {
      return response.data as { responses: FormResponse[]; total: number };
    }
    throw new Error(response.error || 'Failed to fetch form responses for export');
  },

  async updateFormResponse(projectId: string, formId: string, responseId: string, updates: UpdateFormResponseDto): Promise<FormResponse> {
    const response = await apiClient.put(`/forms/projects/${projectId}/forms/${formId}/responses/${responseId}`, updates);
    if (response.success && response.data) {
      return response.data as FormResponse;
    }
    throw new Error(response.error || 'Failed to update form response');
  },

  async deleteFormResponse(projectId: string, formId: string, responseId: string): Promise<void> {
    const response = await apiClient.delete(`/forms/projects/${projectId}/forms/${formId}/responses/${responseId}`);
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete form response');
    }
  },

  // ========================================
  // FORM ANALYTICS
  // ========================================

  async getFormAnalytics(projectId: string, formId: string): Promise<any> {
    const response = await apiClient.get(`/forms/projects/${projectId}/forms/${formId}/analytics`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to fetch form analytics');
  },

  // ========================================
  // FORM TEMPLATES
  // ========================================

  async createTemplate(templateData: CreateFormTemplateDto): Promise<FormTemplate> {
    const response = await apiClient.post('/forms/templates', templateData);
    if (response.success && response.data) {
      return response.data as FormTemplate;
    }
    throw new Error(response.error || 'Failed to create template');
  },

  async getPublicTemplates(): Promise<FormTemplate[]> {
    const response = await apiClient.get('/forms/templates');
    if (response.success && response.data) {
      return response.data as FormTemplate[];
    }
    throw new Error(response.error || 'Failed to fetch public templates');
  },

  async getUserTemplates(): Promise<FormTemplate[]> {
    const response = await apiClient.get('/forms/templates/my');
    if (response.success && response.data) {
      return response.data as FormTemplate[];
    }
    throw new Error(response.error || 'Failed to fetch user templates');
  },

  async createFormFromTemplate(projectId: string, templateId: string, title: string): Promise<Form> {
    const response = await apiClient.post(`/forms/projects/${projectId}/forms/from-template/${templateId}`, { title });
    if (response.success && response.data) {
      return response.data as Form;
    }
    throw new Error(response.error || 'Failed to create form from template');
  },

  // ========================================
  // MEDIA ATTACHMENTS
  // ========================================

  async uploadMediaFile(
    projectId: string,
    formId: string,
    file: File,
    questionId: string,
    responseId: string,
    metadata: {
      tags?: string[];
      description?: string;
      location?: {
        latitude: number;
        longitude: number;
        accuracy?: number;
        address?: string;
      };
    }
  ): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('questionId', questionId);
    if (responseId) formData.append('responseId', responseId);
    formData.append('metadata', JSON.stringify(metadata));

    const response = await apiClient.upload(`/forms/projects/${projectId}/forms/${formId}/media`, formData);
    
    if (!response.success) {
      throw new Error(`Failed to upload media file: ${response.error}`);
    }

    return response.data;
  },

  async uploadDirectMediaFile(
    projectId: string,
    file: File,
    description?: string,
    tags?: string
  ): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    if (description) formData.append('description', description);
    if (tags) formData.append('tags', tags);

    const response = await apiClient.upload(`/forms/projects/${projectId}/media/upload`, formData);
    
    if (!response.success) {
      throw new Error(`Failed to upload media file: ${response.error}`);
    }

    return response.data;
  },

  async getFormMediaFiles(projectId: string, formId: string): Promise<any[]> {
    const response = await apiClient.get(`/forms/projects/${projectId}/forms/${formId}/media`);
    if (response.success && response.data) {
      return response.data as any[];
    }
    return [];
  },

  async getProjectMediaFiles(projectId: string, search?: string, mediaType?: string): Promise<any[]> {
    let url = `/forms/projects/${projectId}/media`;
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (mediaType) params.append('mediaType', mediaType);
    if (params.toString()) url += `?${params.toString()}`;

    const response = await apiClient.get(url);
    if (response.success && response.data) {
      return response.data as any[];
    }
    return [];
  },

  async deleteMediaFile(projectId: string, formId: string, mediaId: string): Promise<void> {
    const response = await apiClient.delete(`/forms/projects/${projectId}/forms/${formId}/media/${mediaId}`);
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete media file');
    }
  },

  async updateMediaFileMetadata(projectId: string, formId: string, mediaId: string, updates: any): Promise<any> {
    const response = await apiClient.patch(`/forms/projects/${projectId}/forms/${formId}/media/${mediaId}`, updates);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to update media file metadata');
  },

  // ========================================
  // PUBLIC FORM ACCESS
  // ========================================

  async getPublicForm(formId: string): Promise<Form> {
    const response = await apiClient.get(`/forms/public/${formId}`);
    if (response.success && response.data) {
      return response.data as Form;
    }
    throw new Error(response.error || 'Failed to fetch public form');
  },

  async getSecureForm(formId: string): Promise<Form> {
    const response = await apiClient.get(`/forms/secure/${formId}`);
    if (response.success && response.data) {
      return response.data as Form;
    }
    throw new Error(response.error || 'Failed to fetch secure form');
  },

  // ========================================
  // UTILITY METHODS
  // ========================================

  async getFormByIdOnly(formId: string): Promise<Form | null> {
    try {
      // If user is authenticated, try secure first
      const token = localStorage.getItem('ics-auth-token');
      if (token) {
        try {
          return await this.getSecureForm(formId);
        } catch {
          // Fallback to public endpoint
        }
      }
      return await this.getPublicForm(formId);
    } catch (error) {
      console.error('Error fetching form:', error);
      return null;
    }
  },

  async getAllUserForms(): Promise<Form[]> {
    try {
      // This would require an endpoint that returns all forms for the current user across all projects
      // For now, return empty array - this method needs to be implemented
      return [];
    } catch (error) {
      console.error('Error fetching user forms:', error);
      return [];
    }
  },

  // ========================================
  // OFFLINE SUPPORT UTILITIES
  // ========================================

  async syncOfflineData(offlineQueue: any[]): Promise<{ success: boolean; failedItems: any[] }> {
    const failedItems: any[] = [];
    
    for (const item of offlineQueue) {
      try {
        switch (item.type) {
          case 'form_create':
            await this.createForm(item.data.projectId, item.data);
            break;
          case 'form_update':
            await this.updateForm(item.data.projectId, item.data.id, item.data);
            break;
          case 'form_response':
            // Defensive mapping to allowed DTO fields
            // Note: item.data.data should already contain properly merged conditional responses
            // (processed by PublicFormFiller.handleSubmit before being queued)
            await this.submitResponse({
              formId: item.data.formId,
              respondentId: item.data.respondentId,
              respondentEmail: item.data.respondentEmail,
              isComplete: item.data.isComplete,
              ipAddress: item.data.ipAddress,
              userAgent: item.data.userAgent,
              source: item.data.source,
              data: item.data.data // Should already contain nested conditional responses
            });
            break;
          case 'form_delete':
            await this.deleteForm(item.data.projectId, item.data.id);
            break;
          default:
            console.warn('Unknown offline queue item type:', item.type);
        }
      } catch (error) {
        console.error('Failed to sync offline item:', item, error);
        failedItems.push(item);
      }
    }

    return {
      success: failedItems.length === 0,
      failedItems
    };
  }
};
