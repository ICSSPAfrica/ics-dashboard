import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadialGauge } from '@/components/visualizations/RadialGauge';
import { StackedBarChart } from '@/components/visualizations/StackedBarChart';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects } from '@/contexts/ProjectsContext';
import { Outcome } from '@/types/dashboard';

export function KPIAnalytics() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const { getProjectById, getProjectOutcomes, getProjectKPIs, dataRefreshTrigger } = useProjects();
  const [selectedOutcome, setSelectedOutcome] = useState<string | undefined>(undefined);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [allKPIs, setAllKPIs] = useState<any[]>([]);

  if (!user) return null;
  if (!projectId) {
    return <div>No project selected</div>;
  }

  // Get project details for title
  const project = getProjectById(projectId);
  const projectName = project?.name || projectId.toUpperCase();

  // Load project data
  useEffect(() => {
    const loadData = async () => {
      if (projectId && user) {
        try {
          console.log(`🔄 KPIAnalytics: Loading data for project ${projectId} (refresh trigger: ${dataRefreshTrigger})`);
          const [outcomesData, kpisData] = await Promise.all([
            getProjectOutcomes(projectId),
            getProjectKPIs(projectId)
          ]);
          setOutcomes(outcomesData);
          setAllKPIs(kpisData);
          console.log(`✅ KPIAnalytics: Loaded ${outcomesData.length} outcomes, ${kpisData.length} KPIs with calculated values`);
        } catch (error) {
          console.error('Error loading KPI data:', error);
        }
      }
    };

    loadData();
  }, [projectId, user, getProjectOutcomes, getProjectKPIs, dataRefreshTrigger]);

  // Filter KPIs by selected outcome if one is selected  
  const filteredKPIs = selectedOutcome
    ? allKPIs.filter((kpi: any) => kpi.outcomeId === selectedOutcome)
    : allKPIs;

  // Check if current project has KPI data available
  if (!allKPIs || allKPIs.length === 0) {
    return (
      <div className="flex flex-col space-y-8 overflow-x-hidden w-full">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{projectName} KPI Analytics</h1>
          <p className="text-muted-foreground">
            No KPI data available for {projectName} project.
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <p>KPI data is not available for this project yet.</p>
              <p className="text-sm mt-2">
                Available projects with KPI data: MaMeb, VACIS Kenya, VACIS Tanzania, CDW, Kuimarisha, NPPP, AACL
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Group KPIs by outcome
  const groupedKPIs: Record<string, any[]> = {};
  filteredKPIs.forEach((kpi: any) => {
    if (!groupedKPIs[kpi.outcomeId]) {
      groupedKPIs[kpi.outcomeId] = [];
    }
    groupedKPIs[kpi.outcomeId].push(kpi);
  });

  return (
    <div className="flex flex-col space-y-8 overflow-x-hidden w-full">
      {/* Header with outcome filter */}
      <div className="flex flex-col gap-3 mb-4 w-full">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{projectName} KPI Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Key performance indicators for {projectName}, grouped by outcome
          </p>
        </div>
        {outcomes.length > 0 && (
          <select
            className="border rounded px-3 py-2 text-sm w-full md:max-w-xs"
            value={selectedOutcome || ''}
            onChange={e => setSelectedOutcome(e.target.value || undefined)}
          >
            <option value="">All Outcomes</option>
            {outcomes.map((outcome: any) => (
              <option key={outcome.id} value={outcome.id}>{outcome.title}</option>
            ))}
          </select>
        )}
      </div>

      {/* Display KPIs grouped by outcome */}
      {Object.entries(groupedKPIs).map(([outcomeId, kpis]) => {
        const outcome = outcomes.find((o: any) => o.id === outcomeId);
        const outcomeTitle = outcome?.title || outcomeId;
        
        return (
          <Card key={outcomeId} className="transition-all duration-200 hover:shadow-md break-words whitespace-normal w-full max-w-full">
            <CardHeader className="w-full max-w-full">
              <CardTitle className="break-words whitespace-normal w-full max-w-full">{outcomeTitle}</CardTitle>
            </CardHeader>
            <CardContent className="w-full max-w-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 w-full max-w-full">
                {kpis.map((kpi: any, idx: number) => (
                  <Card key={idx} className="bg-muted/50 break-words whitespace-normal w-full max-w-full min-w-0">
                    <CardHeader className="w-full max-w-full min-w-0">
                      <CardTitle className="text-base font-semibold break-words whitespace-normal w-full max-w-full">{kpi.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="break-words whitespace-normal w-full max-w-full min-w-0">
                      {kpi.type === 'radialGauge' && (
                        <RadialGauge value={kpi.current || kpi.value} size={120} unit={kpi.unit} primaryColor="#3B82F6" />
                      )}
                      {kpi.type === 'bar' && (
                        <StackedBarChart
                          data={[
                            { name: kpi.name, Actual: kpi.current || kpi.value, Target: kpi.target }
                          ]}
                          height={120}
                          colors={["#3B82F6", "#E5E7EB"]}
                        />
                      )}
                      {kpi.type === 'progress' && (
                        <div className="w-full max-w-full min-w-0">
                          <div className="mb-2 text-sm font-medium">{kpi.current || kpi.value} / {kpi.target} {kpi.unit}</div>
                          <Progress value={((kpi.current || kpi.value) / kpi.target) * 100} />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Show message if no KPIs for selected outcome */}
      {selectedOutcome && Object.keys(groupedKPIs).length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <p>No KPIs available for the selected outcome.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 