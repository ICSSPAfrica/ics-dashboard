import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Settings, Trash2, BarChart3, Calendar, Filter } from 'lucide-react';
import { useNotification } from '@/hooks/useNotification';
import { KoboDataService, KoboKpiMapping as KoboKpiMappingType, ProjectKoboTable, TableColumn } from '@/services/koboDataService';
import { useProjects } from '@/contexts/ProjectsContext';
import { useAuth } from '@/contexts/AuthContext';
import { createEnhancedPermissionManager } from '@/lib/permissions';

interface KoboKpiMappingProps {
  projectId: string;
}

export function KoboKpiMapping({ projectId }: KoboKpiMappingProps) {
  const { showSuccess, showError } = useNotification();
  const { getProjectKPIs, dataRefreshTrigger } = useProjects();
  const { user, isAuthenticated, isLoading } = useAuth();
  const permissionManager = createEnhancedPermissionManager({
    user,
    isAuthenticated,
    isLoading,
  });
  const canUpdate = permissionManager.hasProjectPermission('kobo', 'update', projectId) ||
    permissionManager.hasResourcePermission('kobo', 'update', 'regional') ||
    permissionManager.hasResourcePermission('kobo', 'update', 'global');
  const [mappings, setMappings] = useState<KoboKpiMappingType[]>([]);
  const [koboTables, setKoboTables] = useState<ProjectKoboTable[]>([]);
  const [projectKPIs, setProjectKPIs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [selectedKpi, setSelectedKpi] = useState<string>('');
  const [columnName, setColumnName] = useState('');
  const [aggregationMethod, setAggregationMethod] = useState<'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'DISTINCT_COUNT'>('COUNT');
  const [timeFilterField, setTimeFilterField] = useState('');
  const [timeFilterValue, setTimeFilterValue] = useState<number | undefined>();
  const [availableColumns, setAvailableColumns] = useState<TableColumn[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);

  useEffect(() => {
    loadData();
  }, [projectId, dataRefreshTrigger]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [mappingsResponse, tablesResponse, kpisResponse] = await Promise.all([
        KoboDataService.getKoboKpiMappings(projectId),
        KoboDataService.getProjectKoboTables(projectId),
        getProjectKPIs(projectId)
      ]);

      setMappings(mappingsResponse.data || []);
      setKoboTables(tablesResponse.data || []);
      setProjectKPIs(kpisResponse || []);
      
      console.log(`Loaded ${kpisResponse?.length || 0} KPIs for project ${projectId}`);
    } catch (error) {
      console.error('Error loading KPI mappings:', error);
      showError('Failed to load KPI mappings');
    } finally {
      setLoading(false);
    }
  };

  const loadTableColumns = async (tableId: string) => {
    if (!tableId) {
      setAvailableColumns([]);
      return;
    }

    setLoadingColumns(true);
    try {
      const response = await KoboDataService.getTableColumns(projectId, tableId);
      setAvailableColumns(response.data || []);
    } catch (error) {
      console.error('Error loading table columns:', error);
      showError('Failed to load table columns');
      setAvailableColumns([]);
    } finally {
      setLoadingColumns(false);
    }
  };

  const handleTableChange = (tableId: string) => {
    setSelectedTable(tableId);
    setColumnName(''); // Reset column selection
    loadTableColumns(tableId);
  };

  const handleCreateMapping = async () => {
    if (!selectedTable || !selectedKpi || !columnName) {
      showError('Please fill in all required fields');
      return;
    }

    if (projectKPIs.length === 0) {
      showError('No KPIs are available for this project. Please create KPIs first in the KPI Analytics section.');
      return;
    }

    try {
      await KoboDataService.createKoboKpiMapping(projectId, {
        projectKoboTableId: selectedTable,
        kpiId: selectedKpi,
        columnName,
        aggregationMethod,
        timeFilterField: timeFilterField || undefined,
        timeFilterValue: timeFilterValue || undefined,
        isActive: true,
      });

      showSuccess('KPI mapping created successfully');
      setShowCreateDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error creating KPI mapping:', error);
      showError('Failed to create KPI mapping');
    }
  };

  const handleDeleteMapping = async (mappingId: string) => {
    try {
      await KoboDataService.deleteKoboKpiMapping(projectId, mappingId);
      showSuccess('KPI mapping deleted successfully');
      loadData();
    } catch (error) {
      console.error('Error deleting KPI mapping:', error);
      showError('Failed to delete KPI mapping');
    }
  };

  const resetForm = () => {
    setSelectedTable('');
    setSelectedKpi('');
    setColumnName('');
    setAggregationMethod('COUNT');
    setTimeFilterField('');
    setTimeFilterValue(undefined);
    setAvailableColumns([]);
  };

  const getAggregationMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      'COUNT': 'Count',
      'SUM': 'Sum',
      'AVG': 'Average',
      'MIN': 'Minimum',
      'MAX': 'Maximum',
      'DISTINCT_COUNT': 'Distinct Count',
    };
    return labels[method] || method;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <BarChart3 className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">Loading KPI mappings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">KPI Mappings</h2>
          <p className="text-sm text-gray-500">
            Map Kobo table columns to project KPIs for automatic calculation
          </p>
        </div>
        {canUpdate && (
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Mapping
            </Button>
          </DialogTrigger>
           <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
             <DialogHeader className="flex-shrink-0">
               <DialogTitle>Create KPI Mapping</DialogTitle>
               <DialogDescription>
                 Map a Kobo table column to a project KPI for automatic calculation
               </DialogDescription>
             </DialogHeader>
             <div className="flex-1 overflow-y-auto space-y-4 p-1">
               <div className="flex flex-col space-y-2">
                 <Label htmlFor="table">Kobo Table</Label>
                 <Select value={selectedTable} onValueChange={handleTableChange}>
                   <SelectTrigger className="min-h-[2.5rem] w-full">
                     <SelectValue placeholder="Select a table" />
                   </SelectTrigger>
                   <SelectContent className="max-w-[800px]">
                     {koboTables.map((table) => (
                       <SelectItem key={table.id} value={table.id} className="py-3">
                         <div className="w-full min-w-0">
                           <div className="font-medium leading-tight break-words">{table.displayName}</div>
                           <div className="text-xs text-gray-500 font-mono break-all mt-1">{table.tableName}</div>
                         </div>
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>

               <div className="flex flex-col space-y-2">
                 <Label htmlFor="kpi">Project KPI</Label>
                 <Select value={selectedKpi} onValueChange={setSelectedKpi}>
                   <SelectTrigger className="min-h-[2.5rem] w-full">
                     <SelectValue placeholder={projectKPIs.length === 0 ? "No KPIs available" : "Select a KPI"} />
                   </SelectTrigger>
                   <SelectContent className="max-w-[800px]">
                     {projectKPIs.length === 0 ? (
                       <SelectItem value="no-kpis" disabled>
                         No KPIs found for this project
                       </SelectItem>
                     ) : (
                       projectKPIs.map((kpi) => (
                         <SelectItem key={kpi.id} value={kpi.id} className="py-3">
                           <div className="w-full min-w-0">
                             <div className="font-medium leading-tight break-words">{kpi.name}</div>
                             {kpi.unit && (
                               <div className="text-xs text-gray-500 mt-1">({kpi.unit})</div>
                             )}
                           </div>
                         </SelectItem>
                       ))
                     )}
                   </SelectContent>
                 </Select>
                 <p className="text-xs text-gray-500">
                   {projectKPIs.length === 0 
                     ? "No KPIs are defined for this project. Create KPIs first in the KPI Analytics section."
                     : `${projectKPIs.length} KPI${projectKPIs.length !== 1 ? 's' : ''} available`
                   }
                 </p>
               </div>

               <div className="flex flex-col space-y-2">
                 <Label htmlFor="column">Column Name</Label>
                 <Select value={columnName} onValueChange={setColumnName} disabled={!selectedTable || loadingColumns}>
                   <SelectTrigger className="min-h-[2.5rem] w-full">
                     <SelectValue placeholder={loadingColumns ? "Loading columns..." : selectedTable ? "Select a column" : "Select a table first"} />
                   </SelectTrigger>
                   <SelectContent className="max-w-[800px]">
                     {availableColumns.length === 0 && !loadingColumns && selectedTable ? (
                       <SelectItem value="no-columns-found" disabled>
                         No columns found
                       </SelectItem>
                     ) : (
                       availableColumns.map((column) => (
                         <SelectItem key={column.name} value={column.name} className="py-3">
                           <div className="w-full min-w-0">
                             <div className="font-medium font-mono break-all">{column.name}</div>
                             <div className="text-xs text-gray-500 mt-1">
                               {column.type}
                               {column.nullable && ' (nullable)'}
                               {column.maxLength && ` (max: ${column.maxLength})`}
                             </div>
                           </div>
                         </SelectItem>
                       ))
                     )}
                   </SelectContent>
                 </Select>
                 <p className="text-xs text-gray-500">
                   Select a column from the chosen Kobo table
                 </p>
               </div>

               <div className="flex flex-col space-y-2">
                 <Label htmlFor="aggregation">Aggregation Method</Label>
                 <Select value={aggregationMethod} onValueChange={(value: any) => setAggregationMethod(value)}>
                   <SelectTrigger className="min-h-[2.5rem] w-full">
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="COUNT">Count</SelectItem>
                     <SelectItem value="SUM">Sum</SelectItem>
                     <SelectItem value="AVG">Average</SelectItem>
                     <SelectItem value="MIN">Minimum</SelectItem>
                     <SelectItem value="MAX">Maximum</SelectItem>
                     <SelectItem value="DISTINCT_COUNT">Distinct Count</SelectItem>
                   </SelectContent>
                 </Select>
               </div>

              <div className="flex flex-col lg:flex-row gap-4">
                 <div className="flex flex-col space-y-2 flex-1">
                   <Label htmlFor="timeField">Time Filter Field (Optional)</Label>
                   <Select value={timeFilterField || "none"} onValueChange={(value) => setTimeFilterField(value === "none" ? "" : value)} disabled={!selectedTable || loadingColumns}>
                     <SelectTrigger className="min-h-[2.5rem] w-full">
                       <SelectValue placeholder="Select time field (optional)" />
                     </SelectTrigger>
                     <SelectContent className="max-w-[500px]">
                       <SelectItem value="none">None</SelectItem>
                       {availableColumns
                         .filter(col => col.type.includes('timestamp') || col.type.includes('date') || col.type.includes('time'))
                         .map((column) => (
                           <SelectItem key={column.name} value={column.name} className="py-3">
                             <div className="w-full min-w-0">
                               <div className="font-medium font-mono break-all">{column.name}</div>
                               <div className="text-xs text-gray-500 mt-1">{column.type}</div>
                             </div>
                           </SelectItem>
                         ))}
                     </SelectContent>
                   </Select>
                 </div>
                 <div className="flex flex-col space-y-2 flex-1">
                   <Label htmlFor="timeValue">Days to Look Back (Optional)</Label>
                   <Input
                     id="timeValue"
                     type="number"
                     value={timeFilterValue || ''}
                     onChange={(e) => setTimeFilterValue(e.target.value ? parseInt(e.target.value) : undefined)}
                     placeholder="e.g., 30"
                     className="min-h-[2.5rem] w-full"
                   />
                 </div>
              </div>

            </div>
            <div className="flex-shrink-0 flex justify-end space-x-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateMapping}
                disabled={projectKPIs.length === 0}
              >
                Create Mapping
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {mappings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No KPI Mappings</h3>
            <p className="text-gray-500 text-center mb-4">
              No KPI mappings have been created yet. Create mappings to automatically calculate KPIs from Kobo data.
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Mapping
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Active Mappings</CardTitle>
            <CardDescription>
              {mappings.length} mapping{mappings.length !== 1 ? 's' : ''} configured
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 border-b">
                    <TableHead className="font-semibold text-gray-900 border-r px-3 py-3">Kobo Table</TableHead>
                    <TableHead className="font-semibold text-gray-900 border-r px-3 py-3">KPI</TableHead>
                    <TableHead className="font-semibold text-gray-900 border-r px-3 py-3">Column</TableHead>
                    <TableHead className="font-semibold text-gray-900 border-r px-3 py-3">Method</TableHead>
                    <TableHead className="font-semibold text-gray-900 border-r px-3 py-3">Time Filter</TableHead>
                    <TableHead className="font-semibold text-gray-900 border-r px-3 py-3">Status</TableHead>
                    <TableHead className="font-semibold text-gray-900 px-3 py-3">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.map((mapping, index) => (
                    <TableRow 
                      key={mapping.id} 
                      className={`border-b hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}
                    >
                      <TableCell className="border-r px-3 py-3">
                        <div className="min-w-[200px]">
                          <div className="font-medium text-gray-900">{mapping.projectKoboTable.displayName}</div>
                          <div className="text-xs text-gray-500 font-mono">{mapping.projectKoboTable.tableName}</div>
                        </div>
                      </TableCell>
                      <TableCell className="border-r px-3 py-3">
                        <div className="min-w-[150px]">
                          <div className="font-medium text-gray-900">{mapping.kpi.name}</div>
                          {mapping.kpi.unit && (
                            <div className="text-xs text-gray-500">({mapping.kpi.unit})</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="border-r px-3 py-3 font-mono text-sm text-gray-900 min-w-[120px]">
                        {mapping.columnName}
                      </TableCell>
                      <TableCell className="border-r px-3 py-3">
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          {getAggregationMethodLabel(mapping.aggregationMethod)}
                        </span>
                      </TableCell>
                      <TableCell className="border-r px-3 py-3 min-w-[150px]">
                        {mapping.timeFilterField && mapping.timeFilterValue ? (
                          <div className="text-sm">
                            <div className="flex items-center text-gray-900">
                              <Calendar className="h-3 w-3 mr-1" />
                              {mapping.timeFilterField}
                            </div>
                            <div className="flex items-center text-gray-500 text-xs">
                              <Filter className="h-3 w-3 mr-1" />
                              Last {mapping.timeFilterValue} days
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">None</span>
                        )}
                      </TableCell>
                      <TableCell className="border-r px-3 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          mapping.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {mapping.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-3">
                        {canUpdate && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteMapping(mapping.id)}
                          className="h-8 w-8 p-0 hover:bg-red-50 hover:border-red-200"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

