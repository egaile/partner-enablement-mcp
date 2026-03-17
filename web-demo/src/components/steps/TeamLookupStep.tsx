'use client';

import { Search, Users } from 'lucide-react';
import type { TeamLookupData, TeamMember } from '@/types/api';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { StepSkeleton } from '../ui/Skeleton';
import { SecurityPipeline } from '../SecurityPipeline';

interface TeamLookupStepProps {
  data: TeamLookupData | null;
  isGenerating: boolean;
  requestParams: Record<string, unknown>;
}

export function TeamLookupStep({ data, isGenerating, requestParams }: TeamLookupStepProps) {
  if (isGenerating && !data) {
    return (
      <div className="space-y-5 animate-fade-in">
        <SecurityPipeline
          toolName="team_lookup"
          parameters={requestParams}
          isGenerating={isGenerating}
        />
        <StepSkeleton />
      </div>
    );
  }

  if (!data) return null;

  const activeCount = data.members.filter((m) => m.active).length;
  const inactiveCount = data.members.length - activeCount;

  return (
    <div className="space-y-5 animate-fade-in">
      <SecurityPipeline
        toolName="team_lookup"
        parameters={requestParams}
        isGenerating={isGenerating}
      />

      {/* Search Query Display */}
      <Card variant="highlighted" className="flex items-center gap-3">
        <Search className="w-4 h-4 text-claude-orange shrink-0" />
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Search Query
          </p>
          <code className="text-sm font-mono text-gray-900">{data.searchQuery}</code>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant={data.source === 'gateway' ? 'green' : 'gray'}>
            {data.source === 'gateway' ? 'Live' : 'Mock'}
          </Badge>
          <div className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-600">
              {data.members.length} result{data.members.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </Card>

      {/* Team Member Grid */}
      {data.members.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">Team Members</h4>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{activeCount} active</span>
              {inactiveCount > 0 && (
                <>
                  <div className="h-3 w-px bg-gray-300" />
                  <span>{inactiveCount} inactive</span>
                </>
              )}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {data.members.map((member) => (
              <TeamMemberCard key={member.accountId} member={member} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {data.members.length === 0 && (
        <Card className="text-center !py-8">
          <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No team members found for this query.</p>
        </Card>
      )}

      {/* Tool indicator */}
      <p className="text-[10px] text-gray-400 font-mono text-right">
        Fetched via lookupJiraAccountId
      </p>
    </div>
  );
}

function TeamMemberCard({ member }: { member: TeamMember }) {
  const initials = member.displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Card padding="sm" className="!p-3">
      <div className="flex items-center gap-3">
        {/* Avatar placeholder */}
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold ${
            member.active
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-400'
          }`}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900 truncate">
              {member.displayName}
            </p>
            <Badge variant={member.active ? 'green' : 'gray'} size="sm">
              {member.active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          {member.emailAddress && (
            <p className="text-xs text-gray-500 truncate">{member.emailAddress}</p>
          )}
          <p className="text-[10px] font-mono text-gray-400 truncate" title={member.accountId}>
            {member.accountId}
          </p>
        </div>
      </div>
    </Card>
  );
}
