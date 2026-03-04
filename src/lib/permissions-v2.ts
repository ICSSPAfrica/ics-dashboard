import { User } from '@/types/dashboard';

export interface PermissionContext {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Backend role definitions (matching auth-seed.ts)
export const ROLE_DEFINITIONS = {
  'global-admin': { level: 1, description: 'ICT Support/ICS SP Administrator - Full System Access' },
  'director-africa': { level: 2, description: 'Director Africa - All Organizational Data, KPIs, Finance, Cross-Regional Analytics' },
  'meal-coordinator': { level: 2, description: 'MEAL Coordinator - All Organizational Data, KPIs, Finance, Cross-Regional Analytics' },
  'finance-operations-manager': { level: 2, description: 'Finance and Operations Manager/HR - All Organizational Data, KPIs, Finance, Cross-Regional Analytics' },
  'coordinator-tanzania': { level: 3, description: 'Coordinator Tanzania - Regional Aggregates, Cross-Country Data, Performance Metrics' },
  'coordinator-cote-divoire': { level: 3, description: 'Coordinator Côte d\'Ivoire - Regional Aggregates, Cross-Country Data, Performance Metrics' },
  'project-coordinator': { level: 4, description: 'Project Coordinator - All ICS Project Data, Budget, Team Management, Component Coordination' },
  'project-officer': { level: 5, description: 'Project Officer - Project-specific data and activities' },
  'finance-officer': { level: 6, description: 'Finance Officer - All Organizational Data, KPIs, Finance, Cross-Regional Analytics' },
  'meal-officer': { level: 6, description: 'MEAL Officer - Metrics, QA, Tool Results, Assessment Data, Performance Indicators' },
  'communications': { level: 6, description: 'Communications - Regional Aggregates, Cross-Country Data, Performance Metrics' },
  'community-facilitator': { level: 6, description: 'Community Facilitator - Single project, view only own form submissions, submit via public forms' },
} as const;

// Backend permission definitions (matching auth-seed.ts)
export const PERMISSION_DEFINITIONS = {
  // User Management
  'users:create': { resource: 'users', action: 'create', scope: 'global' },
  'users:read': { resource: 'users', action: 'read', scope: 'global' },
  'users:update': { resource: 'users', action: 'update', scope: 'global' },
  'users:delete': { resource: 'users', action: 'delete', scope: 'global' },
  'users:read-own': { resource: 'users', action: 'read', scope: 'own' },
  'users:update-own': { resource: 'users', action: 'update', scope: 'own' },
  'users:create-project': { resource: 'users', action: 'create', scope: 'project' },
  'users:read-project': { resource: 'users', action: 'read', scope: 'project' },
  'users:update-project': { resource: 'users', action: 'update', scope: 'project' },
  'users:delete-project': { resource: 'users', action: 'delete', scope: 'project' },

  // Project Management
  'projects:create': { resource: 'projects', action: 'create', scope: 'global' },
  'projects:read': { resource: 'projects', action: 'read', scope: 'global' },
  'projects:update': { resource: 'projects', action: 'update', scope: 'global' },
  'projects:delete': { resource: 'projects', action: 'delete', scope: 'global' },
  'projects:read-regional': { resource: 'projects', action: 'read', scope: 'regional' },
  'projects:update-regional': { resource: 'projects', action: 'update', scope: 'regional' },
  'projects:read-project': { resource: 'projects', action: 'read', scope: 'project' },
  'projects:update-project': { resource: 'projects', action: 'update', scope: 'project' },

  // Finance Management
  'finance:read': { resource: 'finance', action: 'read', scope: 'global' },
  'finance:update': { resource: 'finance', action: 'update', scope: 'global' },
  'finance:read-regional': { resource: 'finance', action: 'read', scope: 'regional' },
  'finance:update-regional': { resource: 'finance', action: 'update', scope: 'regional' },
  'finance:read-project': { resource: 'finance', action: 'read', scope: 'project' },
  'finance:update-project': { resource: 'finance', action: 'update', scope: 'project' },

  // KPI Management
  'kpis:read': { resource: 'kpis', action: 'read', scope: 'global' },
  'kpis:update': { resource: 'kpis', action: 'update', scope: 'global' },
  'kpis:read-regional': { resource: 'kpis', action: 'read', scope: 'regional' },
  'kpis:update-regional': { resource: 'kpis', action: 'update', scope: 'regional' },
  'kpis:read-project': { resource: 'kpis', action: 'read', scope: 'project' },
  'kpis:update-project': { resource: 'kpis', action: 'update', scope: 'project' },

  // Reports Management
  'reports:create': { resource: 'reports', action: 'create', scope: 'global' },
  'reports:read': { resource: 'reports', action: 'read', scope: 'global' },
  'reports:update': { resource: 'reports', action: 'update', scope: 'global' },
  'reports:delete': { resource: 'reports', action: 'delete', scope: 'global' },
  'reports:read-regional': { resource: 'reports', action: 'read', scope: 'regional' },
  'reports:create-regional': { resource: 'reports', action: 'create', scope: 'regional' },
  'reports:read-project': { resource: 'reports', action: 'read', scope: 'project' },
  'reports:create-project': { resource: 'reports', action: 'create', scope: 'project' },
  'reports:update-project': { resource: 'reports', action: 'update', scope: 'project' },
  'reports:delete-project': { resource: 'reports', action: 'delete', scope: 'project' },

  // Analytics
  'analytics:read': { resource: 'analytics', action: 'read', scope: 'global' },
  'analytics:read-regional': { resource: 'analytics', action: 'read', scope: 'regional' },
  'analytics:read-project': { resource: 'analytics', action: 'read', scope: 'project' },

  // Kobo Data Management (new)
  'kobo:read': { resource: 'kobo', action: 'read', scope: 'global' },
  'kobo:update': { resource: 'kobo', action: 'update', scope: 'global' },
  'kobo:read-regional': { resource: 'kobo', action: 'read', scope: 'regional' },
  'kobo:update-regional': { resource: 'kobo', action: 'update', scope: 'regional' },
  'kobo:read-project': { resource: 'kobo', action: 'read', scope: 'project' },
  'kobo:update-project': { resource: 'kobo', action: 'update', scope: 'project' },

  // Forms (project-scoped) - list and read-own for community facilitators
  'forms:list-project': { resource: 'forms', action: 'list', scope: 'project' },
  'forms:responses-read-own-project': { resource: 'forms', action: 'read', scope: 'own-project' },

  // Strategic plan (organization-level)
  'strategic-plan:read': { resource: 'strategic-plan', action: 'read', scope: 'global' },
  'strategic-plan:update': { resource: 'strategic-plan', action: 'update', scope: 'global' },
  'strategic-plan:delete': { resource: 'strategic-plan', action: 'delete', scope: 'global' },
} as const;

// Role-based permission mappings (matching auth-seed.ts)
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  'global-admin': Object.keys(PERMISSION_DEFINITIONS), // All permissions

