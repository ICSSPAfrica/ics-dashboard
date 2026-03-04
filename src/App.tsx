import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { DashboardProvider } from '@/contexts/DashboardContext';
import { FormProvider } from '@/contexts/FormContext';
import { ReportProvider } from '@/contexts/ReportContext';
import { ProjectsProvider } from '@/contexts/ProjectsContext';
import { NotificationProvider, useNotifications } from '@/contexts/NotificationContext';
import { NotificationContainer } from '@/components/ui/notification';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { GlobalOverview } from '@/components/dashboard/GlobalOverview';
import { ProjectOverview } from '@/components/dashboard/ProjectOverview';
import { KPIAnalytics } from '@/components/dashboard/KPIAnalytics';
import Login from '@/components/auth/Login';
import { OutcomesDetails } from '@/components/dashboard/OutcomesDetails';
import { OutputsDetails } from '@/components/dashboard/OutputsDetails';
import { Reports } from '@/components/dashboard/Reports';
import { KoboData } from '@/components/dashboard/KoboData';
import { Maps } from '@/components/dashboard/Maps';
import { Media } from '@/components/dashboard/Media';
import Financial from '@/components/dashboard/Financial';
import { UserManagement } from '@/components/dashboard/UserManagement';
import { Settings } from '@/components/dashboard/Settings';
import { Activities } from '@/components/dashboard/Activities';
import { Subactivities } from '@/components/dashboard/Subactivities';
import { ProjectCreationWizard } from '@/components/dashboard/ProjectCreationWizard';
import { FormRoutes } from '@/components/dashboard/FormRoutes';
import { GoalDetails } from '@/components/dashboard/GoalDetails';
import { StrategicPlanCreate } from '@/components/dashboard/StrategicPlanCreate';
import { StrategicPlanEdit } from '@/components/dashboard/StrategicPlanEdit';
import { StrategicPlanKpis } from '@/components/dashboard/StrategicPlanKpis';
import { StrategicPlanKpiEdit } from '@/components/dashboard/StrategicPlanKpiEdit';
import { StrategicPlanActivities } from '@/components/dashboard/StrategicPlanActivities';
import { Profile } from '@/components/dashboard/Profile';
import { PublicFormFiller } from '@/components/public/PublicFormFiller';
import { PublicLanding } from '@/components/public/PublicLanding';
import { ProjectsApiTest } from '@/components/dashboard/ProjectsApiTest';
import { FeedbackRoutes } from '@/components/dashboard/feedback/FeedbackRoutes';
import { FeedbackSubmissionInterface } from '@/components/dashboard/feedback/FeedbackSubmissionInterface';
import { FeedbackProvider } from '@/contexts/FeedbackContext';
// New all-outcomes and all-outputs pages will be created as OutcomesDetails and OutputsDetails
import { Toaster as ShadToaster } from '@/components/ui/toaster';
import { createEnhancedPermissionManager } from '@/lib/permissions';

function ProtectedRoute({ roles }: { roles?: string[] }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Define public routes where auth checks should not apply
  const isPublicRoute = (path: string) => {
    return (
      path === '/login' ||
      path === '/' ||
      path.startsWith('/fill/') ||
      path.startsWith('/embed/') ||
      path === '/feedback/submit'
    );
  };
  
  console.log('ProtectedRoute - authentication state:', { isAuthenticated, isLoading, user: !!user });
  console.log('ProtectedRoute - current location:', location.pathname + location.search);

  // Skip auth checks entirely for public routes
  if (isPublicRoute(location.pathname)) {
    return <Outlet />;
  }
  
  if (isLoading) {
    console.log('ProtectedRoute - still loading, showing spinner');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    // Don't redirect to login for public routes
    if (isPublicRoute(location.pathname)) {
      return <Outlet />;
    }
    
    // Capture the current URL and redirect to login with next parameter
    const currentPath = location.pathname + location.search;
    const loginUrl = `/login?next=${encodeURIComponent(currentPath)}`;
    console.log('ProtectedRoute - user not authenticated, redirecting to login with next:', currentPath);
    console.log('ProtectedRoute - encoded login URL:', loginUrl);
    return <Navigate to={loginUrl} replace />;
  }
  
  if (roles && user?.roles) {
    const userRoles = user.roles.map(r => r.roleName);
    const hasRequiredRole = roles.some(role => userRoles.includes(role));
    if (!hasRequiredRole) {
      return <Navigate to="/dashboard" replace />;
    }
  }
  
  return <Outlet />;
}

function ProjectPermissionRoute({ check } : { check: (permissionManager: ReturnType<typeof createEnhancedPermissionManager>, projectId: string) => boolean }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { projectId } = useParams();
  const location = useLocation();
  const permissionManager = createEnhancedPermissionManager({ user, isAuthenticated, isLoading });

  if (!projectId) return <Navigate to="/dashboard" replace />;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const allowed = check(permissionManager, projectId);
  return allowed ? <Outlet /> : <Navigate to={`/dashboard/projects/${projectId}`} replace />;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <NotificationProvider>
          <AppWithNotifications />
        </NotificationProvider>
      </AuthProvider>
    </Router>
  );
}

