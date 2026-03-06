import { apiClient } from './client';

export interface StrategicKPI {
  id?: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  type: string;
  name?: string;
}

/** Annual target for one plan year */
export interface KpiAnnualTarget {
  year: number;
  targetValue: number;
}

/** Plan-level KPI (managed in KPIs tab) */
export interface PlanKpi {
  id: string;
  name?: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  type: string;
  baseYear?: number | null;
  baseYearValue?: number | null;
  annualTargets?: KpiAnnualTarget[];
}

/** Organisation-wide activity (plan-level, can be linked across the plan) */
export interface StrategicActivity {
  id: string;
  strategicPlanId: string;
  title: string;
  description?: string;
  code?: string;
  order: number;
  timeframeQ1?: boolean;
  timeframeQ2?: boolean;
  timeframeQ3?: boolean;
  timeframeQ4?: boolean;
  annualTarget?: number;
  indicatorText?: string;
  plannedBudget?: number;
  strategicKpiId?: string;
  strategicKpi?: PlanKpi;
}

export interface StrategicActivityLink {
  projectId?: string;
  projectName?: string;
  activityId?: string;
  activityTitle?: string;
  /** When set, this link references an organisation-wide activity */
  strategicActivityId?: string;
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
  strategicKpi?: StrategicKPI & { id: string };
  strategicActivity?: StrategicActivity;
}

export interface StrategicSubGoal {
  id: string;
  code?: string;
  title: string;
  description: string;
  /** @deprecated Use strategicKpi for linked plan-level KPI */
  kpi?: StrategicKPI;
  strategicKpiId?: string;
  strategicKpi?: StrategicKPI & { id: string };
  activityLinks: StrategicActivityLink[];
}

export interface StrategicGoal {
  id: string;
  code?: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  targetOutcome: string;
  strategicKpiId?: string;
  strategicKpi?: StrategicKPI & { id: string };
  subgoals: StrategicSubGoal[];
}

export interface StrategicPlan {
  id: string;
  title: string;
  description?: string;
  version: string;
  startYear: number;
  endYear: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  goals: StrategicGoal[];
  kpis?: PlanKpi[];
  activities?: StrategicActivity[];
}

class StrategicPlanApi {
  private baseUrl = '/strategic-plan';

  async createStrategicPlan(data: StrategicGoal[], startYear?: number, endYear?: number, title?: string, description?: string): Promise<StrategicPlan> {
    // Transform frontend data to backend format
    const transformedGoals = data.map(goal => ({
      ...goal,
      priority: goal.priority.toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW',
      strategicKpiId: goal.strategicKpiId || undefined,
      subgoals: goal.subgoals.map(subGoal => ({
        ...subGoal,
        strategicKpiId: subGoal.strategicKpiId || undefined,
        activityLinks: subGoal.activityLinks.map(activity => ({
          projectId: activity.projectId || undefined,
          projectName: activity.projectName || undefined,
          activityId: activity.activityId || undefined,
          activityTitle: activity.activityTitle || undefined,
          strategicActivityId: activity.strategicActivityId || undefined,
          contribution: activity.contribution,
          status: activity.status.toUpperCase().replace('-', '_') as 'CONTRIBUTING' | 'AT_RISK' | 'NOT_CONTRIBUTING',
          code: activity.code,
          responsibleCountry: activity.responsibleCountry,
          timeframeQ1: activity.timeframeQ1,
          timeframeQ2: activity.timeframeQ2,
          timeframeQ3: activity.timeframeQ3,
          timeframeQ4: activity.timeframeQ4,
          annualTarget: activity.annualTarget,
          indicatorText: activity.indicatorText,
          plannedBudget: activity.plannedBudget,
          strategicKpiId: activity.strategicKpiId || undefined
        }))
      }))
    }));

    const response = await apiClient.post(`${this.baseUrl}/from-frontend`, { 
      goals: transformedGoals, 
      startYear: startYear || new Date().getFullYear(), 
      endYear: endYear || new Date().getFullYear() + 4,
      title: title?.trim() || undefined,
      description: description?.trim() || undefined
    });
    return response.data as StrategicPlan;
  }

  async updateStrategicPlan(id: string, data: StrategicGoal[], startYear?: number, endYear?: number, title?: string, description?: string): Promise<StrategicPlan> {
    // Transform frontend data to backend format
    const transformedGoals = data.map(goal => ({
      ...goal,
      priority: goal.priority.toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW',
      strategicKpiId: goal.strategicKpiId || undefined,
      subgoals: goal.subgoals.map(subGoal => ({
        ...subGoal,
        strategicKpiId: subGoal.strategicKpiId || undefined,
        activityLinks: subGoal.activityLinks.map(activity => ({
          projectId: activity.projectId || undefined,
          projectName: activity.projectName || undefined,
          activityId: activity.activityId || undefined,
          activityTitle: activity.activityTitle || undefined,
          strategicActivityId: activity.strategicActivityId || undefined,
          contribution: activity.contribution,
          status: activity.status.toUpperCase().replace('-', '_') as 'CONTRIBUTING' | 'AT_RISK' | 'NOT_CONTRIBUTING',
          code: activity.code,
          responsibleCountry: activity.responsibleCountry,
          timeframeQ1: activity.timeframeQ1,
          timeframeQ2: activity.timeframeQ2,
          timeframeQ3: activity.timeframeQ3,
          timeframeQ4: activity.timeframeQ4,
          annualTarget: activity.annualTarget,
          indicatorText: activity.indicatorText,
          plannedBudget: activity.plannedBudget,
          strategicKpiId: activity.strategicKpiId || undefined
        }))
      }))
    }));

    const response = await apiClient.patch(`${this.baseUrl}/${id}/from-frontend`, { 
      goals: transformedGoals,
      startYear: startYear || new Date().getFullYear(),
      endYear: endYear || new Date().getFullYear() + 4,
      title: title?.trim() || undefined,
      description: description?.trim() || undefined
    });
    return response.data as StrategicPlan;
  }

