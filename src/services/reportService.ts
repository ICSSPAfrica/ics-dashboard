import { apiClient } from '@/lib/api/client';

export interface ReportUploadData {
  title?: string;
  description?: string;
  category?: string;
  reportType?: string;
  activityId?: string;
  reportFrequency?: 'weekly' | 'bimonthly' | 'monthly' | 'quarterly' | 'bi-annual' | 'annual' | 'adhoc';
}

export interface ReportFile {
  id: string;
  title: string;
  description: string;
  type: string;
  fileUrl: string;
  fileSize: string;
  status: string;
  createdAt: string;
}

export interface ReportUploadResponse {
  success: boolean;
  data: ReportFile;
  error?: string;
}

export interface ReportListResponse {
  success: boolean;
  data: ReportFile[];
  error?: string;
}

class ReportService {
  private baseUrl = '/projects';

  async uploadReportFile(
    projectId: string,
    file: File,
    reportData: ReportUploadData
  ): Promise<ReportUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', reportData.title || file.name);
    formData.append('description', reportData.description || `Uploaded report: ${file.name}`);
    formData.append('category', reportData.category || 'adhoc');
    formData.append('reportType', reportData.reportType || 'ADHOC');
    if (reportData.activityId) {
      formData.append('activityId', reportData.activityId);
    }
    if (reportData.reportFrequency) {
      formData.append('reportFrequency', reportData.reportFrequency);
    }


    const response = await apiClient.upload<ReportUploadResponse>(
      `${this.baseUrl}/${projectId}/reports/upload`,
      formData
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to upload report file');
    }

    return response.data;
  }

  async getReports(projectId: string): Promise<ReportListResponse> {
    const response = await apiClient.get<ReportFile[]>(
      `${this.baseUrl}/${projectId}/reports`
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch reports');
    }

    return { success: true, data: response.data };
  }

  async getReport(projectId: string, reportId: string): Promise<ReportFile> {
    const response = await apiClient.get<ReportFile>(
      `${this.baseUrl}/${projectId}/reports/${reportId}`
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch report');
    }

    return response.data;
  }

  async downloadReportFile(projectId: string, reportId: string): Promise<void> {
    // Get presigned URL from backend
    const response = await apiClient.get<{ presignedUrl: string; fileName: string; mimeType: string }>(
      `${this.baseUrl}/${projectId}/reports/preview/${reportId}`
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get download URL');
    }
    // Navigate directly to the presigned URL instead of fetch/blob.
    // This avoids browser CORS enforcement for XHR/fetch on cross-origin object storage.
    window.open(response.data.presignedUrl, '_blank', 'noopener,noreferrer');
  }

  async getPreviewUrl(projectId: string, reportId: string): Promise<string> {
    const response = await apiClient.get<{ presignedUrl: string; fileName: string; mimeType: string }>(
      `${this.baseUrl}/${projectId}/reports/preview/${reportId}`
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get preview URL');
    }

    return response.data.presignedUrl;
  }

  async updateReport(
    projectId: string,
    reportId: string,
    updateData: { title?: string; description?: string; category?: string }
  ): Promise<ReportFile> {
    const response = await apiClient.put<ReportFile>(
      `${this.baseUrl}/${projectId}/reports/${reportId}`,
      updateData
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to update report');
    }

    return response.data;
  }

  async deleteReportFile(projectId: string, reportId: string): Promise<void> {
    const response = await apiClient.delete(
      `${this.baseUrl}/${projectId}/reports/${reportId}`
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to delete report file');
    }
  }
}

export const reportService = new ReportService();
