'use client';

import {
  MessageSquare,
  MessageCircle,
  AlertCircle,
  CheckCircle2,
  FileText,
  User,
  Calendar,
  Reply,
} from 'lucide-react';
import type { CommentAuditData, CommentInfo } from '@/types/api';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { StepSkeleton } from '../ui/Skeleton';
import { SecurityPipeline } from '../SecurityPipeline';

interface CommentAuditStepProps {
  data: CommentAuditData | null;
  isGenerating: boolean;
  requestParams: Record<string, unknown>;
}

export function CommentAuditStep({ data, isGenerating, requestParams }: CommentAuditStepProps) {
  if (isGenerating && !data) {
    return (
      <div className="space-y-5 animate-fade-in">
        <SecurityPipeline
          toolName="comment_activity_audit"
          parameters={requestParams}
          isGenerating={isGenerating}
        />
        <StepSkeleton />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-5 animate-fade-in">
      <SecurityPipeline
        toolName="getConfluencePageComments"
        parameters={requestParams}
        isGenerating={isGenerating}
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricTile
          icon={<MessageSquare className="w-4 h-4 text-blue-500" />}
          label="Total Comments"
          value={data.totalComments}
        />
        <MetricTile
          icon={<AlertCircle className="w-4 h-4 text-amber-500" />}
          label="Unresolved Inline"
          value={data.unresolvedInline}
          alert={data.unresolvedInline > 0}
        />
        <MetricTile
          icon={<FileText className="w-4 h-4 text-green-500" />}
          label="Pages with Comments"
          value={data.pagesWithComments}
        />
        <MetricTile
          icon={<FileText className="w-4 h-4 text-gray-400" />}
          label="Pages without"
          value={data.pagesWithoutComments}
          alert={data.pagesWithoutComments > data.pagesWithComments}
        />
      </div>

      {/* Footer Comments Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-blue-500" />
          <h4 className="text-sm font-semibold text-gray-700">
            Footer Comments ({data.footerComments.length})
          </h4>
        </div>
        {data.footerComments.length === 0 ? (
          <p className="text-sm text-gray-400 italic pl-6">No footer comments found</p>
        ) : (
          <div className="space-y-2">
            {data.footerComments.map((comment) => (
              <CommentCard key={comment.id} comment={comment} />
            ))}
          </div>
        )}
      </div>

      {/* Inline Comments Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="w-4 h-4 text-purple-500" />
          <h4 className="text-sm font-semibold text-gray-700">
            Inline Comments ({data.inlineComments.length})
          </h4>
          {data.unresolvedInline > 0 && (
            <Badge variant="amber">{data.unresolvedInline} unresolved</Badge>
          )}
        </div>
        {data.inlineComments.length === 0 ? (
          <p className="text-sm text-gray-400 italic pl-6">No inline comments found</p>
        ) : (
          <div className="space-y-2">
            {data.inlineComments.map((comment) => (
              <CommentCard key={comment.id} comment={comment} showResolved />
            ))}
          </div>
        )}
      </div>

      {/* Source badge */}
      <Card variant="highlighted" className="!p-3">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Badge variant={data.source === 'gateway' ? 'green' : 'blue'}>
            {data.source === 'gateway' ? 'Live Data' : 'Mock Data'}
          </Badge>
          <span>
            Comments fetched via{' '}
            <code className="font-mono text-purple-600">getConfluencePageFooterComments</code> and{' '}
            <code className="font-mono text-purple-600">getConfluencePageInlineComments</code>
          </span>
        </div>
      </Card>
    </div>
  );
}

function CommentCard({
  comment,
  showResolved,
}: {
  comment: CommentInfo;
  showResolved?: boolean;
}) {
  const bodySnippet = comment.body.length > 200 ? comment.body.slice(0, 200) + '...' : comment.body;

  return (
    <Card padding="sm" className="!p-4">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            comment.type === 'inline' ? 'bg-purple-100' : 'bg-blue-100'
          }`}
        >
          {comment.type === 'inline' ? (
            <MessageCircle className="w-4 h-4 text-purple-500" />
          ) : (
            <MessageSquare className="w-4 h-4 text-blue-500" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1 text-sm font-medium text-gray-900">
                  <User className="w-3 h-3 text-gray-400" />
                  {comment.author}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Calendar className="w-3 h-3" />
                  {new Date(comment.created).toLocaleDateString()}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                on <span className="font-medium text-gray-700">{comment.pageTitle}</span>
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {showResolved && comment.resolved !== undefined && (
                comment.resolved ? (
                  <Badge variant="green">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Resolved
                    </span>
                  </Badge>
                ) : (
                  <Badge variant="amber">
                    <span className="flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Open
                    </span>
                  </Badge>
                )
              )}
              {comment.replyCount !== undefined && comment.replyCount > 0 && (
                <Badge variant="gray">
                  <span className="flex items-center gap-1">
                    <Reply className="w-3 h-3" /> {comment.replyCount}
                  </span>
                </Badge>
              )}
            </div>
          </div>

          {/* Body snippet */}
          <div className="mt-2 bg-gray-50 rounded-md px-3 py-2">
            <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap line-clamp-3">
              {bodySnippet}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function MetricTile({
  icon,
  label,
  value,
  alert,
}: {
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