  'director-africa': [
    'users:read', 'users:create', 'users:update',
    'projects:read', 'projects:update',
    'finance:read', 'finance:update',
    'kpis:read', 'kpis:update',
    'reports:read', 'reports:create', 'reports:update',
    'analytics:read',
    'strategic-plan:read', 'strategic-plan:update', 'strategic-plan:delete'
  ],

  'meal-coordinator': [
    'users:read',
    'projects:read',
    'kpis:read', 'kpis:update',
    'reports:read', 'reports:create', 'reports:update',
    'analytics:read',
    'strategic-plan:read', 'strategic-plan:update', 'strategic-plan:delete'
  ],

  'finance-operations-manager': [
    'users:read', 'users:create', 'users:update',
    'projects:read',
    'finance:read', 'finance:update',
    'kpis:read',
    'reports:read', 'reports:create',
    'analytics:read'
  ],

  'coordinator-tanzania': [
    // Restrict to Projects and User Management within country scope
    'projects:read-regional', 'projects:update-regional',
    'users:read-regional', 'users:create-regional', 'users:update-regional'
  ],

  'coordinator-cote-divoire': [
    // Restrict to Projects and User Management within country scope
    'projects:read-regional', 'projects:update-regional',
    'users:read-regional', 'users:create-regional', 'users:update-regional'
  ],

  'project-coordinator': [
    'users:read-project', 'users:create-project', 'users:update-project', 'users:delete-project',
    'projects:read-project', 'projects:update-project',
    'finance:read-project', 'finance:update-project',
    'kpis:read-project', 'kpis:update-project',
    'reports:read-project', 'reports:create-project', 'reports:update-project', 'reports:delete-project',
    'analytics:read-project',
    'kobo:read-project', 'kobo:update-project'
  ],

