import React, { useState, useMemo } from 'react';
import { Sidebar, Menu, MenuItem, SubMenu } from 'react-pro-sidebar';
import { Link, useLocation } from 'react-router-dom';
import { Target, Activity, Users, Settings, Folder, Circle, CheckCircle2, Flag, FileText, Plus, ClipboardList, X, DollarSign, MessageSquare, Database, BookOpen, Edit3, Archive, RotateCcw, Search } from 'lucide-react';
import { useDashboard } from '@/contexts/DashboardContext';
import { useProjects } from '@/contexts/ProjectsContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { createEnhancedPermissionManager } from '@/lib/permissions';


export function ProSidebar() {
  const { setSidebarOpen } = useDashboard();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const location = useLocation();
  
  // Always call hooks in the same order
  const projectsContext = useProjects();
  
  // Create enhanced permission manager
  const permissionManager = createEnhancedPermissionManager({
    user,
    isAuthenticated,
    isLoading: authLoading
  });
  
  const { 
    projects, 
    isLoading,
    getAllProjectsForUser,
    archiveProject,
    restoreProject,
    refreshProjects,
  } = projectsContext;
  
  // Early return if auth is loading
  if (authLoading) {
    return (
      <div className="w-[270px] bg-gray-50 border-r border-gray-200 h-screen flex items-center justify-center">
        <div className="text-center text-sm text-gray-500">
          <p>Loading...</p>
        </div>
      </div>
    );
  }
  
  // Early return if user is not loaded or doesn't exist
  if (!user) {
    return (
      <div className="w-[270px] bg-gray-50 border-r border-gray-200 h-screen flex items-center justify-center">
        <div className="text-center text-sm text-gray-500">
          <p>Loading user...</p>
        </div>
      </div>
    );
  }
  
  // Use centralized permission manager
  const isAdmin = () => permissionManager.isGlobalAdmin();
  const isRegionalCoordinator = () => {
    const roleNames = (user?.roles || []).map(r => r.roleName);
    return roleNames.includes('coordinator-tanzania') || roleNames.includes('coordinator-cote-divoire');
  };

  const handleCloseSidebar = () => {
    setSidebarOpen(false);
  };

  const handleArchiveProject = async (projectId: string, projectName: string) => {
    if (window.confirm(`Are you sure you want to archive "${projectName}"? The project will no longer be accessible, but all data will be preserved.`)) {
      try {
        console.log('🔄 [ProSidebar] Starting archive operation for project:', projectId);
        const updatedProject = await archiveProject(projectId);
        console.log('✅ [ProSidebar] Archive operation completed:', {
          projectId: updatedProject.id,
          newStatus: updatedProject.status
        });
        // No need to call refreshProjects() - archiveProject already updates the state
        handleCloseSidebar();
      } catch (error) {
        console.error('❌ [ProSidebar] Error archiving project:', error);
        alert('Failed to archive project. Please try again.');
      }
    }
  };

  const handleRestoreProject = async (projectId: string, projectName: string) => {
    if (window.confirm(`Are you sure you want to restore "${projectName}"? The project will become active again.`)) {
      try {
        console.log('🔄 [ProSidebar] Starting restore operation for project:', projectId);
        const updatedProject = await restoreProject(projectId);
        console.log('✅ [ProSidebar] Restore operation completed:', {
          projectId: updatedProject.id,
          newStatus: updatedProject.status
        });
        // No need to call refreshProjects() - restoreProject already updates the state
        handleCloseSidebar();
      } catch (error) {
        console.error('❌ [ProSidebar] Error restoring project:', error);
        alert('Failed to restore project. Please try again.');
      }
    }
  };

  // Get accessible projects for the current user
  const accessibleProjects = getAllProjectsForUser();

  const [projectSearch, setProjectSearch] = useState('');
  const [activeOpen, setActiveOpen] = useState(true);
  const [archivedOpen, setArchivedOpen] = useState(false);

  try {
    return (
      <Sidebar 
        width="270px"
        backgroundColor="#f8fafc"
        rootStyles={{
          borderRight: '1px solid #e2e8f0',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="flex flex-col h-full min-h-0">
          {/* Header */}
          <div className="flex-shrink-0 p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">ICS Dashboard</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCloseSidebar}
                className="md:hidden"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Navigation Menu - scrollable when content overflows */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <Menu>
              {/* Global Overview */}
             <SubMenu 
            label="Organization" 
            icon={<Users className="h-4 w-4" />}
            className="text-sm"
            >
              <MenuItem 
            icon={<Target className="h-4 w-4" />} 
            component={<Link to="/dashboard" onClick={handleCloseSidebar} />}
            className="text-sm"
          >
            Objectives
          </MenuItem>
            {isAdmin() && (
              <SubMenu 
                label="Strategic Plan" 
                icon={<BookOpen className="h-4 w-4" />}
                className="text-sm"
              >
                <MenuItem 
                  component={<Link to="/dashboard/strategic-plan/create" onClick={handleCloseSidebar} />}
                  className="text-sm"
                >
                  Create Strategic Plan
                </MenuItem>
                <MenuItem 
                  component={<Link to="/dashboard/strategic-plan/edit" onClick={handleCloseSidebar} />}
                  className="text-sm"
                >
                  Edit Strategic Plan
                </MenuItem>
                <MenuItem 
                  component={<Link to="/dashboard/strategic-plan/kpis" onClick={handleCloseSidebar} />}
                  className="text-sm"
                >
                  KPIs
                </MenuItem>
                <MenuItem 
                  component={<Link to="/dashboard/strategic-plan/activities" onClick={handleCloseSidebar} />}
                  className="text-sm"
                >
                  Organisation activities
                </MenuItem>
              </SubMenu>
            )}
            <SubMenu 
              label="Feedback " 
              icon={<MessageSquare className="h-4 w-4" />}
              className="text-sm"
            >
              <MenuItem 
                component={<Link to="/dashboard/feedback" onClick={handleCloseSidebar} />}
                className="text-sm"
              >
                Submit Feedback
              </MenuItem>
              {permissionManager.hasPermission('feedback:manage') && (
                <MenuItem
                  component={<Link to="/dashboard/feedback/forms" onClick={handleCloseSidebar} />}
                  className="text-sm"
                >
                  Manage Forms
                </MenuItem>
              )}
              {permissionManager.hasPermission('feedback:read') && (
                <MenuItem
                  component={<Link to="/dashboard/feedback/submissions" onClick={handleCloseSidebar} />}
                  className="text-sm"
                >
                  View Submissions
                </MenuItem>
              )}
              {permissionManager.hasPermission('feedback:read') && (
                <MenuItem
                  component={<Link to="/dashboard/feedback/analytics" onClick={handleCloseSidebar} />}
                  className="text-sm"
                >
                  Analytics
                </MenuItem>
              )}
            </SubMenu>
          </SubMenu>

              {/* Projects Section */}
              <SubMenu 
                label="Projects" 
                icon={<Folder className="h-4 w-4" />}
                className="text-sm"
              >
                {/* Create Project (admin only) */}
                {isAdmin() && (
                  <MenuItem 
                    icon={<Plus className="h-4 w-4" />} 
                    component={<Link to="/dashboard/projects/create" onClick={handleCloseSidebar} />}
                    className="text-sm"
                  >
                    Create Project
                  </MenuItem>
                )}
                
                {/* Search */}
                <li className="px-3 pt-2 pb-1">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      placeholder="Search projects…"
                      className="w-full pl-7 pr-2 py-1.5 text-xs rounded-md border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 placeholder:text-gray-400"
                    />
                  </div>
                </li>

                {/* Projects List */}
                {isLoading ? (
                  <MenuItem className="text-sm text-gray-500">
                    Loading projects...
                  </MenuItem>
                ) : accessibleProjects.length === 0 ? (
                  <MenuItem className="text-sm text-gray-500">
                    No projects available
                  </MenuItem>
                ) : (() => {
                  const filteredProjects = isRegionalCoordinator() 
                    ? accessibleProjects.filter((project: any) => {
                        const country = ((project && (project as any).country) ? (project as any).country : '').toLowerCase();
                        const rcTz = (user?.roles || []).some(r => r.roleName === 'coordinator-tanzania');
                        const rcCi = (user?.roles || []).some(r => r.roleName === 'coordinator-cote-divoire');
                        if (rcTz) return country.includes('tanzania') || country.includes('tz');
                        if (rcCi) return country.includes('côte') || country.includes('cote') || country.includes('ivoire');
                        return true;
                      })
                    : accessibleProjects;

                  const q = projectSearch.trim().toLowerCase();
                  const searched = q
                    ? filteredProjects.filter((p: any) => p.name?.toLowerCase().includes(q))
                    : filteredProjects;

                  const activeProjects = searched.filter((project: any) => project.status !== 'ARCHIVED');
                  const archivedProjects = searched.filter((project: any) => project.status === 'ARCHIVED');
                  
                  const renderProjectMenu = (project: any) => {
                    if (!project || !project.id || !project.name) return null;
                    
                    return (
                      <SubMenu 
                        key={project.id} 
                        label={project.name.toUpperCase()}
                        className="text-sm"
                      >
                        <MenuItem 
                          component={<Link to={`/dashboard/projects/${project.id}`} onClick={handleCloseSidebar} />}
                          className="text-sm"
                        >
                          Overview
                        </MenuItem>
                        {permissionManager.canAccessProjectComponent(project.id, 'kpis', 'read') && (
                          <MenuItem 
                            component={<Link to={`/dashboard/projects/${project.id}/kpi`} onClick={handleCloseSidebar} />}
                            className="text-sm"
                          >
                            KPI Analytics
                          </MenuItem>
                        )}
                        {permissionManager.canAccessProject(project.id, 'read') && (
                          <MenuItem 
                            component={<Link to={`/dashboard/projects/${project.id}/outcomes`} onClick={handleCloseSidebar} />}
                            className="text-sm"
                          >
                            Outcomes
                          </MenuItem>
                        )}
                        {permissionManager.canAccessProject(project.id, 'read') && (
                          <MenuItem 
                            component={<Link to={`/dashboard/projects/${project.id}/outputs`} onClick={handleCloseSidebar} />}
                            className="text-sm"
                          >
                            Outputs
                          </MenuItem>
                        )}
                        {permissionManager.canAccessProject(project.id, 'read') && (
                          <MenuItem 
                            component={<Link to={`/dashboard/projects/${project.id}/activities`} onClick={handleCloseSidebar} />}
                            className="text-sm"
                          >
                            Activities
                          </MenuItem>
                        )}
                        {permissionManager.canAccessProject(project.id, 'read') && (
                          <MenuItem 
                            component={<Link to={`/dashboard/projects/${project.id}/subactivities`} onClick={handleCloseSidebar} />}
                            className="text-sm"
                          >
                            Subactivities
                          </MenuItem>
                        )}
                        {permissionManager.canViewForms(project.id) && (
                          <MenuItem 
                            component={<Link to={`/dashboard/projects/${project.id}/forms`} onClick={handleCloseSidebar} />}
                            className="text-sm"
                          >
                            Forms
                          </MenuItem>
                        )}
                        {permissionManager.canAccessProjectComponent(project.id, 'finance', 'read') && (
                          <MenuItem 
                            component={<Link to={`/dashboard/projects/${project.id}/financial`} onClick={handleCloseSidebar} />}
                            className="text-sm"
                          >
                            Financial
                          </MenuItem>
                        )}
                        {permissionManager.canAccessProjectComponent(project.id, 'reports', 'read') && (
                          <MenuItem 
                            component={<Link to={`/dashboard/projects/${project.id}/reports`} onClick={handleCloseSidebar} />}
                            className="text-sm"
                          >
                            Reports
                          </MenuItem>
                        )}
                        {permissionManager.canAccessProjectComponent(project.id, 'kobo', 'read') && (
                          <MenuItem 
                            component={<Link to={`/dashboard/projects/${project.id}/kobo-data`} onClick={handleCloseSidebar} />}
                            className="text-sm"
                          >
                            Kobo Data
                          </MenuItem>
                        )}
                        {permissionManager.canAccessProject(project.id, 'read') && (
                          <MenuItem 
                            component={<Link to={`/dashboard/projects/${project.id}/maps`} onClick={handleCloseSidebar} />}
                            className="text-sm"
                          >
                            Maps
                          </MenuItem>
                        )}
                        {permissionManager.canAccessProject(project.id, 'read') && (
                          <MenuItem 
                            component={<Link to={`/dashboard/projects/${project.id}/media`} onClick={handleCloseSidebar} />}
                            className="text-sm"
                          >
                            Media
                          </MenuItem>
                        )}
                        {isAdmin() && (
                          <MenuItem 
                            component={<Link to={`/dashboard/projects/${project.id}/edit`} onClick={handleCloseSidebar} />}
                            className="text-sm"
                          >
                            Edit Project
                          </MenuItem>
                        )}
                        {isAdmin() && (
                          <MenuItem 
                            onClick={(e) => {
                              e.preventDefault();
                              if (project.status === 'ARCHIVED') {
                                handleRestoreProject(project.id, project.name);
                              } else {
                                handleArchiveProject(project.id, project.name);
                              }
                            }}
                            className="text-sm"
                          >
                            {project.status === 'ARCHIVED' ? (
                              <>
                                <RotateCcw className="w-4 h-4 mr-2 inline" />
                                Restore Project
                              </>
                            ) : (
                              <>
                                <Archive className="w-4 h-4 mr-2 inline" />
                                Archive Project
                              </>
                            )}
                          </MenuItem>
                        )}
                      </SubMenu>
                    );
                  };

                  if (q && activeProjects.length === 0 && archivedProjects.length === 0) {
                    return (
                      <MenuItem className="text-xs text-gray-400 italic">
                        No projects match "{projectSearch.trim()}"
                      </MenuItem>
                    );
                  }
                  
                  return (
                    <>
                      {/* Active Projects — collapsible */}
                      {activeProjects.length > 0 && (
                        <SubMenu
                          label={`Active Projects (${activeProjects.length})`}
                          icon={<Folder className="h-4 w-4" />}
                          className="text-sm"
                          defaultOpen={activeOpen}
                          onOpenChange={(open) => setActiveOpen(open)}
                        >
                          {activeProjects.map(renderProjectMenu)}
                        </SubMenu>
                      )}
                      
                      {/* Archived Projects — collapsible, collapsed by default */}
                      {archivedProjects.length > 0 && (
                        <SubMenu
                          label={`Archived (${archivedProjects.length})`}
                          icon={<Archive className="h-4 w-4" />}
                          className="text-sm"
                          defaultOpen={archivedOpen}
                          onOpenChange={(open) => setArchivedOpen(open)}
                        >
                          {archivedProjects.map(renderProjectMenu)}
                        </SubMenu>
                      )}
                    </>
                  );
                })()}
              </SubMenu>
              
              {/* Admin section - Check for user management permissions */}
              {(permissionManager.canManageUsers('global') || isRegionalCoordinator()) && (
                <SubMenu 
                  label="Administration" 
                  icon={<Settings className="h-4 w-4" />}
                  className="text-sm"
                >
                  {(permissionManager.hasResourcePermission('users', 'read', 'global') || isRegionalCoordinator()) && (
                    <MenuItem 
                      component={<Link to="/dashboard/admin/users" onClick={handleCloseSidebar} />}
                      className="text-sm"
                      icon={<Users className="h-4 w-4" />}
                    >
                      User Management
                    </MenuItem>
                  )}
                  {isAdmin() && (
                    <MenuItem 
                      component={<Link to="/dashboard/admin/settings" onClick={handleCloseSidebar} />}
                      className="text-sm"
                      icon={<Settings className="h-4 w-4" />}
                    >
                      System Settings
                    </MenuItem>
                  )}
                </SubMenu>
              )}
            </Menu>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 p-4 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              <p>Logged in as: {user.firstName} {user.lastName}</p>
              <p>Role: {user.roles?.[0]?.roleName || 'No role assigned'}</p>
            </div>
          </div>
        </div>
      </Sidebar>
    );
  } catch (error) {
    console.error('Error rendering sidebar:', error);
    return (
      <div className="w-[270px] bg-gray-50 border-r border-gray-200 h-screen flex items-center justify-center">
        <div className="text-center text-sm text-red-500">
          <p>Error loading sidebar</p>
          <p className="text-xs mt-1">Please refresh the page</p>
        </div>
      </div>
    );
  }
}