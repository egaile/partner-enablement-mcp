'use client';

import { useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';

let mermaidInitialized = false;

export function MermaidDiagram({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        if (!mermaidInitialized) {
          mermaid.initialize({ startOnLoad: false, theme: 'neutral' });
          mermaidInitialized = true;
        }
        const id = `mermaid-${Date.now()}`;
        const { svg: rendered } = await mermaid.render(id, chart);
        const clean = DOMPurify.sanitize(rendered, {
          USE_PROFILES: { svg: true, svgFilters: true, html: true },
          ADD_TAGS: ['foreignObject'],
        });
        if (!cancelled) setSvg(clean);
      } catch {
        if (!cancelled) setSvg('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (!svg) {
    return (
      <pre className="whitespace-pre-wrap text-sm font-mono bg-gray-50 p-4 rounded-lg border border-gray-200">
        {chart}
      </pre>
    );
  }

  return (
    <div
      ref={containerRef}
      className="overflow-auto rounded-xl border border-gray-200 bg-white p-6"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
