"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { FaqItem } from "@/lib/faq-data";

interface FaqPageProps {
  items: FaqItem[];
}

export default function FaqPage({ items }: FaqPageProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  function toggle(idx: number) {
    setOpenIndex((prev) => (prev === idx ? null : idx));
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Frequently Asked Questions</h1>
        <p className="text-muted-foreground">
          Quick answers to the most common questions about the MCP Security Gateway.
        </p>
      </div>

      <div className="space-y-2">
        {items.map((item, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className="border border-border rounded-lg bg-card overflow-hidden"
            >
              <button
                onClick={() => toggle(idx)}
                className="flex items-center justify-between w-full px-5 py-4 text-left hover:bg-muted/30 transition-colors"
              >
                <span className="text-sm font-medium text-foreground pr-4">
                  {item.question}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {isOpen && (
                <div className="px-5 pb-4 border-t border-border/50">
                  <p className="text-sm text-muted-foreground leading-relaxed pt-3">
                    {item.answer}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
