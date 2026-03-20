import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { createEnhancedPermissionManager } from '@/lib/permissions';

const DEFAULT_REDIRECT = '/dashboard/feedback/submit';

/**
 * Gates nested feedback routes by a single permission. Submit flow stays unguarded.
 */
export function RequireFeedbackPermission({
  permission,
  redirectTo = DEFAULT_REDIRECT,
}: {
  permission: string;
  redirectTo?: string;
}) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const permissionManager = createEnhancedPermissionManager({
    user,
    isAuthenticated,
    isLoading,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!permissionManager.hasPermission(permission)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}
