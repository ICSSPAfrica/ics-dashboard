import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadialGauge } from '@/components/visualizations/RadialGauge';
import { StackedBarChart } from '@/components/visualizations/StackedBarChart';
import { AreaChart } from '@/components/visualizations/AreaChart';
import { BulletChart } from '@/components/visualizations/BulletChart';
import { PieChart } from '@/components/visualizations/PieChart';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Target, Activity, TrendingUp, ChevronRight, Calendar, Gauge, LayoutDashboard, BarChart3, Pencil } from 'lucide-react';
import { strategicPlanApi, StrategicPlan, StrategicGoal, PlanKpi } from '@/lib/api/strategicPlanApi';
import { toast } from 'sonner';

// Helper functions
const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high':
      return 'bg-red-100 text-red-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'low':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getOverallProgress = (subgoals: any[]) => {
  if (subgoals.length === 0) return 0;
  const totalProgress = subgoals.reduce((sum, subgoal) => {
    const kpi = subgoal.strategicKpi || subgoal.kpi;
    const currentValue = kpi?.currentValue || kpi?.value || 0;
    const targetValue = kpi?.targetValue || kpi?.target || 1;
    return sum + (currentValue / targetValue) * 100;
  }, 0);
  return Math.round(totalProgress / subgoals.length);
};