  'project-officer': [
    'users:read-own', 'users:update-own',
    'users:read-project',
    'projects:read-project',
    'finance:read-project',
    'kpis:read-project',
    'reports:read-project', 'reports:create-project',
    'analytics:read-project',
    'kobo:read-project'
  ],

  'finance-officer': [
    'users:read',
    'finance:read', 'finance:update',
    'kpis:read',
    'reports:read', 'reports:create'
  ],

  'meal-officer': [
    'kpis:read', 'kpis:update',
    'reports:read', 'reports:create'
  ],

  'communications': [
    'projects:read-regional',
    'reports:read-regional',
    'analytics:read-regional'
  ],

  'community-facilitator': [
    'projects:read-project',
    'forms:list-project',
    'forms:responses-read-own-project'
  ],
} as const;

/**
 * Enhanced permission manager that matches backend granular structure
 */
export class EnhancedPermissionManager {
  private context: PermissionContext;

  constructor(context: PermissionContext) {
    this.context = context;
  }

  /**
   * Check if current user is a global admin
   */
  isGlobalAdmin(): boolean {
    const { user, isLoading } = this.context;
    
    if (isLoading) {
      console.log('🔐 Auth loading - global admin check deferred');
      return false;
    }

    if (!user || !user.roles || !Array.isArray(user.roles)) {
      return false;
    }

    return user.roles.some(role => role.roleName === 'global-admin');
  }

  /**
   * Get user's highest role level
   */
  getUserHighestLevel(): number {
    const { user } = this.context;
    
    if (!user || !user.roles || !Array.isArray(user.roles)) {
      return 999; // No access
    }

    const levels = user.roles
      .filter(role => role.isActive)
      .map(role => ROLE_DEFINITIONS[role.roleName as keyof typeof ROLE_DEFINITIONS]?.level || 999);
    
    return Math.min(...levels);
  }

  /**
   * Check if user has a specific permission
   */
  hasPermission(permission: string): boolean {
    const { user } = this.context;
    
    if (!user || !user.roles || !Array.isArray(user.roles)) {
      return false;
    }

    // Global admin has all permissions
    if (this.isGlobalAdmin()) {
      return true;
    }

    // Honor server-provided direct permissions if present
    const directPermissions = (user as any).permissions as string[] | undefined;
    if (Array.isArray(directPermissions) && directPermissions.includes(permission)) {
      return true;
    }

    // Do NOT infer permissions from static role presets for custom roles.
    // Rely on server-provided permissions only (or global-admin short-circuit above).

    return false;
  }

  /**
   * Check if user has permission for a specific resource and action
   */
  hasResourcePermission(resource: string, action: string, scope: string = 'global'): boolean {
    // First check direct permission without scope suffix
    const direct = this.hasPermission(`${resource}:${action}`);
    if (direct) return true;

    // Then check with scope suffix if provided
    const scoped = scope !== 'global' ? this.hasPermission(`${resource}:${action}-${scope}`) : false;
    return scoped;
  }

  /**
   * Project-scoped permission check: does the user have the given project-scoped permission for this project?
   * This ties the permission to a specific role assignment that includes the target projectId.
   */
  hasProjectPermission(resource: string, action: string, projectId: string): boolean {
    const { user } = this.context;
    if (!user || !Array.isArray(user.roles)) return false;

    // Global admin: allow
    if (this.isGlobalAdmin()) return true;

    // If user has regional/global permission, allow regardless of project
    if (this.hasResourcePermission(resource, action, 'regional')) return true;
    if (this.hasResourcePermission(resource, action, 'global')) return true;

    // For project-scoped permission, user must BOTH:
    // 1) Have the project-scoped permission in their aggregated permissions
    // 2) Have an active role assignment for the target projectId
    const permissionKey = `${resource}:${action}-project`;
    const directPermissions = (user as any).permissions as string[] | undefined;
    const hasProjectScopedPermission = Array.isArray(directPermissions) && directPermissions.includes(permissionKey);
    const hasProjectRole = user.roles.some(r => r.isActive && r.projectId === projectId);

    if (hasProjectScopedPermission && hasProjectRole) {
      return true;
    }

    return false;
  }