  async getStrategicPlans(): Promise<StrategicPlan[]> {
    const response = await apiClient.get(this.baseUrl);
    return response.data as StrategicPlan[];
  }

  async getActiveStrategicPlan(): Promise<StrategicPlan | null> {
    const response = await apiClient.get(`${this.baseUrl}/active`);
    return response.data as StrategicPlan | null;
  }

  async getStrategicPlan(id: string): Promise<StrategicPlan> {
    const response = await apiClient.get(`${this.baseUrl}/${id}`);
    return response.data as StrategicPlan;
  }

  async activateStrategicPlan(id: string): Promise<StrategicPlan> {
    const response = await apiClient.patch(`${this.baseUrl}/${id}/activate`);
    return response.data as StrategicPlan;
  }

  async getStrategicPlansByYearRange(startYear: number, endYear: number): Promise<StrategicPlan[]> {
    const response = await apiClient.get(`${this.baseUrl}/by-year-range?startYear=${startYear}&endYear=${endYear}`);
    return response.data as StrategicPlan[];
  }

  async deleteStrategicPlan(id: string): Promise<void> {
    await apiClient.delete(`${this.baseUrl}/${id}`);
  }

  /** Permanently delete all inactive (deactivated) strategic plans. Returns count purged. */
  async purgeInactivePlans(): Promise<{ purged: number }> {
    const response = await apiClient.delete<{ purged: number }>(`${this.baseUrl}/purge-inactive`);
    if (!response.success) {
      throw new Error(response.error ?? 'Could not purge inactive plans.');
    }
    return (response.data ?? { purged: 0 }) as { purged: number };
  }

  async getKpisByPlanId(planId: string): Promise<PlanKpi[]> {
    const response = await apiClient.get(`${this.baseUrl}/${planId}/kpis`);
    return response.data as PlanKpi[];
  }

  /** Single KPI with plan years (for edit page) */
  async getKpiById(kpiId: string): Promise<PlanKpi & { strategicPlan?: { id: string; title: string; startYear: number; endYear: number } }> {
    const response = await apiClient.get(`${this.baseUrl}/kpis/${kpiId}`);
    return response.data as PlanKpi & { strategicPlan?: { id: string; title: string; startYear: number; endYear: number } };
  }

  async createKpi(planId: string, data: {
    name?: string;
    currentValue: number;
    targetValue: number;
    unit: string;
    type?: string;
    baseYear?: number;
    baseYearValue?: number;
    annualTargets?: KpiAnnualTarget[];
  }): Promise<PlanKpi> {
    const response = await apiClient.post(`${this.baseUrl}/${planId}/kpis`, data);
    return response.data as PlanKpi;
  }

  async updateKpi(kpiId: string, data: {
    name?: string;
    currentValue?: number;
    targetValue?: number;
    unit?: string;
    type?: string;
    baseYear?: number | null;
    baseYearValue?: number | null;
    annualTargets?: KpiAnnualTarget[];
  }): Promise<PlanKpi> {
    const response = await apiClient.patch(`${this.baseUrl}/kpis/${kpiId}`, data);
    return response.data as PlanKpi;
  }

  async deleteKpi(kpiId: string): Promise<void> {
    await apiClient.delete(`${this.baseUrl}/kpis/${kpiId}`);
  }

  async getActivitiesByPlanId(planId: string): Promise<StrategicActivity[]> {
    const response = await apiClient.get(`${this.baseUrl}/${planId}/activities`);
    return response.data as StrategicActivity[];
  }

  async createActivity(planId: string, data: {
    title: string;
    description?: string;
    code?: string;
    timeframeQ1?: boolean;
    timeframeQ2?: boolean;
    timeframeQ3?: boolean;
    timeframeQ4?: boolean;
    annualTarget?: number;
    indicatorText?: string;
    plannedBudget?: number;
    strategicKpiId?: string;
  }): Promise<StrategicActivity> {
    const response = await apiClient.post(`${this.baseUrl}/${planId}/activities`, data);
    return response.data as StrategicActivity;
  }

  async updateActivity(activityId: string, data: {
    title?: string;
    description?: string;
    code?: string;
    timeframeQ1?: boolean;
    timeframeQ2?: boolean;
    timeframeQ3?: boolean;
    timeframeQ4?: boolean;
    annualTarget?: number;
    indicatorText?: string;
    plannedBudget?: number;
    strategicKpiId?: string;
  }): Promise<StrategicActivity> {
    const response = await apiClient.patch(`${this.baseUrl}/activities/${activityId}`, data);
    return response.data as StrategicActivity;
  }

  async deleteActivity(activityId: string): Promise<void> {
    await apiClient.delete(`${this.baseUrl}/activities/${activityId}`);
  }
}

export const strategicPlanApi = new StrategicPlanApi();
