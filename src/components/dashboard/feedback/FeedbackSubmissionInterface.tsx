import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  MessageSquare,
  AlertTriangle,
  Shield,
  Phone,
  Mail,
  MapPin,
  Clock,
  Share2,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { FeedbackComplaintForm } from './forms/FeedbackComplaintForm';
import { useFeedback } from '@/contexts/FeedbackContext';
import { useOptionalProjects } from '@/contexts/ProjectsContext';
import { projectsApi } from '@/lib/api/projectsApi';
import {
  SOP_CATEGORY_TO_CATEGORY_ID,
  isSensitiveSopCategory,
  type SopCategory,
} from '@/types/feedback';

interface FeedbackSubmissionInterfaceProps {
  projectId: string;
  projectName?: string;
}

export function FeedbackSubmissionInterface({
  projectId,
  projectName = 'ICS Program',
}: FeedbackSubmissionInterfaceProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [publicProjects, setPublicProjects] = useState<{ id: string; name: string }[]>([]);
  const { forms, categories, createSubmission } = useFeedback();
  const projectsContext = useOptionalProjects();

  const projectOptionsFromContext = useMemo(() => {
    if (!projectsContext) return null;
    try {
      const list = projectsContext.getAllProjectsForUser();
      return (list || []).map((p) => ({ id: p.id, name: p.name }));
    } catch {
      return [];
    }
  }, [projectsContext]);

  useEffect(() => {
    if (projectsContext == null) {
      projectsApi
        .getPublicProjectList()
        .then(setPublicProjects)
        .catch(() => setPublicProjects([]));
    }
  }, [projectsContext]);

  const projectOptions = projectOptionsFromContext ?? publicProjects;

  const handleShareLink = async () => {
    try {
      const baseUrl = window.location.origin;
      const url = `${baseUrl}/dashboard/feedback/submit`;
      await navigator.clipboard.writeText(url);
      toast({
        title: 'Link Copied!',
        description: 'Feedback submission link copied to clipboard.',
      });
    } catch (err) {
      toast({
        title: 'Copy Failed',
        description: 'Could not copy link. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleFormSubmit = async (formData: Record<string, unknown>) => {
    setIsSubmitting(true);
    try {
      const categoryNum = formData.category as SopCategory | null | undefined;
      if (categoryNum == null || categoryNum < 1 || categoryNum > 8) {
        alert('Please select a complaint category.');
        setIsSubmitting(false);
        return;
      }
      const categoryId = SOP_CATEGORY_TO_CATEGORY_ID[categoryNum as SopCategory];
      const category = categories.find((c) => c.id === categoryId);
      const form = forms.find((f) => f.category?.id === categoryId) || forms[0];
      const isSensitive = isSensitiveSopCategory(categoryNum);
      const submissionProjectId = (formData.projectId as string) || projectId;

      const submissionData = {
        formId: form?.id || 'general_feedback_form',
        projectId: submissionProjectId,
        categoryId: categoryId,
        priority: isSensitive ? 'HIGH' : (category?.defaultPriority ?? 'MEDIUM'),
        sensitivity: isSensitive ? 'CONFIDENTIAL' : (category?.defaultSensitivity ?? 'INTERNAL'),
        escalationLevel: category?.escalationLevel ?? 'NONE',
        data: {
          date: formData.date,
          time: formData.time,
          isAnonymous: formData.isAnonymous,
          isCommunityFacilitator: formData.isCommunityFacilitator === true,
          name: formData.name,
          sex: formData.sex,
          age: formData.age,
          phone: formData.phone,
            country: formData.country,
            region: formData.region,
          county: formData.county,
          subCounty: formData.subCounty,
          village: formData.village,
          projectId: formData.projectId,
          description: formData.description,
          category: formData.category,
          attachmentNames: (formData.attachments as File[]).map((f) => f.name),
        },
        isAnonymous: formData.isAnonymous === true,
        submitterName: (formData.name as string)?.trim() || undefined,
        submitterEmail: undefined,
        stakeholderType: formData.isCommunityFacilitator === true ? 'community_facilitator' : undefined,
      };

      await createSubmission(submissionData);

      const closureNote = isSensitive
        ? 'Sensitive feedback is handled within 72 hours per ICS SOP.'
        : 'We aim to respond within our standard timeframe (up to 30 days for this category).';
      toast({
        title: 'Thank you',
        description: `Your feedback has been received and will be reviewed. ${closureNote}`,
      });
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast({
        title: 'Submission failed',
        description: 'There was an error submitting your feedback. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold">Feedback & Complaint Recording Form</h1>
           
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleShareLink}>
          <Share2 className="w-4 h-4 mr-2" />
          Share Link
        </Button>
      </div>

      

      <Card>
        <CardHeader>
          <CardTitle>Record your complaint or feedback</CardTitle>
          <p className="text-sm text-muted-foreground">
            All fields except description and category are optional. Location and project help us route your feedback.
          </p>
        </CardHeader>
        <CardContent>
          <FeedbackComplaintForm
            onSubmit={handleFormSubmit}
            isSubmitting={isSubmitting}
            projects={projectOptions}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Need immediate help?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
              <Phone className="w-5 h-5 text-red-600 shrink-0" />
              <div>
                <p className="font-medium">Toll free line</p>
                <p className="text-sm text-muted-foreground">0800 721 402</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <Mail className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <p className="font-medium">Feedback / Complaints</p>
                <p className="text-sm text-muted-foreground">complaints.info@icsafrica.org</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
