import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Save, ArrowLeft } from 'lucide-react';
import { strategicPlanApi } from '@/lib/api/strategicPlanApi';
import { useProjects } from '@/contexts/ProjectsContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { Project, Activity } from '@/types/dashboard';

interface SubGoal {
  id: string;
  code?: string;
  title: string;
  description: string;
  activityLinks: ActivityLink[];
}

interface ActivityLink {
  projectId: string;
  projectName: string;
  activityId: string;
  activityTitle: string;
  contribution: number;
  status: 'contributing' | 'at-risk' | 'not-contributing';
  code?: string;
  responsibleCountry?: string;
  timeframeQ1?: boolean;
  timeframeQ2?: boolean;
  timeframeQ3?: boolean;
  timeframeQ4?: boolean;
  annualTarget?: number;
  indicatorText?: string;
  plannedBudget?: number;
  strategicKpiId?: string;
}

interface StrategicGoal {
  id: string;
  code?: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  targetOutcome: string;
  subgoals: SubGoal[];
}

export function StrategicPlanCreate() {
  const navigate = useNavigate();
  const { projects, getProjectActivities } = useProjects();
  const { addNotification } = useNotifications();
  const [goals, setGoals] = useState<StrategicGoal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [endYear, setEndYear] = useState(new Date().getFullYear() + 4);
  const [availableActivities, setAvailableActivities] = useState<Record<string, Activity[]>>({});
  const [planKpis, setPlanKpis] = useState<{ id: string; name?: string; unit: string }[]>([]);

  useEffect(() => {
    const loadKpis = async () => {
      try {
        const activePlan = await strategicPlanApi.getActiveStrategicPlan();
        if (activePlan?.id) {
          const kpiList = await strategicPlanApi.getKpisByPlanId(activePlan.id);
          setPlanKpis(kpiList.map(k => ({ id: k.id, name: k.name, unit: k.unit })));
        } else {
          setPlanKpis([]);
        }
      } catch {
        setPlanKpis([]);
      }
    };
    loadKpis();
  }, []);

  // Load activities for a project
  const loadProjectActivities = async (projectId: string) => {
    if (!availableActivities[projectId]) {
      try {
        const project = projects.find(p => p.id === projectId);
        const projectName = project?.name || 'Selected Project';
        
        addNotification({
          type: 'info',
          title: 'Loading Activities',
          message: `Loading activities for ${projectName}...`,
          duration: 2000,
        });
        
        const activities = await getProjectActivities(projectId);
        setAvailableActivities(prev => ({
          ...prev,
          [projectId]: activities
        }));
        
        addNotification({
          type: 'success',
          title: 'Activities Loaded',
          message: `Loaded ${activities.length} activities for ${projectName}`,
          duration: 3000,
        });
      } catch (error) {
        console.error('Error loading project activities:', error);
        addNotification({
          type: 'error',
          title: 'Failed to Load Activities',
          message: 'Please try selecting the project again.',
          duration: 4000,
        });
      }
    }
  };

  const addGoal = () => {
    const newGoal: StrategicGoal = {
      id: `goal-${Date.now()}`,
      title: '',
      description: '',
      priority: 'medium',
      targetOutcome: '',
      subgoals: []
    };
    setGoals([...goals, newGoal]);
  };

  const updateGoal = (goalId: string, field: keyof StrategicGoal, value: any) => {
    setGoals(goals.map(goal => 
      goal.id === goalId ? { ...goal, [field]: value } : goal
    ));
  };

  const removeGoal = (goalId: string) => {
    setGoals(goals.filter(goal => goal.id !== goalId));
  };

  const addSubGoal = (goalId: string) => {
    const newSubGoal: SubGoal = {
      id: `subgoal-${Date.now()}`,
      title: '',
      description: '',
      activityLinks: []
    };

    setGoals(goals.map(goal => 
      goal.id === goalId 
        ? { ...goal, subgoals: [...goal.subgoals, newSubGoal] }
        : goal
    ));
  };

  const updateSubGoal = (goalId: string, subGoalId: string, field: keyof SubGoal, value: any) => {
    setGoals(goals.map(goal => 
      goal.id === goalId 
        ? {
            ...goal,
            subgoals: goal.subgoals.map(subGoal =>
              subGoal.id === subGoalId ? { ...subGoal, [field]: value } : subGoal
            )
          }
        : goal
    ));
  };

  const removeSubGoal = (goalId: string, subGoalId: string) => {
    setGoals(goals.map(goal => 
      goal.id === goalId 
        ? { ...goal, subgoals: goal.subgoals.filter(subGoal => subGoal.id !== subGoalId) }
        : goal
    ));
  };

  const addActivityLink = (goalId: string, subGoalId: string) => {
    const newActivityLink: ActivityLink = {
      projectId: '',
      projectName: '',
      activityId: '',
      activityTitle: '',
      contribution: 0,
      status: 'contributing',
      timeframeQ1: false,
      timeframeQ2: false,
      timeframeQ3: false,
      timeframeQ4: false
    };

    setGoals(goals.map(goal => 
      goal.id === goalId 
        ? {
            ...goal,
            subgoals: goal.subgoals.map(subGoal =>
              subGoal.id === subGoalId 
                ? { ...subGoal, activityLinks: [...subGoal.activityLinks, newActivityLink] }
                : subGoal
            )
          }
        : goal
    ));
  };

  const updateActivityLink = (goalId: string, subGoalId: string, activityIndex: number, field: keyof ActivityLink, value: any) => {
    setGoals(goals.map(goal => 
      goal.id === goalId 
        ? {
            ...goal,
            subgoals: goal.subgoals.map(subGoal =>
              subGoal.id === subGoalId 
                ? {
                    ...subGoal,
                    activityLinks: subGoal.activityLinks.map((activity, index) => {
                      if (index === activityIndex) {
                        const updatedActivity = { ...activity, [field]: value };
                        
                        // If project is selected, auto-fill project name and load activities
                        if (field === 'projectId' && value) {
                          const selectedProject = projects.find(p => p.id === value);
                          if (selectedProject) {
                            updatedActivity.projectName = selectedProject.name;
                            // Load activities for the selected project
                            loadProjectActivities(value);
                          }
                        }
                        
                        // If activity is selected, auto-fill activity details
                        if (field === 'activityId' && value && activity.projectId) {
                          const projectActivities = availableActivities[activity.projectId] || [];
                          const selectedActivity = projectActivities.find(a => a.id === value);
                          if (selectedActivity) {
                            updatedActivity.activityTitle = selectedActivity.title;
                          }
                        }
                        
                        return updatedActivity;
                      }
                      return activity;
                    })
                  }
                : subGoal
            )
          }
        : goal
    ));
  };

  const removeActivityLink = (goalId: string, subGoalId: string, activityIndex: number) => {
    setGoals(goals.map(goal => 
      goal.id === goalId 
        ? {
            ...goal,
            subgoals: goal.subgoals.map(subGoal =>
              subGoal.id === subGoalId 
                ? {
                    ...subGoal,
                    activityLinks: subGoal.activityLinks.filter((_, index) => index !== activityIndex)
                  }
                : subGoal
            )
          }
        : goal
    ));
  };

  const handleSave = async () => {
    // Validate that we have at least one goal
    if (goals.length === 0) {
      addNotification({
        type: 'error',
        title: 'Cannot Create Empty Strategic Plan',
        message: 'Please add at least one objective before saving.',
        duration: 4000,
      });
      return;
    }

    // Validate that all goals have titles
    const goalsWithoutTitles = goals.filter(goal => !goal.title.trim());
    if (goalsWithoutTitles.length > 0) {
      addNotification({
        type: 'error',
        title: 'Incomplete Objectives',
        message: 'All objectives must have a title.',
        duration: 4000,
      });
      return;
    }

    // Validate that all activity links have both project and activity selected
    const hasIncompleteActivityLinks = goals.some(goal => 
      goal.subgoals.some(subGoal => 
        subGoal.activityLinks.some(activity => 
          !activity.projectId || !activity.activityId
        )
      )
    );

    if (hasIncompleteActivityLinks) {
      addNotification({
        type: 'error',
        title: 'Incomplete Activity Links',
        message: 'All activity links must have both a project and activity selected.',
        duration: 4000,
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await strategicPlanApi.createStrategicPlan(goals, startYear, endYear);
      const planTitle = result?.title || 'Strategic Plan';
      const subgoalCount = goals.reduce((sum, goal) => sum + goal.subgoals.length, 0);
      
      addNotification({
        type: 'success',
        title: `Strategic Plan "${planTitle}" Created Successfully`,
        message: `Created for ${startYear}-${endYear} with ${goals.length} objectives and ${subgoalCount} strategic actions.`,
        duration: 5000,
      });
      navigate('/dashboard');
    } catch (error) {
      console.error('Error saving strategic plan:', error);
      addNotification({
        type: 'error',
        title: 'Failed to Create Strategic Plan',
        message: 'Please check your input and try again.',
        duration: 4000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Create Strategic Plan</h1>
            <p className="text-muted-foreground">Define objectives, strategic actions, and organisation-level KPIs</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isLoading} className="flex items-center space-x-2">
          <Save className="h-4 w-4" />
          <span>{isLoading ? 'Saving...' : 'Save Strategic Plan'}</span>
        </Button>
      </div>

      {/* Year Range Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Strategic Plan Period</CardTitle>
          <CardDescription>Define the start and end years for this strategic plan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-year">Start Year</Label>
              <Input
                id="start-year"
                type="number"
                value={startYear}
                onChange={(e) => setStartYear(Number(e.target.value))}
                min="2020"
                max="2030"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-year">End Year</Label>
              <Input
                id="end-year"
                type="number"
                value={endYear}
                onChange={(e) => setEndYear(Number(e.target.value))}
                min={startYear}
                max="2030"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {goals.map((goal, goalIndex) => (
          <Card key={goal.id} className="border-l-4 border-l-blue-500">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                <Badge variant="outline">Objective {goalIndex + 1}</Badge>
                <CardTitle className="text-xl">Objective</CardTitle>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => removeGoal(goal.id)}
                  className="flex items-center space-x-2"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Remove Objective</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`goal-code-${goal.id}`}>Objective Code (e.g. SO1.1)</Label>
                  <Input
                    id={`goal-code-${goal.id}`}
                    value={goal.code ?? ''}
                    onChange={(e) => updateGoal(goal.id, 'code', e.target.value || undefined)}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`goal-title-${goal.id}`}>Objective title</Label>
                  <Input
                    id={`goal-title-${goal.id}`}
                    value={goal.title}
                    onChange={(e) => updateGoal(goal.id, 'title', e.target.value)}
                    placeholder="Enter objective title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`goal-priority-${goal.id}`}>Priority</Label>
                  <Select value={goal.priority} onValueChange={(value) => updateGoal(goal.id, 'priority', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`goal-description-${goal.id}`}>Description</Label>
                <Textarea
                  id={`goal-description-${goal.id}`}
                  value={goal.description}
                  onChange={(e) => updateGoal(goal.id, 'description', e.target.value)}
                  placeholder="Describe the strategic goal"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                  <Label htmlFor={`goal-outcome-${goal.id}`}>Target outcome</Label>
                <Input
                  id={`goal-outcome-${goal.id}`}
                  value={goal.targetOutcome}
                  onChange={(e) => updateGoal(goal.id, 'targetOutcome', e.target.value)}
                  placeholder="Expected outcome of this goal"
                />
              </div>

              {/* Strategic actions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Strategic actions</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addSubGoal(goal.id)}
                    className="flex items-center space-x-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add strategic action</span>
                  </Button>
                </div>

                {goal.subgoals.map((subGoal, subGoalIndex) => (
                  <Card key={subGoal.id} className="bg-gray-50">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Badge variant="secondary">Strategic action {subGoalIndex + 1}</Badge>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeSubGoal(goal.id, subGoal.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`subgoal-code-${subGoal.id}`}>Action Code (e.g. SA1.1.1)</Label>
                          <Input
                            id={`subgoal-code-${subGoal.id}`}
                            value={subGoal.code ?? ''}
                            onChange={(e) => updateSubGoal(goal.id, subGoal.id, 'code', e.target.value || undefined)}
                            placeholder="Optional"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`subgoal-title-${subGoal.id}`}>Strategic action title</Label>
                          <Input
                            id={`subgoal-title-${subGoal.id}`}
                            value={subGoal.title}
                            onChange={(e) => updateSubGoal(goal.id, subGoal.id, 'title', e.target.value)}
                            placeholder="Enter strategic action title"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`subgoal-description-${subGoal.id}`}>Description</Label>
                        <Textarea
                          id={`subgoal-description-${subGoal.id}`}
                          value={subGoal.description}
                          onChange={(e) => updateSubGoal(goal.id, subGoal.id, 'description', e.target.value)}
                          placeholder="Describe the strategic action"
                          rows={2}
                        />
                      </div>

                      <p className="text-xs text-muted-foreground rounded-lg border bg-muted/20 p-3">
                        Use the <strong>Link to KPI</strong> dropdown when adding activities below to link them to organisation-level KPIs. Manage KPIs in the <strong>KPIs</strong> tab (Strategic Plan menu).
                      </p>

                      {/* Activity Links */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-md font-medium">Linked Activities</h4>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addActivityLink(goal.id, subGoal.id)}
                            className="flex items-center space-x-2"
                          >
                            <Plus className="h-4 w-4" />
                            <span>Add Activity</span>
                          </Button>
                        </div>

                        {subGoal.activityLinks.map((activity, activityIndex) => (
                          <Card key={activityIndex} className="bg-white border">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between mb-4">
                                <Badge variant="outline">Activity {activityIndex + 1}</Badge>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => removeActivityLink(goal.id, subGoal.id, activityIndex)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Project</Label>
                                  <Select
                                    value={activity.projectId}
                                    onValueChange={(value) => updateActivityLink(goal.id, subGoal.id, activityIndex, 'projectId', value)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select a project" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {projects.map((project) => (
                                        <SelectItem key={project.id} value={project.id}>
                                          {project.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label>Project Name</Label>
                                  <Input
                                    value={activity.projectName}
                                    readOnly
                                    placeholder="Auto-filled from project selection"
                                    className="bg-gray-50"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Activity</Label>
                                  <Select
                                    value={activity.activityId}
                                    onValueChange={(value) => updateActivityLink(goal.id, subGoal.id, activityIndex, 'activityId', value)}
                                    disabled={!activity.projectId}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder={activity.projectId ? "Select an activity" : "Select a project first"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {activity.projectId && availableActivities[activity.projectId]?.map((activityItem) => (
                                        <SelectItem key={activityItem.id} value={activityItem.id}>
                                          {activityItem.title}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label>Activity Title</Label>
                                  <Input
                                    value={activity.activityTitle}
                                    readOnly
                                    placeholder="Auto-filled from activity selection"
                                    className="bg-gray-50"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Contribution (%)</Label>
                                  <Input
                                    type="number"
                                    value={activity.contribution}
                                    onChange={(e) => updateActivityLink(goal.id, subGoal.id, activityIndex, 'contribution', Number(e.target.value))}
                                    placeholder="0"
                                    min="0"
                                    max="100"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Status</Label>
                                  <Select 
                                    value={activity.status} 
                                    onValueChange={(value) => updateActivityLink(goal.id, subGoal.id, activityIndex, 'status', value)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="contributing">Contributing</SelectItem>
                                      <SelectItem value="at-risk">At Risk</SelectItem>
                                      <SelectItem value="not-contributing">Not Contributing</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                  <Label>Link to KPI (organisation-level)</Label>
                                  <Select
                                    value={activity.strategicKpiId || '_none'}
                                    onValueChange={(value) => updateActivityLink(goal.id, subGoal.id, activityIndex, 'strategicKpiId', value === '_none' ? undefined : value)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="None" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="_none">None</SelectItem>
                                      {planKpis.map((kpi) => (
                                        <SelectItem key={kpi.id} value={kpi.id}>
                                          {kpi.name || kpi.unit || kpi.id}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {planKpis.length === 0 && (
                                    <p className="text-xs text-muted-foreground">Add KPIs in the KPIs tab (Strategic Plan menu) to link them here.</p>
                                  )}
                                </div>
                              </div>
                              {/* Planned activity details (new structure) */}
                              <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Activity Code (e.g. 1.1.1.1)</Label>
                                  <Input
                                    value={activity.code ?? ''}
                                    onChange={(e) => updateActivityLink(goal.id, subGoal.id, activityIndex, 'code', e.target.value || undefined)}
                                    placeholder="Optional"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Responsible Country</Label>
                                  <Input
                                    value={activity.responsibleCountry ?? ''}
                                    onChange={(e) => updateActivityLink(goal.id, subGoal.id, activityIndex, 'responsibleCountry', e.target.value || undefined)}
                                    placeholder="e.g. Kenya"
                                  />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                  <Label>Timeframe (quarters)</Label>
                                  <div className="flex flex-wrap gap-4">
                                    <div className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`act-q1-${goal.id}-${subGoal.id}-${activityIndex}`}
                                        checked={activity.timeframeQ1 === true}
                                        onCheckedChange={(c) => updateActivityLink(goal.id, subGoal.id, activityIndex, 'timeframeQ1', c === true)}
                                      />
                                      <Label htmlFor={`act-q1-${goal.id}-${subGoal.id}-${activityIndex}`} className="font-normal">Q1</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`act-q2-${goal.id}-${subGoal.id}-${activityIndex}`}
                                        checked={activity.timeframeQ2 === true}
                                        onCheckedChange={(c) => updateActivityLink(goal.id, subGoal.id, activityIndex, 'timeframeQ2', c === true)}
                                      />
                                      <Label htmlFor={`act-q2-${goal.id}-${subGoal.id}-${activityIndex}`} className="font-normal">Q2</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`act-q3-${goal.id}-${subGoal.id}-${activityIndex}`}
                                        checked={activity.timeframeQ3 === true}
                                        onCheckedChange={(c) => updateActivityLink(goal.id, subGoal.id, activityIndex, 'timeframeQ3', c === true)}
                                      />
                                      <Label htmlFor={`act-q3-${goal.id}-${subGoal.id}-${activityIndex}`} className="font-normal">Q3</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`act-q4-${goal.id}-${subGoal.id}-${activityIndex}`}
                                        checked={activity.timeframeQ4 === true}
                                        onCheckedChange={(c) => updateActivityLink(goal.id, subGoal.id, activityIndex, 'timeframeQ4', c === true)}
                                      />
                                      <Label htmlFor={`act-q4-${goal.id}-${subGoal.id}-${activityIndex}`} className="font-normal">Q4</Label>
                                    </div>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label>Annual Target</Label>
                                  <Input
                                    type="number"
                                    value={activity.annualTarget ?? ''}
                                    onChange={(e) => updateActivityLink(goal.id, subGoal.id, activityIndex, 'annualTarget', e.target.value === '' ? undefined : Number(e.target.value))}
                                    placeholder="Numeric target"
                                    min={0}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Planned Budget (inputs and budget)</Label>
                                  <Input
                                    type="number"
                                    value={activity.plannedBudget ?? ''}
                                    onChange={(e) => updateActivityLink(goal.id, subGoal.id, activityIndex, 'plannedBudget', e.target.value === '' ? undefined : Number(e.target.value))}
                                    placeholder="Optional"
                                    min={0}
                                  />
                                </div>
                              {/*   <div className="space-y-2 md:col-span-2">
                                  <Label>Indicator / KPI contribution</Label>
                                  <Textarea
                                    value={activity.indicatorText ?? ''}
                                    onChange={(e) => updateActivityLink(goal.id, subGoal.id, activityIndex, 'indicatorText', e.target.value || undefined)}
                                    placeholder="e.g. # of frontline workforce capacitated to demonstrate knowledge and skills..."
                                    rows={2}
                                  />
                                </div> */}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        <Card className="border-dashed border-2 border-gray-300">
          <CardContent className="p-8 text-center">
            <Button
              variant="outline"
              size="lg"
              onClick={addGoal}
              className="flex items-center space-x-2"
            >
              <Plus className="h-5 w-5" />
              <span>Add Objective</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
