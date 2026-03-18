'use client';

import {
  FolderKanban,
  Globe,
  User,
  Calendar,
  Hash,
  FileText,
  CheckCircle2,
  Mail,
} from 'lucide-react';
import type { PortfolioDiscoveryData } from '@/types/api';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Skeleton, SkeletonCard } from '../ui/Skeleton';
import { SecurityPipeline } from '../SecurityPipeline';

interface PortfolioDiscoveryStepProps {
  data: PortfolioDiscoveryData | null;
  isGenerating: boolean;
  requestParams: Record<string, unknown>;
}

export function PortfolioDiscoveryStep({ data, isGenerating, requestParams }: PortfolioDiscoveryStepProps) {
  if (isGenerating && !data) {
    return (
      <div className="space-y-5 animate-fade-in">
        <SecurityPipeline
          toolName="getVisibleJiraProjects"
          narrativeKey="portfolio_discovery"
          parameters={requestParams}
          isGenerating={isGenerating}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { projects, spaces, user } = data;

  return (
    <div className="space-y-5 animate-fade-in">
      <SecurityPipeline
        toolName="getVisibleJiraProjects"
        narrativeKey="portfolio_discovery"
        parameters={requestParams}
        isGenerating={isGenerating}
      />
      <SecurityPipeline
        toolName="getConfluenceSpaces"
        narrativeKey="portfolio_discovery_spaces"
        parameters={{}}
        isGenerating={false}
      />
      <SecurityPipeline
        toolName="atlassianUserInfo"
        narrativeKey="portfolio_discovery_user"
        parameters={{}}
        isGenerating={false}
      />

      {/* Authenticated User Info */}
      <Card variant="highlighted">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <User className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{user.displayName}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                {user.emailAddress && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Mail className="w-3 h-3 text-gray-400" />
                    {user.emailAddress}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={user.active ? 'green' : 'gray'}>
              {user.active ? 'Active' : 'Inactive'}
            </Badge>
            <Badge variant={data.source === 'gateway' ? 'green' : 'blue'} size="md">
              {data.source === 'gateway' ? 'Live Data' : 'Mock'}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Projects Grid */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <FolderKanban className="w-4 h-4 text-blue-500" />
          <h4 className="text-sm font-semibold text-gray-700">
            Jira Projects ({projects.length})
          </h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {projects.map((project) => (
            <Card key={project.key} padding="sm" className="!p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-start gap-2 min-w-0">
                  <code className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">
                    {project.key}
                  </code>
                  <p className="text-sm font-medium text-gray-900 leading-tight line-clamp-2">
                    {project.name}
                  </p>
                </div>
              </div>
              {project.description && (
                <p className="text-xs text-gray-500 mb-2 line-clamp-2">{project.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-2">
                <span className="flex items-center gap-1">
                  <Hash className="w-3 h-3 text-gray-400" />
                  {project.issueCount} issues
                </span>
                {project.lastActivity && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-gray-400" />
                    {new Date(project.lastActivity).toLocaleDateString()}
                  </span>
                )}
                {project.lead && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3 text-gray-400" />
                    {project.lead}
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Spaces Grid */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-purple-500" />
          <h4 className="text-sm font-semibold text-gray-700">
            Confluence Spaces ({spaces.length})
          </h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {spaces.map((space) => (
            <Card key={space.key} padding="sm" className="!p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-start gap-2 min-w-0">
                  <code className="text-xs font-mono text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded shrink-0">
                    {space.key}
                  </code>
                  <p className="text-sm font-medium text-gray-900 leading-tight line-clamp-2">
                    {space.name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                <FileText className="w-3 h-3 text-gray-400" />
                <span>{space.pageCount} pages</span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Summary */}
      <Card variant="highlighted" className="!p-4">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span className="font-medium text-gray-700">
            {projects.length} projects and {spaces.length} spaces discovered across the enterprise
          </span>
        </div>
      </Card>
    </div>
  );
}
