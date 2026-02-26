import fs from "fs";
import path from "path";

export interface DocEntry {
  slug: string;
  title: string;
  section: string;
  filePath: string;
}

export interface DocSection {
  label: string;
  slug: string;
  entries: DocEntry[];
}

const DOCS_DIR = path.join(process.cwd(), "content", "docs");

/**
 * Static manifest — controls ordering, display names, and section grouping.
 */
const manifest: { section: string; sectionSlug: string; pages: { slug: string; title: string; file: string }[] }[] = [
  {
    section: "Guides",
    sectionSlug: "guides",
    pages: [
      { slug: "guides/getting-started", title: "Getting Started", file: "guides/getting-started.md" },
      { slug: "guides/connecting-servers", title: "Connecting Servers", file: "guides/connecting-servers.md" },
      { slug: "guides/policy-rules", title: "Policy Rules", file: "guides/policy-rules.md" },
      { slug: "guides/dashboard-walkthrough", title: "Dashboard Walkthrough", file: "guides/dashboard-walkthrough.md" },
      { slug: "guides/troubleshooting", title: "Troubleshooting", file: "guides/troubleshooting.md" },
    ],
  },
  {
    section: "Admin",
    sectionSlug: "admin",
    pages: [
      { slug: "admin/configuration", title: "Configuration", file: "admin/configuration.md" },
      { slug: "admin/deployment", title: "Deployment", file: "admin/deployment.md" },
      { slug: "admin/tenant-management", title: "Tenant Management", file: "admin/tenant-management.md" },
    ],
  },
  {
    section: "Security",
    sectionSlug: "security",
    pages: [
      { slug: "security/threat-model", title: "Threat Model", file: "security/threat-model.md" },
      { slug: "security/injection-detection", title: "Injection Detection", file: "security/injection-detection.md" },
      { slug: "security/drift-detection", title: "Drift Detection", file: "security/drift-detection.md" },
      { slug: "security/incident-response", title: "Incident Response", file: "security/incident-response.md" },
    ],
  },
  {
    section: "API",
    sectionSlug: "api",
    pages: [
      { slug: "api/reference", title: "API Reference", file: "api/README.md" },
    ],
  },
];

/** Flat list of all doc entries in manifest order. */
export function getAllDocs(): DocEntry[] {
  return manifest.flatMap((section) =>
    section.pages.map((page) => ({
      slug: page.slug,
      title: page.title,
      section: section.section,
      filePath: page.file,
    }))
  );
}

/** Get grouped sections for sidebar rendering. */
export function getDocSections(): DocSection[] {
  return manifest.map((s) => ({
    label: s.section,
    slug: s.sectionSlug,
    entries: s.pages.map((p) => ({
      slug: p.slug,
      title: p.title,
      section: s.section,
      filePath: p.file,
    })),
  }));
}

/** Read the raw markdown content for a given slug. Returns null if not found. */
export function getDocContent(slug: string): string | null {
  const entry = getAllDocs().find((d) => d.slug === slug);
  if (!entry) return null;
  const fullPath = path.join(DOCS_DIR, entry.filePath);
  try {
    return fs.readFileSync(fullPath, "utf-8");
  } catch {
    return null;
  }
}

/** Find a doc entry by slug. */
export function getDocBySlug(slug: string): DocEntry | undefined {
  return getAllDocs().find((d) => d.slug === slug);
}

/** Get previous and next docs for pagination. */
export function getDocPagination(slug: string): { prev: DocEntry | null; next: DocEntry | null } {
  const docs = getAllDocs();
  const idx = docs.findIndex((d) => d.slug === slug);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? docs[idx - 1] : null,
    next: idx < docs.length - 1 ? docs[idx + 1] : null,
  };
}
