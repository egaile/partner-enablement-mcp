"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, HelpCircle, BookOpen } from "lucide-react";
import type { DocSection } from "@/lib/docs";

interface DocsSidebarProps {
  sections: DocSection[];
}

export default function DocsSidebar({ sections }: DocsSidebarProps) {
  const pathname = usePathname();
  // Default all sections expanded to avoid SSG/hydration mismatch
  // (usePathname in useState initializer can differ between build and client)
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const section of sections) {
      init[section.slug] = true;
    }
    return init;
  });

  function toggle(slug: string) {
    setExpanded((prev) => ({ ...prev, [slug]: !prev[slug] }));
  }

  return (
    <aside className="w-60 flex-shrink-0 border-r border-border bg-card overflow-y-auto hidden md:block">
      <div className="p-4 border-b border-border/50">
        <Link
          href="/docs"
          className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-cyan-400 transition-colors"
        >
          <BookOpen className="w-4 h-4" />
          Documentation
        </Link>
      </div>

      <nav className="py-2">
        {sections.map((section) => (
          <div key={section.slug}>
            <button
              onClick={() => toggle(section.slug)}
              className="flex items-center justify-between w-full px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground"
            >
              {section.label}
              {expanded[section.slug] ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
            {expanded[section.slug] && (
              <div className="mb-1">
                {section.entries.map((entry) => {
                  const href = `/docs/${entry.slug}`;
                  const active = pathname === href;
                  return (
                    <Link
                      key={entry.slug}
                      href={href}
                      className={`block px-4 py-1.5 pl-7 text-sm transition-colors ${
                        active
                          ? "text-cyan-400 font-medium bg-cyan-500/10 border-r-2 border-cyan-400"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                      }`}
                    >
                      {entry.title}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        <div className="border-t border-border/50 mt-2 pt-2">
          <Link
            href="/docs/faq"
            className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
              pathname === "/docs/faq"
                ? "text-cyan-400 font-medium bg-cyan-500/10 border-r-2 border-cyan-400"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            FAQ
          </Link>
        </div>
      </nav>
    </aside>
  );
}