function AppWithNotifications() {
  const { notifications, removeNotification } = useNotifications();
  
  return (
    <>
      <Routes>
          {/* Public routes - no context providers that require auth */}
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Login />} />
          
          {/* Public form filling routes - need FormProvider for form functionality */}
          <Route path="/fill/:formId" element={
            <FormProvider>
              <PublicFormFiller />
            </FormProvider>
          } />
          <Route path="/embed/:formId" element={
            <FormProvider>
              <PublicFormFiller isEmbedded={true} />
            </FormProvider>
          } />
          
          {/* Public feedback submission route */}
          <Route path="/feedback/submit" element={
            <FeedbackProvider projectId="organization">
              <FeedbackSubmissionInterface 
                projectId="organization" 
                projectName="ICS Organization" 
              />
            </FeedbackProvider>
          } />
          
          {/* Authenticated routes - wrapped in dashboard context providers */}
          <Route path="/dashboard/*" element={
            <DashboardProvider>
              <ProjectsProvider>
                <FormProvider>
                  <ReportProvider>
                    <Routes>
                      <Route element={<ProtectedRoute />}>
                        <Route element={<DashboardLayout />}>
                          <Route index element={<GlobalOverview />} />
                          <Route path="api-test" element={<ProjectsApiTest />} />
                          <Route path="profile" element={<Profile />} />
                          <Route path="settings" element={<Settings />} />
                          {/* Organizational Goals routes */}
                          <Route path="goals/:goalId" element={<GoalDetails />} />
                          <Route path="goals/:goalId/subgoals/:subGoalId" element={<GoalDetails />} />
                          {/* Organization routes */}
                          <Route path="strategic-plan/create" element={<StrategicPlanCreate />} />
                          <Route path="strategic-plan/edit" element={<StrategicPlanEdit />} />
                          <Route path="strategic-plan/kpis" element={<StrategicPlanKpis />} />
                          <Route path="strategic-plan/kpis/edit/:kpiId" element={<StrategicPlanKpiEdit />} />
                          <Route path="strategic-plan/activities" element={<StrategicPlanActivities />} />
                          <Route path="feedback/*" element={<FeedbackRoutes projectId="organization" projectName="ICS Organization" />} />
                          {/* Admin-only project creation */}
                          <Route path="projects/create" element={<ProtectedRoute roles={['global-admin', 'country-admin', 'project-admin']} />}>
                            <Route index element={<ProjectCreationWizard />} />
                          </Route>
                          <Route path="projects/:projectId/edit" element={<ProtectedRoute roles={['global-admin', 'country-admin', 'project-admin']} />}>
                            <Route index element={<ProjectCreationWizard />} />
                          </Route>
                          <Route path="projects/:projectId" element={<ProjectOverview />} />
                          <Route path="projects/:projectId/kpi" element={<ProjectPermissionRoute check={(pm, pid) => pm.canAccessProjectComponent(pid, 'kpis', 'read')} />}>
                            <Route index element={<KPIAnalytics />} />
                          </Route>
                          <Route path="projects/:projectId/outcomes" element={<OutcomesDetails />} />
                          <Route path="projects/:projectId/outputs" element={<OutputsDetails />} />
                          <Route path="projects/:projectId/activities" element={<Activities />} />
                          <Route path="projects/:projectId/subactivities" element={<Subactivities />} />
                          <Route path="projects/:projectId/reports" element={<ProjectPermissionRoute check={(pm, pid) => pm.canAccessProjectComponent(pid, 'reports', 'read')} />}>
                            <Route index element={<Reports />} />
                          </Route>
                          <Route path="projects/:projectId/kobo-data" element={<KoboData />} />
                          <Route path="projects/:projectId/maps" element={<Maps />} />
                          <Route path="projects/:projectId/financial" element={<ProjectPermissionRoute check={(pm, pid) => pm.canAccessProjectComponent(pid, 'finance', 'read')} />}>
                            <Route index element={<Financial />} />
                          </Route>
                          <Route path="projects/:projectId/media" element={<Media />} />
                          {/* Project Forms - nested routing */}
                          {/* <Route path="projects/:projectId/forms/*" element={<ProjectPermissionRoute check={(pm, pid) => pm.canViewForms(pid)} />}>
                            <Route path="*" element={<FormRoutes />} />
                          </Route> */}
                          <Route path="projects/:projectId/forms/*" >
                            <Route path="*" element={<FormRoutes />} />
                          </Route>
                          {/* Admin-only routes */}
                          <Route path="admin/users" element={<ProtectedRoute roles={['global-admin']} />}> 
                            <Route index element={<UserManagement />} />
                          </Route>
                          <Route path="admin/settings" element={<ProtectedRoute roles={['global-admin']} />}> 
                            <Route index element={<Settings />} />
                          </Route>
                        </Route>
                      </Route>
                    </Routes>
                  </ReportProvider>
                </FormProvider>
              </ProjectsProvider>
            </DashboardProvider>
          } />
        </Routes>
      <NotificationContainer 
        notifications={notifications} 
        onRemove={removeNotification} 
      />
      <ShadToaster />
    </>
  );
}

export default App;