  /**
   * Check if user can access a specific project
   */
  canAccessProject(projectId: string, accessLevel: 'read' | 'write' | 'admin' = 'read'): boolean {
    const { user, isAuthenticated, isLoading } = this.context;

    // If auth is still loading, grant temporary access to prevent blocking
    if (isLoading) {
      console.log(`🔐 Auth loading - temporary access granted for project ${projectId}`);
      return true;
    }

    // If not authenticated, deny access
    if (!isAuthenticated) {
      console.log(`🔐 Not authenticated - access denied for project ${projectId}`);
      return false;
    }

    if (!user) {
      console.log(`🔐 No user object - access denied for project ${projectId}`);
      return false;
    }

    // Global admin has access to everything
    if (this.isGlobalAdmin()) {
      console.log(`🔐 Global admin access granted for project ${projectId}`);
      return true;
    }

    if (!user.roles || !Array.isArray(user.roles)) {
      console.log(`🔐 No roles array - access denied for project ${projectId}`);
      return false;
    }

    // Check for explicit project-scoped permissions first (direct or from any role)
    const hasProjectRead = this.hasResourcePermission('projects', 'read', 'project');
    const hasProjectWrite = this.hasResourcePermission('projects', 'update', 'project');
    const hasProjectRole = user.roles.some(r => r.isActive && r.projectId === projectId);
    if (accessLevel === 'read' && hasProjectRead && hasProjectRole) {
      console.log(`🔐 Project ${projectId} access via project-scoped permission: GRANTED (projects:read-project)`);
      return true;
    }
    if ((accessLevel === 'write' || accessLevel === 'admin') && hasProjectWrite && hasProjectRole) {
      console.log(`🔐 Project ${projectId} access via project-scoped permission: GRANTED (projects:update-project)`);
      return true;
    }

    // Check for project-specific roles
    const projectRole = user.roles.find(role => role.projectId === projectId && role.isActive);
    if (projectRole) {
      const hasAccess = this.checkRoleAccess(projectRole, accessLevel);
      console.log(
        `🔐 Project ${projectId} role-based access: ${hasAccess ? 'GRANTED' : 'DENIED'} (role: ${projectRole.roleName}, level: ${projectRole.level})`,
        {
          requiredAccess: accessLevel,
          projectId,
          role: {
            id: (projectRole as any).id,
            roleName: projectRole.roleName,
            level: projectRole.level,
            projectId: projectRole.projectId,
            isActive: projectRole.isActive,
          },
          allUserRoles: user.roles.map(r => ({
            id: (r as any).id,
            roleName: r.roleName,
            level: r.level,
            projectId: r.projectId,
            isActive: r.isActive,
          })),
          directPermissions: (user as any).permissions,
        }
      );
      return hasAccess;
    }

    // Check for regional/global permissions
    const hasGlobalAccess = this.hasResourcePermission('projects', 'read', 'global');
    const hasRegionalAccess = this.hasResourcePermission('projects', 'read', 'regional');
    
    if (hasGlobalAccess || hasRegionalAccess) {
      console.log(
        `🔐 Global/Regional access granted for project ${projectId}`,
        {
          projectId,
          hasGlobalAccess,
          hasRegionalAccess,
          directPermissions: (user as any).permissions,
        }
      );
      return true;
    }

    console.warn(
      `🔐 No access found for project ${projectId} - user has no applicable roles`,
      {
        projectId,
        requiredAccess: accessLevel,
        reason: 'no-project-role-and-no-global/regional-access',
        allUserRoles: user.roles.map(r => ({
          id: (r as any).id,
          roleName: r.roleName,
          level: r.level,
          projectId: r.projectId,
          isActive: r.isActive,
        })),
        directPermissions: (user as any).permissions,
      }
    );
    return false;
  }

  /**
   * Check if a role grants the required access level
   */
  private checkRoleAccess(role: { roleName: string; level: number }, accessLevel: 'read' | 'write' | 'admin'): boolean {
    const roleDefinition = ROLE_DEFINITIONS[role.roleName as keyof typeof ROLE_DEFINITIONS];
    if (!roleDefinition) return false;
    
    switch (accessLevel) {
      case 'admin':
        return roleDefinition.level <= 3; // Level 1-3 can admin
      case 'write':
        return roleDefinition.level <= 4; // Level 1-4 can write
      case 'read':
        return roleDefinition.level <= 6; // All levels can read
      default:
        return false;
    }
  }