export function GlobalOverview() {
  const [searchParams, setSearchParams] = useSearchParams();
  const planIdFromUrl = searchParams.get('plan');

  const [goals, setGoals] = useState<StrategicGoal[]>([]);
  const [planKpis, setPlanKpis] = useState<PlanKpi[]>([]);
  const [availablePlans, setAvailablePlans] = useState<Array<{id: string, title: string, startYear: number, endYear: number}>>([]);
  const [selectedPlanId, setSelectedPlanIdState] = useState<string | null>(planIdFromUrl || null);
  const [activeTab, setActiveTab] = useState<string>('objectives');
  const [isLoading, setIsLoading] = useState(false);
  const [hasData, setHasData] = useState(false);
  const [editingKpiId, setEditingKpiId] = useState<string | null>(null);
  const [editKpiForm, setEditKpiForm] = useState({
    name: '',
    currentValue: '',
    targetValue: '',
    unit: '',
    type: 'radialGauge' as string,
  });
  const [isSavingKpi, setIsSavingKpi] = useState(false);

  const setSelectedPlanId = useCallback((id: string | null) => {
    setSelectedPlanIdState(id);
    if (id) {
      setSearchParams({ plan: id }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }, [setSearchParams]);

  useEffect(() => {
    loadAllPlans();
  }, []);

  // When selected plan changes, fetch that plan's data and organisation-level KPIs from the API
  useEffect(() => {
    if (!selectedPlanId) {
      setGoals([]);
      setPlanKpis([]);
      setHasData(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    Promise.all([
      strategicPlanApi.getStrategicPlan(selectedPlanId),
      strategicPlanApi.getKpisByPlanId(selectedPlanId).catch(() => []),
    ])
      .then(([plan, kpisFromApi]) => {
        if (cancelled) return;
        const goalsList = plan?.goals && Array.isArray(plan.goals) ? plan.goals : [];
        const kpis = Array.isArray(plan?.kpis) && plan.kpis.length > 0 ? plan.kpis : (Array.isArray(kpisFromApi) ? kpisFromApi : []);
        setGoals(goalsList);
        setPlanKpis(kpis);
        setHasData(goalsList.length > 0 || kpis.length > 0);
        if (goalsList.length > 0) {
          toast.success(`Loaded strategic plan: ${plan.title}`, {
            description: `Period: ${plan.startYear}-${plan.endYear} | ${goalsList.length} objectives, ${kpis.length} organisation-level KPIs`,
            duration: 3000,
          });
        }
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Error loading strategic plan:', error);
        setGoals([]);
        setPlanKpis([]);
        setHasData(false);
        toast.error('Failed to load strategic plan data', {
          description: 'Please try selecting a different plan or contact support.',
          duration: 4000,
        });
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedPlanId]);

  const loadAllPlans = async () => {
    try {
      const plans = await strategicPlanApi.getStrategicPlans();
      if (plans && Array.isArray(plans)) {
        const planOptions = plans.map(plan => ({
          id: plan.id,
          title: plan.title,
          startYear: plan.startYear,
          endYear: plan.endYear
        }));
        setAvailablePlans(planOptions);
        // Prefer plan from URL if it exists in the list; otherwise select first plan
        const validIdFromUrl = planIdFromUrl && planOptions.some(p => p.id === planIdFromUrl);
        setSelectedPlanId(validIdFromUrl ? planIdFromUrl : (plans[0]?.id ?? null));
      }
    } catch (error) {
      console.error('Error loading available plans:', error);
    }
  };

  // When plans load, sync selection from URL if not yet set
  useEffect(() => {
    if (availablePlans.length > 0 && planIdFromUrl && availablePlans.some(p => p.id === planIdFromUrl) && selectedPlanId !== planIdFromUrl) {
      setSelectedPlanIdState(planIdFromUrl);
    }
  }, [availablePlans, planIdFromUrl]);

  // Calculate summary statistics
  const totalSubgoals = goals.reduce((sum, goal) => sum + goal.subgoals.length, 0);
  const totalActivities = goals.reduce((sum, goal) => 
    sum + goal.subgoals.reduce((subSum, subgoal) => subSum + subgoal.activityLinks.length, 0), 0
  );
  const uniqueProjects = new Set();
  goals.forEach(goal => {
    goal.subgoals.forEach(subgoal => {
      subgoal.activityLinks.forEach(activity => {
        uniqueProjects.add(activity.projectId);
      });
    });
  });

  const openEditKpi = (kpi: PlanKpi) => {
    setEditingKpiId(kpi.id);
    setEditKpiForm({
      name: kpi.name ?? '',
      currentValue: String(kpi.currentValue ?? 0),
      targetValue: String(kpi.targetValue ?? 0),
      unit: kpi.unit ?? '',
      type: kpi.type ?? 'radialGauge',
    });
  };

  const closeEditKpi = () => {
    setEditingKpiId(null);
  };

  const saveEditKpi = async () => {
    if (!editingKpiId) return;
    const current = Number(editKpiForm.currentValue);
    const target = Number(editKpiForm.targetValue);
    if (isNaN(current) || isNaN(target) || !editKpiForm.unit.trim()) {
      toast.error('Please enter valid current value, target value, and unit.');
      return;
    }
    setIsSavingKpi(true);
    try {
      const updated = await strategicPlanApi.updateKpi(editingKpiId, {
        name: editKpiForm.name.trim() || undefined,
        currentValue: current,
        targetValue: target,
        unit: editKpiForm.unit.trim(),
        type: editKpiForm.type,
      });
      setPlanKpis((prev) => prev.map((k) => (k.id === editingKpiId ? { ...k, ...updated } : k)));
      toast.success('KPI updated');
      closeEditKpi();
    } catch (e) {
      console.error(e);
      toast.error('Failed to update KPI');
    } finally {
      setIsSavingKpi(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        {/* Strategic Plan Filter */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Strategic Plan Filter</span>
            </CardTitle>
            <CardDescription>Select a strategic plan to view its objectives and activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <div className="space-y-2">
                <Label htmlFor="plan-filter">Strategic Plan</Label>
                <Select value={selectedPlanId || ""} onValueChange={(value) => setSelectedPlanId(value || null)}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select a strategic plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePlans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.title} ({plan.startYear}/{plan.endYear})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isLoading && (
                <div className="text-sm text-muted-foreground">Loading...</div>
              )}
            </div>
          </CardContent>
        </Card>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Strategic plan overview: objectives, strategic actions, activities, and organisation-level KPIs
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2 h-11">
          <TabsTrigger value="objectives" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Objectives overview
          </TabsTrigger>
          <TabsTrigger value="kpis" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Organisation KPIs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="objectives" className="space-y-6 mt-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Objectives</p>
                    <p className="text-3xl font-bold text-foreground">{goals.length}</p>
                  </div>
                  <Target className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Strategic actions</p>
                    <p className="text-3xl font-bold text-foreground">{totalSubgoals}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Contributing Projects</p>
                    <p className="text-3xl font-bold text-foreground">{uniqueProjects.size}</p>
                  </div>
                  <Activity className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Activities</p>
                    <p className="text-3xl font-bold text-foreground">{totalActivities}</p>
                  </div>
                  <Activity className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Organisation-level KPIs</p>
                    <p className="text-3xl font-bold text-foreground">{planKpis.length}</p>
                  </div>
                  <Gauge className="h-8 w-8 text-cyan-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Objectives list */}
          <h2 className="text-2xl font-bold text-foreground">Objectives</h2>
          {isLoading ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="flex flex-col items-center space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="text-muted-foreground">Loading strategic plan data...</p>
              </div>
            </CardContent>
          </Card>
        ) : !hasData ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="flex flex-col items-center space-y-4">
                <Target className="h-12 w-12 text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-semibold text-foreground">No Strategic Plan Data</h3>
                  <p className="text-muted-foreground">
                    {availablePlans.length === 0 
                      ? "No strategic plans found. Create a strategic plan to get started."
                      : "Select a strategic plan above to view objectives, strategic actions, activities, and organisation-level KPIs."
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : goals.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="flex flex-col items-center space-y-4">
                <Target className="h-12 w-12 text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-semibold text-foreground">No Objectives Yet</h3>
                  <p className="text-muted-foreground">
                    This plan has no objectives. Add objectives and strategic actions in Edit Strategic Plan.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          ) : (
          goals.map((goal) => {
          const overallProgress = getOverallProgress(goal.subgoals);
          
          return (
            <Card key={goal.id} className="transition-all duration-200 hover:shadow-lg cursor-pointer group">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle className="text-xl group-hover:text-blue-600 transition-colors">
                        {goal.code && <span className="text-muted-foreground font-normal mr-2">{goal.code}</span>}
                        {goal.title}
                      </CardTitle>
                      <Badge className={getPriorityColor(goal.priority.toLowerCase())}>
                        {goal.priority.toLowerCase()} priority
                      </Badge>
                    </div>
                    <CardDescription className="text-base">{goal.description}</CardDescription>
                    <div className="mt-3 flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {goal.subgoals.length} strategic actions
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {goal.subgoals.reduce((sum, sg) => sum + sg.activityLinks.length, 0)} activities
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">
                          Overall Progress: {overallProgress}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <Link 
                      to={`/dashboard/goals/${goal.id}`}
                      state={{ goal, goals, selectedPlanId }}
                    >
                      <Button variant="outline" className="group-hover:bg-blue-50 group-hover:border-blue-200">
                        View Details
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                    <div className="text-right">
                      <Progress value={overallProgress} className="w-32" />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {goal.subgoals.map((subgoal) => (
                    <Card key={subgoal.id} className="bg-muted/50 hover:bg-muted/70 transition-colors">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base font-semibold leading-tight">
                            {subgoal.code && <span className="text-muted-foreground font-normal mr-1">{subgoal.code}</span>}
                            {subgoal.title}
                          </CardTitle>
                          <Link 
                            to={`/dashboard/goals/${goal.id}/subgoals/${subgoal.id}`}
                            state={{ goal, goals, selectedPlanId }}
                          >
                            <Button variant="ghost" size="sm">
                              <ChevronRight className="w-3 h-3" />
                            </Button>
                          </Link>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Activity className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {subgoal.activityLinks.length} contributing activities
                          </span>
                        </div>
                        {(subgoal.strategicKpi || subgoal.kpi)?.name && (
                          <p className="text-xs text-muted-foreground mt-1">Organisation KPI: {(subgoal.strategicKpi || subgoal.kpi)?.name}</p>
                        )}
                      </CardHeader>
                      <CardContent className="pt-0">
                        {(() => {
                          const kpi = subgoal.strategicKpi || subgoal.kpi;
                          if (!kpi) return null;
                          if (kpi.type === 'radialGauge') return (
                            <div className="flex justify-center">
                              <RadialGauge 
                                value={(kpi.currentValue / (kpi.targetValue || 1)) * 100} 
                                size={100} 
                                unit={kpi.unit} 
                                primaryColor="#3B82F6"
                                max={100}
                              />
                            </div>
                          );
                          if (kpi.type === 'bulletChart') return (
                            <BulletChart
                              current={kpi.currentValue}
                              target={kpi.targetValue}
                              title={subgoal.title}
                              unit={kpi.unit}
                              height={80}
                            />
                          );
                          if (kpi.type === 'progressBar') return (
                            <div className="w-full">
                              <div className="mb-2 text-sm font-medium">
                                {kpi.currentValue.toLocaleString()} / {kpi.targetValue.toLocaleString()} {kpi.unit}
                              </div>
                              <Progress value={(kpi.currentValue / (kpi.targetValue || 1)) * 100} className="h-2" />
                              <div className="mt-1 text-xs text-muted-foreground">
                                {Math.round((kpi.currentValue / (kpi.targetValue || 1)) * 100)}% Complete
                              </div>
                            </div>
                          );
                          return null;
                        })()}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })
        )}
        </TabsContent>

        <TabsContent value="kpis" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-foreground">Organisation-level KPIs</h2>
            <Button variant="outline" size="sm" asChild>
              <Link to="/dashboard/strategic-plan/kpis">Manage KPIs</Link>
            </Button>
          </div>
          {!selectedPlanId ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Gauge className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Select a strategic plan above to view organisation-level KPIs.</p>
              </CardContent>
            </Card>
          ) : planKpis.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Gauge className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No organisation-level KPIs for this plan. Add KPIs in the Manage KPIs page.</p>
                <Button variant="outline" className="mt-4" asChild>
                  <Link to="/dashboard/strategic-plan/kpis">Manage KPIs</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {planKpis.map((kpi) => {
                const current = kpi.currentValue ?? 0;
                const target = kpi.targetValue ?? 1;
                const pct = target ? Math.min(100, Math.round((current / target) * 100)) : 0;
                return (
                  <Card key={kpi.id} className="bg-muted/30">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base font-semibold">
                            {kpi.name || `KPI ${kpi.unit}`}
                          </CardTitle>
                          <CardDescription className="text-sm">
                            {current.toLocaleString()} / {target.toLocaleString()} {kpi.unit}
                          </CardDescription>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => openEditKpi(kpi)}
                          aria-label="Edit KPI"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {kpi.type === 'progressBar' && (
                        <div className="w-full">
                          <Progress value={pct} className="h-2" />
                          <div className="mt-1 text-xs text-muted-foreground">{pct}%</div>
                        </div>
                      )}
                      {kpi.type === 'bulletChart' && (
                        <BulletChart
                          current={current}
                          target={target}
                          title={kpi.name || ''}
                          unit={kpi.unit}
                          height={72}
                        />
                      )}
                      {(kpi.type === 'radialGauge' || !kpi.type) && (
                        <div className="flex justify-center">
                          <RadialGauge
                            value={pct}
                            size={90}
                            unit={kpi.unit}
                            primaryColor="#06b6d4"
                            max={100}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={editingKpiId !== null} onOpenChange={(open) => !open && closeEditKpi()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit organisation-level KPI</DialogTitle>
            <DialogDescription>Update the KPI name, values, unit, and visualization type.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-kpi-name">Display name (optional)</Label>
              <Input
                id="edit-kpi-name"
                value={editKpiForm.name}
                onChange={(e) => setEditKpiForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Number of parents reached"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-kpi-unit">Unit</Label>
              <Input
                id="edit-kpi-unit"
                value={editKpiForm.unit}
                onChange={(e) => setEditKpiForm((f) => ({ ...f, unit: e.target.value }))}
                placeholder="e.g. people, %"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-kpi-current">Current value</Label>
                <Input
                  id="edit-kpi-current"
                  type="number"
                  value={editKpiForm.currentValue}
                  onChange={(e) => setEditKpiForm((f) => ({ ...f, currentValue: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-kpi-target">Target value</Label>
                <Input
                  id="edit-kpi-target"
                  type="number"
                  value={editKpiForm.targetValue}
                  onChange={(e) => setEditKpiForm((f) => ({ ...f, targetValue: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-kpi-type">Visualization type</Label>
              <Select
                value={editKpiForm.type}
                onValueChange={(v) => setEditKpiForm((f) => ({ ...f, type: v }))}
              >
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditKpi} disabled={isSavingKpi}>
              Cancel
            </Button>
            <Button onClick={saveEditKpi} disabled={isSavingKpi}>
              {isSavingKpi ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}