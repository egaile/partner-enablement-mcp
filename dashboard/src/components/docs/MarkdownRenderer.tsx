import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { Components } from "react-markdown";
import Link from "next/link";

function rewriteHref(href: string | undefined): string {
  if (!href) return "#";
  // Rewrite relative .md links to /docs/ routes
  if (href.startsWith("./") || href.startsWith("../") || (href.endsWith(".md") && !href.startsWith("http"))) {
    // Strip .md extension and relative prefixes, resolve to /docs/...
    const cleaned = href
      .replace(/^\.\//, "")
      .replace(/^\.\.\//, "")
      .replace(/\.md$/, "")
      .replace(/README$/, "reference");
    return `/docs/${cleaned}`;
  }
  return href;
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-3xl font-bold text-foreground mt-8 mb-4 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-2xl font-semibold text-foreground mt-8 mb-3 pb-2 border-b border-border">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-xl font-semibold text-foreground mt-6 mb-2">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-lg font-medium text-foreground mt-4 mb-2">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="text-muted-foreground leading-relaxed mb-4">{children}</p>
  ),
  a: ({ href, children }) => {
    const rewritten = rewriteHref(href);
    const isExternal = rewritten.startsWith("http");
    if (isExternal) {
      return (
        <a
          href={rewritten}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
        >
          {children}
        </a>
      );
    }
    return (
      <Link href={rewritten} className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2">
        {children}
      </Link>
    );
  },
  ul: ({ children }) => (
    <ul className="list-disc list-inside mb-4 space-y-1 text-muted-foreground">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside mb-4 space-y-1 text-muted-foreground">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-cyan-400 pl-4 py-1 my-4 text-muted-foreground bg-cyan-500/5 rounded-r">
      {children}
    </blockquote>
  ),
  code: ({ className, children, ...props }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-muted text-cyan-400 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className={`${className} text-sm`} {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-[hsl(220,16%,8%)] rounded-lg p-4 mb-4 overflow-x-auto text-sm">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4">
      <table className="min-w-full divide-y divide-border border border-border rounded-lg">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-muted/50">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2 text-sm text-muted-foreground border-t border-border/50">{children}</td>
  ),
  hr: () => <hr className="my-8 border-border" />,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
};

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose-custom max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