  /**
   * Get all accessible project IDs for the current user
   */
  getAccessibleProjectIds(projectIds: string[]): string[] {
    if (this.isGlobalAdmin()) {
      return projectIds;
    }
    
    return projectIds.filter(projectId => this.canAccessProject(projectId, 'read'));
  }

  /**
   * Check if user can access a specific project component
   */
  canAccessProjectComponent(projectId: string, component: 'kpis' | 'reports' | 'finance' | 'kobo' | 'analytics' | 'forms', action: 'read' | 'write' = 'read'): boolean {
    // First check if user can access the project at all
    if (!this.canAccessProject(projectId, 'read')) {
      return false;
    }

    // Check for component-specific permissions tied to this project
    const hasProjectPermission = this.hasProjectPermission(component, action, projectId);
    const hasRegionalPermission = this.hasResourcePermission(component, action, 'regional');
    const hasGlobalPermission = this.hasResourcePermission(component, action, 'global');

    return hasProjectPermission || hasRegionalPermission || hasGlobalPermission;
  }

  /**
   * Get user's accessible countries/regions
   */
  getAccessibleCountries(): string[] {
    const { user } = this.context;
    
    if (!user || !user.roles || !Array.isArray(user.roles)) {
      return [];
    }

    if (this.isGlobalAdmin()) {
      return ['all']; // Global admin sees all
    }

    const countries = new Set<string>();
    
    for (const role of user.roles) {
      if (!role.isActive) continue;
      
      if (role.country) {
        countries.add(role.country);
      }
      
      // Regional coordinators have access to their region
      if (role.roleName === 'coordinator-tanzania') {
        countries.add('Tanzania');
      } else if (role.roleName === 'coordinator-cote-divoire') {
        countries.add('Côte d\'Ivoire');
      }
    }

    return Array.from(countries);
  }

  /**
   * Check if user can manage users
   */
  canManageUsers(scope: 'global' | 'regional' | 'project' = 'global'): boolean {
    return this.hasResourcePermission('users', 'create', scope) || 
           this.hasResourcePermission('users', 'update', scope) ||
           this.hasResourcePermission('users', 'delete', scope);
  }

  /**
   * Check if user can create projects
   */
  canCreateProjects(): boolean {
    return this.hasResourcePermission('projects', 'create', 'global');
  }

  /**
   * Check if user can manage project data
   */
  canManageProjectData(projectId: string): boolean {
    return this.canAccessProject(projectId, 'write');
  }

  /**
   * Forms-specific helpers
   * Community facilitators have forms:list-project and forms:responses-read-own-project only.
   */
  canViewForms(projectId: string): boolean {
    return (
      this.canAccessProjectComponent(projectId, 'forms', 'read') ||
      this.hasProjectPermission('forms', 'list', projectId) ||
      this.hasProjectPermission('forms', 'responses-read-own', projectId)
    );
  }

  canEditForms(projectId: string): boolean {
    return this.hasProjectPermission('forms', 'update', projectId) || this.hasResourcePermission('forms', 'update', 'regional') || this.hasResourcePermission('forms', 'update', 'global');
  }

  canViewFormResponses(projectId: string): boolean {
    return (
      this.hasProjectPermission('forms', 'responses-read', projectId) ||
      this.hasProjectPermission('forms', 'responses-read-own', projectId) ||
      this.hasResourcePermission('forms', 'responses-read', 'regional') ||
      this.hasResourcePermission('forms', 'responses-read', 'global')
    );
  }

  canEditFormResponses(projectId: string): boolean {
    return this.hasProjectPermission('forms', 'responses-update', projectId) || this.hasResourcePermission('forms', 'responses-update', 'regional') || this.hasResourcePermission('forms', 'responses-update', 'global');
  }

  canDeleteFormResponses(projectId: string): boolean {
    return this.hasProjectPermission('forms', 'responses-delete', projectId) || this.hasResourcePermission('forms', 'responses-delete', 'regional') || this.hasResourcePermission('forms', 'responses-delete', 'global');
  }

  canExportFormResponses(projectId: string): boolean {
    return this.hasProjectPermission('forms', 'responses-export', projectId) || this.hasResourcePermission('forms', 'responses-export', 'regional') || this.hasResourcePermission('forms', 'responses-export', 'global');
  }
}

/**
 * Hook to create an enhanced permission manager with current auth context
 */
export function createEnhancedPermissionManager(authContext: PermissionContext): EnhancedPermissionManager {
  return new EnhancedPermissionManager(authContext);
}

