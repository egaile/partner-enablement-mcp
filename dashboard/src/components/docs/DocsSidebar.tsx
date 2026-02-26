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
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    // Default: expand the section that contains the current page
    const init: Record<string, boolean> = {};
    for (const section of sections) {
      const isActive = section.entries.some((e) => pathname === `/docs/${e.slug}`);
      init[section.slug] = isActive || section.slug === "guides";
    }
    return init;
  });

  function toggle(slug: string) {
    setExpanded((prev) => ({ ...prev, [slug]: !prev[slug] }));
  }

  return (
    <aside className="w-60 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto hidden md:block">
      <div className="p-4 border-b border-gray-100">
        <Link
          href="/docs"
          className="flex items-center gap-2 text-sm font-semibold text-gray-900 hover:text-orange-600 transition-colors"
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
              className="flex items-center justify-between w-full px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700"
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
                          ? "text-orange-600 font-medium bg-orange-50 border-r-2 border-orange-400"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
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

        <div className="border-t border-gray-100 mt-2 pt-2">
          <Link
            href="/docs/faq"
            className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
              pathname === "/docs/faq"
                ? "text-orange-600 font-medium bg-orange-50 border-r-2 border-orange-400"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
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
