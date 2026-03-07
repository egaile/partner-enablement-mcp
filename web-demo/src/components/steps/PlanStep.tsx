import { Calendar, Users, Target, Layers } from 'lucide-react';
import type { PlanData, Phase, SkillRequirement, JiraTicket } from '@/types/api';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Accordion } from '../ui/Accordion';
import { StepSkeleton } from '../ui/Skeleton';
import { SecurityPipeline } from '../SecurityPipeline';

interface PlanStepProps {
  data: PlanData | null;
  isGenerating: boolean;
  requestParams: Record<string, unknown>;
}

export function PlanStep({
  data,
  isGenerating,
  requestParams,
}: PlanStepProps) {
  if (isGenerating && !data) return <StepSkeleton />;
  if (!data) return null;

  return (
    <div className="space-y-5 animate-fade-in">
      <SecurityPipeline toolName="create_implementation_plan" parameters={requestParams} isGenerating={isGenerating} />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={<Calendar className="w-4 h-4 text-blue-500" />}
          label="Duration"
          value={`${data.summary.totalWeeks} weeks`}
        />
        <StatCard
          icon={<Target className="w-4 h-4 text-purple-500" />}
          label="Sprints"
          value={String(data.summary.totalSprints)}
        />
        <StatCard
          icon={<Users className="w-4 h-4 text-green-500" />}
          label="Team Size"
          value={String(data.summary.teamSize)}
        />
        <StatCard
          icon={<Layers className="w-4 h-4 text-amber-500" />}
          label="Phases"
          value={String(data.summary.phases)}
        />
      </div>

      {/* Phase Timeline */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Phase Timeline</h4>
        <div className="space-y-3">
          {data.phases.map((phase, i) => (
            <PhaseCard key={i} phase={phase} index={i} totalWeeks={data.summary.totalWeeks} />
          ))}
        </div>
      </div>

      {/* Skill Requirements */}
      {data.skillRequirements.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Skill Requirements</h4>
          <div className="grid sm:grid-cols-2 gap-3">
            {data.skillRequirements.map((skill, i) => (
              <SkillCard key={i} skill={skill} />
            ))}
          </div>
        </div>
      )}

      {/* Jira Ticket Templates */}
      {data.jiraTickets && data.jiraTickets.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Jira Ticket Templates</h4>
          <div className="space-y-2">
            {data.jiraTickets.map((ticket, i) => (
              <TicketRow key={i} ticket={ticket} />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="!p-4 text-center">
      <div className="flex justify-center mb-2">{icon}</div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </Card>
  );
}

function PhaseCard({ phase, index, totalWeeks }: { phase: Phase; index: number; totalWeeks: number }) {
  const widthPercent = Math.max(15, (phase.durationWeeks / totalWeeks) * 100);
  const phaseColors = ['bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-green-500'];

  return (
    <Accordion
      title={`${phase.name} (${phase.durationWeeks} weeks)`}
      icon={
        <div className={`w-3 h-3 rounded-full ${phaseColors[index % phaseColors.length]}`} />
      }
    >
      <div className="space-y-3">
        {/* Duration Bar */}
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${phaseColors[index % phaseColors.length]} transition-all duration-500`}
            style={{ width: `${widthPercent}%` }}
          />
        </div>

        <p className="text-sm text-gray-600">{phase.description}</p>

        {phase.milestones.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Milestones</p>
            <ul className="space-y-1">
              {phase.milestones.map((m, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  {m}
                </li>
              ))}
            </ul>
          </div>
        )}

        {phase.riskFactors.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Risk Factors</p>
            <ul className="space-y-1">
              {phase.riskFactors.map((r, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Accordion>
  );
}

function SkillCard({ skill }: { skill: SkillRequirement }) {
  const levelVariant = skill.level === 'required' ? 'red' : 'amber';

  return (
    <Card className="!p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h5 className="font-medium text-gray-900 text-sm">{skill.skill}</h5>
        <Badge variant={levelVariant}>{skill.level}</Badge>
      </div>
      <div className="flex flex-wrap gap-1">
        {skill.roles.map((role) => (
          <Badge key={role} variant="gray">{role}</Badge>
        ))}
      </div>
    </Card>
  );
}

function TicketRow({ ticket }: { ticket: JiraTicket }) {
  const typeVariant = ticket.type === 'epic' ? 'purple' : ticket.type === 'story' ? 'green' : 'blue';

  return (
    <div className="flex items-start gap-3 bg-white rounded-lg border border-gray-200 px-4 py-3">
      <Badge variant={typeVariant}>{ticket.type.toUpperCase()}</Badge>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{ticket.summary}</p>
        <p className="text-xs text-gray-500 mt-0.5">{ticket.description}</p>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex flex-wrap gap-1">
            {ticket.labels.map((l) => (
              <Badge key={l} variant="gray">{l}</Badge>
            ))}
          </div>
          {ticket.estimateHours && (
            <span className="text-xs text-gray-400 ml-auto shrink-0">{ticket.estimateHours}h</span>
          )}
        </div>
      </div>
    </div>
  );
}
