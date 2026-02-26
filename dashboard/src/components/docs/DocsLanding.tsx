import Link from "next/link";
import { BookOpen, ShieldCheck, Settings2, Code2, HelpCircle } from "lucide-react";
import type { DocSection } from "@/lib/docs";

const sectionIcons: Record<string, React.ReactNode> = {
  guides: <BookOpen className="w-6 h-6 text-blue-500" />,
  admin: <Settings2 className="w-6 h-6 text-purple-500" />,
  security: <ShieldCheck className="w-6 h-6 text-red-500" />,
  api: <Code2 className="w-6 h-6 text-green-500" />,
};

const sectionDescriptions: Record<string, string> = {
  guides: "Step-by-step tutorials to get up and running with the MCP Security Gateway.",
  admin: "Configuration, deployment, and tenant management for administrators.",
  security: "Threat models, injection detection, drift detection, and incident response.",
  api: "Complete reference for the gateway REST API endpoints.",
};

interface DocsLandingProps {
  sections: DocSection[];
}

export default function DocsLanding({ sections }: DocsLandingProps) {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Documentation</h1>
        <p className="text-gray-600 text-lg">
          Everything you need to configure, secure, and operate the MCP Security Gateway.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {sections.map((section) => (
          <Link
            key={section.slug}
            href={`/docs/${section.entries[0]?.slug}`}
            className="group block p-5 bg-white border border-gray-200 rounded-lg hover:border-orange-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">{sectionIcons[section.slug]}</div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 group-hover:text-orange-600 transition-colors">
                  {section.label}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {sectionDescriptions[section.slug]}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  {section.entries.length} {section.entries.length === 1 ? "page" : "pages"}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-3">
          <HelpCircle className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-semibold text-gray-900">Frequently Asked Questions</h2>
        </div>
        <p className="text-sm text-gray-600 mb-3">
          Quick answers to common questions about the gateway, policies, security scanning, and more.
        </p>
        <Link
          href="/docs/faq"
          className="inline-flex items-center text-sm font-medium text-orange-600 hover:text-orange-700"
        >
          Browse FAQ &rarr;
        </Link>
      </div>

      <div className="mt-8 p-4 border border-blue-100 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Start here:</strong>{" "}
          <Link href="/docs/guides/getting-started" className="underline underline-offset-2 hover:text-blue-900">
            Getting Started
          </Link>{" "}
          walks you through your first gateway setup in under 10 minutes.
        </p>
      </div>
    </div>
  );
}
