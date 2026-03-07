'use client';

import { useState } from 'react';
import { FileCode, Github, Linkedin, BookOpen, Shield } from 'lucide-react';
import { LiveDataBadge } from './LiveDataBadge';
import { ToolReferencePanel } from './ToolReferencePanel';
import { AuditTrailPanel } from './AuditTrailPanel';
import { getToolStats } from '@/lib/rovo-tools';

interface HeaderProps {
  isRunning?: boolean;
}

export function Header({ isRunning }: HeaderProps) {
  const [showToolPanel, setShowToolPanel] = useState(false);
  const [showAuditPanel, setShowAuditPanel] = useState(false);
  const stats = getToolStats();

  return (
    <>
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-claude-orange to-orange-600 rounded-lg flex items-center justify-center">
                <FileCode className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Partner Enablement MCP</h1>
                <p className="text-xs text-gray-500">GSI Architecture Generator</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowAuditPanel(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-green-400/40 hover:bg-green-50/50 transition-colors text-xs font-medium text-gray-600"
              >
                <Shield className="w-3.5 h-3.5 text-green-600" />
                Audit Trail
              </button>
              <button
                onClick={() => setShowToolPanel(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-claude-orange/40 hover:bg-amber-50/50 transition-colors text-xs font-medium text-gray-600"
              >
                <BookOpen className="w-3.5 h-3.5 text-claude-orange" />
                {stats.total}+ Rovo Tools
              </button>
              <LiveDataBadge className="hidden sm:flex" />
              <div className="flex items-center gap-3 border-l border-gray-200 pl-4">
                <a
                  href="https://github.com/egaile/partner-enablement-mcp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="GitHub"
                >
                  <Github className="w-4 h-4" />
                </a>
                <a
                  href="https://linkedin.com/in/edgaile"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>

      <ToolReferencePanel isOpen={showToolPanel} onClose={() => setShowToolPanel(false)} />
      <AuditTrailPanel isOpen={showAuditPanel} onClose={() => setShowAuditPanel(false)} isRunning={isRunning} />
    </>
  );
}
