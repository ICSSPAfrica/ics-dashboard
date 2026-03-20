import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { FeedbackProvider } from '@/contexts/FeedbackContext';
import { FeedbackSubmissionInterface } from './FeedbackSubmissionInterface';
import { FeedbackFormManagement } from './FeedbackFormManagement';
import { FeedbackSubmissionsView } from './FeedbackSubmissionsView';
import { FeedbackAnalytics } from './FeedbackAnalytics';
import FeedbackFormDetails from './FeedbackFormDetails';
import { RequireFeedbackPermission } from './RequireFeedbackPermission';

interface FeedbackRoutesProps {
  projectId: string;
  projectName?: string;
}

export function FeedbackRoutes({ projectId, projectName = "ICS Organization" }: FeedbackRoutesProps) {
  return (
    <FeedbackProvider projectId={projectId}>
      <Routes>
      <Route index element={<Navigate to="submit" replace />} />
      <Route 
        path="submit" 
        element={
          <FeedbackSubmissionInterface 
            projectId={projectId} 
            projectName={projectName} 
          />
        } 
      />
      <Route element={<RequireFeedbackPermission permission="feedback:manage" />}>
        <Route path="forms/:id" element={<FeedbackFormDetails />} />
        <Route
          path="forms"
          element={
            <FeedbackFormManagement projectId={projectId} projectName={projectName} />
          }
        />
      </Route>
      <Route element={<RequireFeedbackPermission permission="feedback:read" />}>
        <Route
          path="submissions"
          element={
            <FeedbackSubmissionsView projectId={projectId} projectName={projectName} />
          }
        />
        <Route
          path="analytics"
          element={
            <FeedbackAnalytics projectId={projectId} projectName={projectName} />
          }
        />
      </Route>
      </Routes>
    </FeedbackProvider>
  );
}
