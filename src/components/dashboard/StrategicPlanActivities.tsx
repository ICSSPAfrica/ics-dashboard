import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, ArrowLeft, ListTodo, Pencil } from 'lucide-react';
import { strategicPlanApi, type StrategicPlan, type StrategicActivity, type PlanKpi } from '@/lib/api/strategicPlanApi';
import { useNotifications } from '@/contexts/NotificationContext';

export function StrategicPlanActivities() {
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const [plans, setPlans] = useState<StrategicPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [activities, setActivities] = useState<StrategicActivity[]>([]);
  const [planKpis, setPlanKpis] = useState<PlanKpi[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const activityFormDefaults = {
    title: '',
    description: '',
    code: '',
    timeframeQ1: false,
    timeframeQ2: false,
    timeframeQ3: false,
    timeframeQ4: false,
    annualTarget: '' as string | number,
    strategicKpiId: '' as string,
    plannedBudget: '' as string | number,
  };
  const [editForm, setEditForm] = useState<typeof activityFormDefaults>({ ...activityFormDefaults });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [form, setForm] = useState<typeof activityFormDefaults>({ ...activityFormDefaults });

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  useEffect(() => {
    loadPlans();
  }, []);

  useEffect(() => {
    if (selectedPlanId) {
      loadActivities(selectedPlanId);
      loadPlanKpis(selectedPlanId);
    } else {
      setActivities([]);
      setPlanKpis([]);
    }
  }, [selectedPlanId]);

  const loadPlanKpis = async (planId: string) => {
    try {
      const data = await strategicPlanApi.getKpisByPlanId(planId);
      setPlanKpis(data || []);
    } catch {
      setPlanKpis([]);
    }
  };

  const loadPlans = async () => {
    try {
      const data = await strategicPlanApi.getStrategicPlans();
      setPlans(data || []);
      if (!selectedPlanId && data?.length) setSelectedPlanId(data[0].id);
    } catch (e) {
      addNotification({ type: 'error', title: 'Error', message: 'Failed to load strategic plans', duration: 4000 });
    }
  };

  const loadActivities = async (planId: string) => {
    setIsLoading(true);
    try {
      const data = await strategicPlanApi.getActivitiesByPlanId(planId);
      setActivities(data || []);
    } catch (e) {
      addNotification({ type: 'error', title: 'Error', message: 'Failed to load organisation activities', duration: 4000 });
      setActivities([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingId('new');
    setForm({ ...activityFormDefaults });
  };

  const handleSaveNew = async () => {
    if (!selectedPlanId) return;
    if (!form.title.trim()) {
      addNotification({ type: 'error', title: 'Validation', message: 'Title is required', duration: 4000 });
      return;
    }
    setIsSaving(true);
    try {
      await strategicPlanApi.createActivity(selectedPlanId, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        code: form.code.trim() || undefined,
        timeframeQ1: form.timeframeQ1,
        timeframeQ2: form.timeframeQ2,
        timeframeQ3: form.timeframeQ3,
        timeframeQ4: form.timeframeQ4,
        annualTarget: form.annualTarget === '' ? undefined : Number(form.annualTarget),
        strategicKpiId: form.strategicKpiId?.trim() || undefined,
        plannedBudget: form.plannedBudget === '' ? undefined : Number(form.plannedBudget),
      });
      addNotification({ type: 'success', title: 'Activity created', message: 'Organisation-wide activity added', duration: 3000 });
      setEditingId(null);
      loadActivities(selectedPlanId);
    } catch (e) {
      addNotification({ type: 'error', title: 'Error', message: 'Failed to create activity', duration: 4000 });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (activityId: string) => {
    if (!window.confirm('Remove this organisation-wide activity? Links from strategic actions will be cleared.')) return;
    try {
      await strategicPlanApi.deleteActivity(activityId);
      addNotification({ type: 'success', title: 'Activity removed', duration: 3000 });
      if (selectedPlanId) loadActivities(selectedPlanId);
    } catch (e) {
      addNotification({ type: 'error', title: 'Error', message: 'Failed to delete activity', duration: 4000 });
    }
  };

  const openEditActivity = (activity: StrategicActivity) => {
    setEditingActivityId(activity.id);
    setEditForm({
      title: activity.title,
      description: activity.description || '',
      code: activity.code || '',
      timeframeQ1: activity.timeframeQ1 ?? false,
      timeframeQ2: activity.timeframeQ2 ?? false,
      timeframeQ3: activity.timeframeQ3 ?? false,
      timeframeQ4: activity.timeframeQ4 ?? false,
      annualTarget: activity.annualTarget ?? '',
      strategicKpiId: activity.strategicKpiId || '',
      plannedBudget: activity.plannedBudget ?? '',
    });
  };

  const closeEditActivity = () => setEditingActivityId(null);

  const handleSaveEdit = async () => {
    if (!editingActivityId) return;
    if (!editForm.title.trim()) {
      addNotification({ type: 'error', title: 'Validation', message: 'Title is required', duration: 4000 });
      return;
    }
    setIsSavingEdit(true);
    try {
      await strategicPlanApi.updateActivity(editingActivityId, {
        title: editForm.title.trim(),
        description: editForm.description.trim() || undefined,
        code: editForm.code.trim() || undefined,
        timeframeQ1: editForm.timeframeQ1,
        timeframeQ2: editForm.timeframeQ2,
        timeframeQ3: editForm.timeframeQ3,
        timeframeQ4: editForm.timeframeQ4,
        annualTarget: editForm.annualTarget === '' ? undefined : Number(editForm.annualTarget),
        strategicKpiId: editForm.strategicKpiId?.trim() || undefined,
        plannedBudget: editForm.plannedBudget === '' ? undefined : Number(editForm.plannedBudget),
      });
      addNotification({ type: 'success', title: 'Activity updated', duration: 3000 });
      closeEditActivity();
      if (selectedPlanId) loadActivities(selectedPlanId);
    } catch (e) {
      addNotification({ type: 'error', title: 'Error', message: 'Failed to update activity', duration: 4000 });
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Organisation-wide activities</h1>
          <p className="text-muted-foreground text-sm">
            Define activities at plan level to use as linkages across objectives and strategic actions.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Strategic plan</CardTitle>
          <CardDescription>Select the plan to manage organisation-wide activities for</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedPlanId || ''} onValueChange={(v) => setSelectedPlanId(v || null)}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Select a plan" />
            </SelectTrigger>
            <SelectContent>
              {plans.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title} ({p.startYear}–{p.endYear})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedPlanId && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ListTodo className="h-5 w-5" />
                  Activities for {selectedPlan?.title || 'Plan'}
                </CardTitle>
                <CardDescription>
                  Add organisation-wide activities and link them to strategic actions in Edit Strategic Plan.
                </CardDescription>
              </div>
              {editingId !== 'new' && (
                <Button onClick={handleCreate} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add activity
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {editingId === 'new' && (
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-lg">New organisation-wide activity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="e.g. Regional coordination meetings"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Code (optional)</Label>
                    <Input
                      value={form.code}
                      onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                      placeholder="e.g. OA1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description (optional)</Label>
                    <Textarea
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Brief description"
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Timeframes (optional)</Label>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2">
                        <Checkbox checked={form.timeframeQ1} onCheckedChange={(c) => setForm((f) => ({ ...f, timeframeQ1: !!c }))} />
                        <span className="text-sm">Q1</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <Checkbox checked={form.timeframeQ2} onCheckedChange={(c) => setForm((f) => ({ ...f, timeframeQ2: !!c }))} />
                        <span className="text-sm">Q2</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <Checkbox checked={form.timeframeQ3} onCheckedChange={(c) => setForm((f) => ({ ...f, timeframeQ3: !!c }))} />
                        <span className="text-sm">Q3</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <Checkbox checked={form.timeframeQ4} onCheckedChange={(c) => setForm((f) => ({ ...f, timeframeQ4: !!c }))} />
                        <span className="text-sm">Q4</span>
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Annual target (optional)</Label>
                      <Input
                        type="number"
                        value={form.annualTarget}
                        onChange={(e) => setForm((f) => ({ ...f, annualTarget: e.target.value }))}
                        placeholder="e.g. 100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Planned budget (optional)</Label>
                      <Input
                        type="number"
                        value={form.plannedBudget}
                        onChange={(e) => setForm((f) => ({ ...f, plannedBudget: e.target.value }))}
                        placeholder="e.g. 5000"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Link to KPI (optional)</Label>
                    <Select
                      value={form.strategicKpiId || '_none'}
                      onValueChange={(v) => setForm((f) => ({ ...f, strategicKpiId: v === '_none' ? '' : v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a KPI" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">None</SelectItem>
                        {planKpis.map((kpi) => (
                          <SelectItem key={kpi.id} value={kpi.id}>
                            {kpi.name || kpi.unit || 'KPI'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveNew} disabled={isSaving}>Save activity</Button>
                    <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {isLoading ? (
              <p className="text-muted-foreground">Loading activities...</p>
            ) : activities.length === 0 && editingId !== 'new' ? (
              <p className="text-muted-foreground">
                No organisation-wide activities yet. Add one to link from strategic actions in Edit Strategic Plan.
              </p>
            ) : (
              <ul className="space-y-2">
                {activities.map((activity) => (
                  <li key={activity.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                    <div>
                      <span className="font-medium">{activity.title}</span>
                      {activity.code && (
                        <span className="text-muted-foreground text-sm ml-2">({activity.code})</span>
                      )}
                      {activity.description && (
                        <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
                      )}
                      {(activity.timeframeQ1 || activity.timeframeQ2 || activity.timeframeQ3 || activity.timeframeQ4 || activity.annualTarget != null || activity.strategicKpi) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {[activity.timeframeQ1 && 'Q1', activity.timeframeQ2 && 'Q2', activity.timeframeQ3 && 'Q3', activity.timeframeQ4 && 'Q4'].filter(Boolean).length > 0 && (
                            <span>Timeframe: {[activity.timeframeQ1 && 'Q1', activity.timeframeQ2 && 'Q2', activity.timeframeQ3 && 'Q3', activity.timeframeQ4 && 'Q4'].filter(Boolean).join(', ')}</span>
                          )}
                          {activity.annualTarget != null && <span>{activity.timeframeQ1 || activity.timeframeQ2 || activity.timeframeQ3 || activity.timeframeQ4 ? ' · ' : ''}Target: {activity.annualTarget}</span>}
                          {activity.strategicKpi && <span> · KPI: {activity.strategicKpi.name || activity.strategicKpi.unit}</span>}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => openEditActivity(activity)}>
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive border-destructive/50 hover:bg-destructive/10"
                        onClick={() => handleDelete(activity.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={editingActivityId !== null} onOpenChange={(open) => !open && closeEditActivity()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit activity</DialogTitle>
            <DialogDescription>Update the organisation-wide activity title, code, description, timeframes, and targets.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="edit-activity-title">Title</Label>
              <Input
                id="edit-activity-title"
                value={editForm.title}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Regional coordination meetings"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-activity-code">Code (optional)</Label>
              <Input
                id="edit-activity-code"
                value={editForm.code}
                onChange={(e) => setEditForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. OA1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-activity-desc">Description (optional)</Label>
              <Textarea
                id="edit-activity-desc"
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Brief description"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Timeframes (optional)</Label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2">
                  <Checkbox checked={editForm.timeframeQ1} onCheckedChange={(c) => setEditForm((f) => ({ ...f, timeframeQ1: !!c }))} />
                  <span className="text-sm">Q1</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={editForm.timeframeQ2} onCheckedChange={(c) => setEditForm((f) => ({ ...f, timeframeQ2: !!c }))} />
                  <span className="text-sm">Q2</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={editForm.timeframeQ3} onCheckedChange={(c) => setEditForm((f) => ({ ...f, timeframeQ3: !!c }))} />
                  <span className="text-sm">Q3</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={editForm.timeframeQ4} onCheckedChange={(c) => setEditForm((f) => ({ ...f, timeframeQ4: !!c }))} />
                  <span className="text-sm">Q4</span>
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-activity-target">Annual target (optional)</Label>
                <Input
                  id="edit-activity-target"
                  type="number"
                  value={editForm.annualTarget}
                  onChange={(e) => setEditForm((f) => ({ ...f, annualTarget: e.target.value }))}
                  placeholder="e.g. 100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-activity-budget">Planned budget (optional)</Label>
                <Input
                  id="edit-activity-budget"
                  type="number"
                  value={editForm.plannedBudget}
                  onChange={(e) => setEditForm((f) => ({ ...f, plannedBudget: e.target.value }))}
                  placeholder="e.g. 5000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Link to KPI (optional)</Label>
              <Select
                value={editForm.strategicKpiId || '_none'}
                onValueChange={(v) => setEditForm((f) => ({ ...f, strategicKpiId: v === '_none' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a KPI" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {planKpis.map((kpi) => (
                    <SelectItem key={kpi.id} value={kpi.id}>
                      {kpi.name || kpi.unit || 'KPI'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditActivity} disabled={isSavingEdit}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={isSavingEdit}>{isSavingEdit ? 'Saving…' : 'Save changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
