import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Shield,
  Edit,
  Users,
  Search,
  Eye,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Role, Permission, userManagementService } from '@/services/userManagementService';
import { permissionsService } from '@/services/permissionsService';
import { EditRoleDialog } from './EditRoleDialog';
import { useNotifications } from '@/contexts/NotificationContext';

interface RoleManagementProps {
  roles: Role[];
  onRolesChange: () => void | Promise<void>;
}

export function RoleManagement({ roles, onRolesChange }: RoleManagementProps) {
  const { addNotification } = useNotifications();
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | '1-2' | '3-4' | '5-6'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [togglingRoleId, setTogglingRoleId] = useState<string | null>(null);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load permissions when component mounts
  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      const all = await permissionsService.getAllPermissions();
      setPermissions(all);
    } catch (error) {
      console.error('Failed to load permissions:', error);
    }
  };

  const filteredRoles = roles.filter((role) => {
    const matchesSearch =
      role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      role.description?.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesLevel = true;
    if (levelFilter !== 'all') {
      const [min, max] = levelFilter.split('-').map(Number);
      matchesLevel = role.level >= min && role.level <= max;
    }

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && role.isActive) ||
      (statusFilter === 'inactive' && !role.isActive);

    return matchesSearch && matchesLevel && matchesStatus;
  });

  const catalogActiveCount = roles.filter((r) => r.isActive).length;
  const catalogInactiveCount = roles.length - catalogActiveCount;

  const getRoleBadgeVariant = (level: number) => {
    if (level <= 2) return 'destructive';
    if (level <= 4) return 'default';
    return 'secondary';
  };

  const getPermissionBadgeVariant = (scope: string) => {
    switch (scope) {
      case 'global': return 'destructive';
      case 'regional': return 'default';
      case 'project': return 'secondary';
      case 'own': return 'outline';
      default: return 'outline';
    }
  };

  const handleViewRoleDetails = (role: Role) => {
    setSelectedRole(role);
    setDetailsDialogOpen(true);
  };

  const handleEditRole = (role: Role) => {
    setSelectedRole(role);
    setEditDialogOpen(true);
  };

  const handleUpdateRole = async (roleId: string, roleData: any) => {
    try {
      await userManagementService.updateRole(roleId, roleData);
      setEditDialogOpen(false);
      setSelectedRole(null);
      onRolesChange(); // Refresh the roles list
    } catch (error: any) {
      throw error; // Re-throw to let the dialog handle the error
    }
  };

  const handleToggleRoleActive = async (role: Role, nextActive: boolean) => {
    if (role.isActive === nextActive) return;
    setTogglingRoleId(role.id);
    try {
      await userManagementService.updateRole(role.id, { isActive: nextActive });
      addNotification({
        type: 'success',
        title: nextActive ? 'Role activated' : 'Role deactivated',
        message: `"${role.name}" is now ${nextActive ? 'active' : 'inactive'}. Inactive roles cannot be assigned to new users.`,
        duration: 4000,
      });
      await onRolesChange();
      setSelectedRole((prev) =>
        prev?.id === role.id ? { ...prev, isActive: nextActive } : prev,
      );
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Update failed',
        message: error?.message || 'Could not update role status.',
        duration: 5000,
      });
    } finally {
      setTogglingRoleId(null);
    }
  };

  const canDeleteRole = (role: Role) => role.name !== 'global-admin';

  const handleDeleteRole = async (role: Role) => {
    if (!canDeleteRole(role)) return;
    const confirmed = window.confirm(
      `Delete role "${role.name}"?\n\nThis cannot be undone. All users will lose this role assignment (and any project links for it). Role permissions for this role will be removed.`,
    );
    if (!confirmed) return;

    setDeletingRoleId(role.id);
    try {
      await userManagementService.deleteRole(role.id);
      addNotification({
        type: 'success',
        title: 'Role deleted',
        message: `Role "${role.name}" has been removed.`,
        duration: 4000,
      });
      if (selectedRole?.id === role.id) {
        setDetailsDialogOpen(false);
        setEditDialogOpen(false);
        setSelectedRole(null);
      }
      await onRolesChange();
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Delete failed',
        message: error?.message || 'Could not delete this role.',
        duration: 6000,
      });
    } finally {
      setDeletingRoleId(null);
    }
  };

  const groupedPermissions = permissions.reduce((acc, permission) => {
    if (!acc[permission.resource]) {
      acc[permission.resource] = [];
    }
    acc[permission.resource].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Roles & Permissions
          </h2>
          <p className="text-muted-foreground">
            Manage system roles and their associated permissions. Inactive roles remain visible here but are hidden from
            user assignment until activated.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Catalog:{' '}
            <span className="font-medium text-foreground">{catalogActiveCount} active</span>
            {' · '}
            <span className="font-medium text-foreground">{catalogInactiveCount} inactive</span>
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search roles by name or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={levelFilter} onValueChange={(value: any) => setLevelFilter(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="1-2">Level 1-2 (Admin)</SelectItem>
                <SelectItem value="3-4">Level 3-4 (Regional)</SelectItem>
                <SelectItem value="5-6">Level 5-6 (Project)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="inactive">Inactive only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Roles Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            System Roles ({filteredRoles.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role Name</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[200px]">Active</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRoles.map((role) => (
                <TableRow
                  key={role.id}
                  className={!role.isActive ? 'bg-muted/30' : undefined}
                >
                  <TableCell>
                    <div className="font-medium flex items-center gap-2">
                      {role.name}
                      {!role.isActive && (
                        <Badge variant="secondary" className="text-xs font-normal">
                          Inactive
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(role.level)}>
                      Level {role.level}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-muted-foreground">
                      {role.description || 'No description'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={role.isActive}
                        disabled={togglingRoleId === role.id || deletingRoleId === role.id}
                        onCheckedChange={(checked) => handleToggleRoleActive(role, checked)}
                        aria-label={role.isActive ? `Deactivate ${role.name}` : `Activate ${role.name}`}
                      />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {role.isActive ? 'On' : 'Off'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleViewRoleDetails(role)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditRole(role)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Role
                        </DropdownMenuItem>
                        {canDeleteRole(role) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              disabled={deletingRoleId === role.id}
                              onClick={() => handleDeleteRole(role)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {deletingRoleId === role.id ? 'Deleting…' : 'Delete Role'}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Role Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Role Details: {selectedRole?.name}
            </DialogTitle>
            <DialogDescription>
              View detailed information about this role and its permissions.
            </DialogDescription>
          </DialogHeader>

          {selectedRole && (
            <div className="space-y-6">
              {/* Role Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Role Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Role Name</Label>
                      <p className="text-sm">{selectedRole.name}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Level</Label>
                      <div className="mt-1">
                        <Badge variant={getRoleBadgeVariant(selectedRole.level)}>
                          Level {selectedRole.level}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Description</Label>
                    <p className="text-sm text-muted-foreground">
                      {selectedRole.description || 'No description provided'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Active</Label>
                    <div className="mt-1 flex items-center gap-3">
                      <Switch
                        checked={selectedRole.isActive}
                        disabled={
                          togglingRoleId === selectedRole.id ||
                          deletingRoleId === selectedRole.id
                        }
                        onCheckedChange={(checked) =>
                          handleToggleRoleActive(selectedRole, checked)
                        }
                        aria-label={`Toggle active for ${selectedRole.name}`}
                      />
                      <Badge variant={selectedRole.isActive ? 'default' : 'secondary'}>
                        {selectedRole.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Permissions by Resource */}
              <Card>
                <CardHeader>
                  <CardTitle>Assigned Permissions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {Object.entries(groupedPermissions).map(([resource, resourcePermissions]) => (
                      <div key={resource} className="space-y-3">
                        <h4 className="font-medium capitalize">{resource} Management</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {resourcePermissions.map((permission) => (
                            <div key={permission.id} className="flex items-center gap-2 p-2 border rounded-lg">
                              <Badge variant={getPermissionBadgeVariant(permission.scope)} className="text-xs">
                                {permission.scope}
                              </Badge>
                              <div className="flex-1">
                                <div className="text-sm font-medium">{permission.action}</div>
                                <div className="text-xs text-muted-foreground">
                                  {permission.description}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:space-x-0">
            {selectedRole && canDeleteRole(selectedRole) ? (
              <Button
                type="button"
                variant="destructive"
                disabled={deletingRoleId === selectedRole.id}
                className="w-full sm:w-auto"
                onClick={() => handleDeleteRole(selectedRole)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {deletingRoleId === selectedRole.id ? 'Deleting…' : 'Delete role'}
              </Button>
            ) : (
              <span />
            )}
            <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <EditRoleDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        role={selectedRole}
        permissions={permissions}
        onSubmit={handleUpdateRole}
      />
    </div>
  );
}
