import { Activity, AlertTriangle, Clock, Ban } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { StepSkeleton } from '../ui/Skeleton';
import { ToolNarrative } from '../ToolNarrative';

export interface HealthData {
  readinessScore: number;
  statusBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
  openCount: number;
  highPriorityCount: number;
  overdueCount: number;
  blockedCount: number;
  riskFlags: string[];
}

interface HealthStepProps {
  data: HealthData | null;
  isGenerating: boolean;
  requestParams: Record<string, unknown>;
}

function scoreColor(score: number): string {
  if (score >= 75) return 'text-green-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-600';
}

function scoreBg(score: number): string {
  if (score >= 75) return 'bg-green-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

function scoreLabel(score: number): string {
  if (score >= 75) return 'On Track';
  if (score >= 50) return 'At Risk';
  return 'Critical';
}

export function HealthStep({ data, isGenerating, requestParams }: HealthStepProps) {
  if (isGenerating && !data) return <StepSkeleton />;
  if (!data) return null;

  const statusEntries = Object.entries(data.statusBreakdown).sort((a, b) => b[1] - a[1]);
  const priorityEntries = Object.entries(data.priorityBreakdown).sort((a, b) => b[1] - a[1]);
  const totalForBar = statusEntries.reduce((sum, [, v]) => sum + v, 0) || 1;

  const statusColors: Record<string, string> = {
    'To Do': 'bg-gray-400',
    'In Progress': 'bg-blue-500',
    'In Review': 'bg-purple-500',
    'Blocked': 'bg-red-500',
    'Done': 'bg-green-500',
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <ToolNarrative toolName="project_health" parameters={requestParams} />

      {/* Readiness Score */}
      <Card variant="highlighted" className="text-center !py-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Project Readiness Score
        </p>
        <div className="flex items-center justify-center gap-3">
          <span className={`text-5xl font-bold ${scoreColor(data.readinessScore)}`}>
            {data.readinessScore}
          </span>
          <div className="text-left">
            <Badge variant={data.readinessScore >= 75 ? 'green' : data.readinessScore >= 50 ? 'amber' : 'red'} size="md">
              {scoreLabel(data.readinessScore)}
            </Badge>
            <p className="text-xs text-gray-500 mt-0.5">out of 100</p>
          </div>
        </div>
      </Card>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricTile
          icon={<Activity className="w-4 h-4 text-blue-500" />}
          label="Open Issues"
          value={data.openCount}
        />
        <MetricTile
          icon={<AlertTriangle className="w-4 h-4 text-orange-500" />}
          label="High Priority"
          value={data.highPriorityCount}
          alert={data.highPriorityCount > 0}
        />
        <MetricTile
          icon={<Clock className="w-4 h-4 text-red-500" />}
          label="Overdue"
          value={data.overdueCount}
          alert={data.overdueCount > 0}
        />
        <MetricTile
          icon={<Ban className="w-4 h-4 text-red-600" />}
          label="Blocked"
          value={data.blockedCount}
          alert={data.blockedCount > 0}
        />
      </div>

      {/* Status Breakdown Bar */}
      {statusEntries.length > 0 && (
        <Card padding="sm" className="!p-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Status Breakdown
          </h4>
          <div className="h-3 rounded-full overflow-hidden flex bg-gray-100">
            {statusEntries.map(([status, count]) => (
              <div
                key={status}
                className={`${statusColors[status] || 'bg-gray-300'} transition-all`}
                style={{ width: `${(count / totalForBar) * 100}%` }}
                title={`${status}: ${count}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            {statusEntries.map(([status, count]) => (
              <div key={status} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className={`w-2 h-2 rounded-full ${statusColors[status] || 'bg-gray-300'}`} />
                {status}: {count}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Priority Breakdown */}
      {priorityEntries.length > 0 && (
        <Card padding="sm" className="!p-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Priority Distribution
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {priorityEntries.map(([priority, count]) => {
              const variant =
                priority === 'Critical' || priority === 'Highest' ? 'red' :
                priority === 'High' ? 'orange' :
                priority === 'Medium' ? 'amber' : 'gray';
              return (
                <div key={priority} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <Badge variant={variant}>{priority}</Badge>
                  <span className="text-sm font-semibold text-gray-700">{count}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Risk Flags */}
      {data.riskFlags.length > 0 && (
        <Card padding="sm" className="!p-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Risk Flags
          </h4>
          <ul className="space-y-2">
            {data.riskFlags.map((flag, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                {flag}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function MetricTile({ icon, label, value, alert }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  alert?: boolean;
}) {
  return (
    <Card className={`!p-4 text-center ${alert ? 'border-amber-200 bg-amber-50/30' : ''}`}>
      <div className="flex justify-center mb-2">{icon}</div>
      <p className={`text-2xl font-bold ${alert ? 'text-amber-700' : 'text-gray-900'}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </Card>
  );
}
