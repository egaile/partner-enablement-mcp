import { FileCode, Github, Linkedin } from 'lucide-react';
import { LiveDataBadge } from './LiveDataBadge';

export function Header() {
  return (
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
  );
}
