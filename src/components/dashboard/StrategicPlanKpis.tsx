import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Save, ArrowLeft, Target } from 'lucide-react';
import { strategicPlanApi, type StrategicPlan, type PlanKpi } from '@/lib/api/strategicPlanApi';
import { useNotifications } from '@/contexts/NotificationContext';

export function StrategicPlanKpis() {
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const [plans, setPlans] = useState<StrategicPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [kpis, setKpis] = useState<PlanKpi[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{ name: string; currentValue: string; targetValue: string; unit: string }>({
    name: '',
    currentValue: '0',
    targetValue: '0',
    unit: ''
  });

  useEffect(() => {
    loadPlans();
  }, []);

  useEffect(() => {
    if (selectedPlanId) loadKpis(selectedPlanId);
    else setKpis([]);
  }, [selectedPlanId]);

  const loadPlans = async () => {
    try {
      const data = await strategicPlanApi.getStrategicPlans();
      setPlans(data || []);
      if (!selectedPlanId && data?.length) setSelectedPlanId(data[0].id);
    } catch (e) {
      addNotification({ type: 'error', title: 'Error', message: 'Failed to load strategic plans', duration: 4000 });
    }
  };

  const loadKpis = async (planId: string) => {
    setIsLoading(true);
    try {
      const data = await strategicPlanApi.getKpisByPlanId(planId);
      setKpis(data || []);
    } catch (e) {
      addNotification({ type: 'error', title: 'Error', message: 'Failed to load KPIs', duration: 4000 });
      setKpis([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingId('new');
    setForm({ name: '', currentValue: '0', targetValue: '0', unit: '' });
  };

  const handleSaveNew = async () => {
    if (!selectedPlanId) return;
    const currentValue = Number(form.currentValue);
    const targetValue = Number(form.targetValue);
    if (isNaN(currentValue) || isNaN(targetValue) || !form.unit.trim()) {
      addNotification({ type: 'error', title: 'Validation', message: 'Unit, current value and target value are required', duration: 4000 });
      return;
    }
    setIsSaving(true);
    try {
      await strategicPlanApi.createKpi(selectedPlanId, {
        name: form.name.trim() || undefined,
        currentValue,
        targetValue,
        unit: form.unit.trim()
      });
      addNotification({ type: 'success', title: 'KPI created', message: 'Organisation-level KPI added', duration: 3000 });
      setEditingId(null);
      loadKpis(selectedPlanId);
    } catch (e) {
      addNotification({ type: 'error', title: 'Error', message: 'Failed to create KPI', duration: 4000 });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (kpiId: string) => {
    if (!window.confirm('Remove this KPI? Links from activities will be cleared.')) return;
    try {
      await strategicPlanApi.deleteKpi(kpiId);
      addNotification({ type: 'success', title: 'KPI removed', duration: 3000 });
      if (selectedPlanId) loadKpis(selectedPlanId);
    } catch (e) {
      addNotification({ type: 'error', title: 'Error', message: 'Failed to delete KPI', duration: 4000 });
    }
  };

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="flex items-center space-x-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Organisation-level KPIs</h1>
            <p className="text-muted-foreground">Manage KPIs for your strategic plan; link them to activities when editing the plan</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Strategic plan</CardTitle>
          <CardDescription>Select the plan to manage KPIs for</CardDescription>
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
                  <Target className="h-5 w-5" />
                  KPIs for {selectedPlan?.title || 'Plan'}
                </CardTitle>
                <CardDescription>Add KPIs and link them to objectives, strategic actions, or activities in Edit Strategic Plan</CardDescription>
              </div>
              {editingId !== 'new' && (
                <Button onClick={handleCreate} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add KPI
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {editingId === 'new' && (
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-lg">New KPI</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Display name (optional)</Label>
                      <Input
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. Number of parents reached"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Unit</Label>
                      <Input
                        value={form.unit}
                        onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                        placeholder="e.g. people, %"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Current value</Label>
                      <Input
                        type="number"
                        value={form.currentValue}
                        onChange={(e) => setForm((f) => ({ ...f, currentValue: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Target value</Label>
                      <Input
                        type="number"
                        value={form.targetValue}
                        onChange={(e) => setForm((f) => ({ ...f, targetValue: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveNew} disabled={isSaving}>Save KPI</Button>
                    <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {isLoading ? (
              <p className="text-muted-foreground">Loading KPIs...</p>
            ) : kpis.length === 0 && editingId !== 'new' ? (
              <p className="text-muted-foreground">No KPIs yet. Add one to link to activities in Edit Strategic Plan.</p>
            ) : (
              <ul className="space-y-2">
                {kpis.map((kpi) => (
                  <li key={kpi.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                    <div>
                      <span className="font-medium">{kpi.name || kpi.unit || 'KPI'}</span>
                      <span className="text-muted-foreground text-sm ml-2">
                        {kpi.currentValue} / {kpi.targetValue} {kpi.unit}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(kpi.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
