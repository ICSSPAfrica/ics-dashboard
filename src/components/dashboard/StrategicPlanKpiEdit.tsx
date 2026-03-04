import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import { strategicPlanApi, type PlanKpi } from '@/lib/api/strategicPlanApi';
import { useNotifications } from '@/contexts/NotificationContext';

export function StrategicPlanKpiEdit() {
  const { kpiId } = useParams<{ kpiId: string }>();
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const [kpi, setKpi] = useState<(PlanKpi & { strategicPlan?: { id: string; title: string; startYear: number; endYear: number } }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    currentValue: string;
    targetValue: string;
    unit: string;
    type: string;
    baseYear: string;
    baseYearValue: string;
    annualTargets: Record<number, string>;
  }>({
    name: '',
    currentValue: '0',
    targetValue: '0',
    unit: '',
    type: 'radialGauge',
    baseYear: '',
    baseYearValue: '',
    annualTargets: {},
  });

  useEffect(() => {
    if (!kpiId) return;
    let cancelled = false;
    setLoading(true);
    strategicPlanApi.getKpiById(kpiId)
      .then((data) => {
        if (cancelled) return;
        setKpi(data);
        const plan = data.strategicPlan;
        const planYears: number[] = plan
          ? Array.from({ length: plan.endYear - plan.startYear + 1 }, (_, i) => plan.startYear + i)
          : [];
        const annualTargets: Record<number, string> = {};
        planYears.forEach((y) => {
          const at = data.annualTargets?.find((a: { year: number; targetValue: number }) => a.year === y);
          annualTargets[y] = at != null ? String(at.targetValue) : '';
        });
        setForm({
          name: data.name ?? '',
          currentValue: String(data.currentValue ?? 0),
          targetValue: String(data.targetValue ?? 0),
          unit: data.unit ?? '',
          type: data.type ?? 'radialGauge',
          baseYear: data.baseYear != null ? String(data.baseYear) : '',
          baseYearValue: data.baseYearValue != null ? String(data.baseYearValue) : '',
          annualTargets,
        });
      })
      .catch(() => {
        if (!cancelled) addNotification({ type: 'error', title: 'Error', message: 'Failed to load KPI', duration: 4000 });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [kpiId, addNotification]);

  const plan = kpi?.strategicPlan;
  const planYears: number[] = plan
    ? Array.from({ length: plan.endYear - plan.startYear + 1 }, (_, i) => plan.startYear + i)
    : [];
  const baseYearOptions: number[] = plan
    ? [plan.startYear - 2, plan.startYear - 1, plan.startYear]
    : [];

  const buildAnnualTargets = (annualTargets: Record<number, string>) => {
    return Object.entries(annualTargets)
      .map(([year, val]) => ({ year: parseInt(year, 10), targetValue: Number(val) }))
      .filter((at) => !isNaN(at.year) && !isNaN(at.targetValue) && at.targetValue >= 0);
  };

  const handleSave = async () => {
    if (!kpiId) return;
    const current = Number(form.currentValue);
    const target = Number(form.targetValue);
    if (isNaN(current) || isNaN(target) || !form.unit.trim()) {
      addNotification({ type: 'error', title: 'Validation', message: 'Unit, current value and target value are required', duration: 4000 });
      return;
    }
    if (form.baseYear && (isNaN(parseInt(form.baseYear, 10)) || parseInt(form.baseYear, 10) < 1900 || parseInt(form.baseYear, 10) > 2100)) {
      addNotification({ type: 'error', title: 'Validation', message: 'Base year must be a valid year', duration: 4000 });
      return;
    }
    setSaving(true);
    try {
      await strategicPlanApi.updateKpi(kpiId, {
        name: form.name.trim() || undefined,
        currentValue: current,
        targetValue: target,
        unit: form.unit.trim(),
        type: form.type,
        baseYear: form.baseYear ? parseInt(form.baseYear, 10) : null,
        baseYearValue: form.baseYearValue ? Number(form.baseYearValue) : null,
        annualTargets: buildAnnualTargets(form.annualTargets),
      });
      addNotification({ type: 'success', title: 'KPI updated', duration: 3000 });
      navigate('/dashboard/strategic-plan/kpis');
    } catch (e) {
      addNotification({ type: 'error', title: 'Error', message: 'Failed to update KPI', duration: 4000 });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">Loading KPI…</p>
      </div>
    );
  }

  if (!kpi) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">KPI not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/dashboard/strategic-plan/kpis')}>
          Back to KPIs
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/strategic-plan/kpis')} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to KPIs
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit KPI</CardTitle>
          <CardDescription>
            {plan ? `Plan: ${plan.title} (${plan.startYear}–${plan.endYear})` : 'Update the KPI name, values, unit, base year, annual targets, and visualization type.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-kpi-name">Display name (optional)</Label>
              <Input
                id="edit-kpi-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Number of parents reached"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-kpi-unit">Unit</Label>
              <Input
                id="edit-kpi-unit"
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                placeholder="e.g. people, %"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-kpi-current">Current value</Label>
              <Input
                id="edit-kpi-current"
                type="number"
                value={form.currentValue}
                onChange={(e) => setForm((f) => ({ ...f, currentValue: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-kpi-target">Target value (end of plan)</Label>
              <Input
                id="edit-kpi-target"
                type="number"
                value={form.targetValue}
                onChange={(e) => setForm((f) => ({ ...f, targetValue: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Base year (optional)</Label>
              <Select value={form.baseYear || 'none'} onValueChange={(v) => setForm((f) => ({ ...f, baseYear: v === 'none' ? '' : v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select base year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {baseYearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Base year value (optional)</Label>
              <Input
                type="number"
                min={0}
                value={form.baseYearValue}
                onChange={(e) => setForm((f) => ({ ...f, baseYearValue: e.target.value }))}
                placeholder="Value at base year"
              />
            </div>
          </div>

          {planYears.length > 0 && (
            <div className="space-y-2">
              <Label>Annual targets (by plan year)</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {planYears.map((year) => (
                  <div key={year} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{year}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.annualTargets[year] ?? ''}
                      onChange={(e) => setForm((f) => ({
                        ...f,
                        annualTargets: { ...f.annualTargets, [year]: e.target.value }
                      }))}
                      placeholder="Target"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-kpi-type">Visualization type</Label>
            <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
              <SelectTrigger id="edit-kpi-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="radialGauge">Radial gauge</SelectItem>
                <SelectItem value="bulletChart">Bullet chart</SelectItem>
                <SelectItem value="progressBar">Progress bar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
            <Button variant="outline" onClick={() => navigate('/dashboard/strategic-plan/kpis')} disabled={saving}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
