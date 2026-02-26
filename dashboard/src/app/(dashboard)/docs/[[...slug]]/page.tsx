import { notFound } from "next/navigation";
import { getDocSections, getDocContent, getDocBySlug, getDocPagination } from "@/lib/docs";
import DocsLanding from "@/components/docs/DocsLanding";
import FaqPage from "@/components/docs/FaqPage";
import MarkdownRenderer from "@/components/docs/MarkdownRenderer";
import DocPagination from "@/components/docs/DocPagination";
import { faqData } from "@/lib/faq-data";

// Dynamic rendering (not SSG) — matches the rest of the authenticated dashboard
// and avoids hydration mismatches from Clerk auth in the parent layout
export const dynamic = "force-dynamic";

interface DocsPageProps {
  params: { slug?: string[] };
}

export default function DocsPage({ params }: DocsPageProps) {
  const slug = params.slug;

  // Landing page: /docs
  if (!slug || slug.length === 0) {
    const sections = getDocSections();
    return <DocsLanding sections={sections} />;
  }

  // FAQ page: /docs/faq
  const joined = slug.join("/");
  if (joined === "faq") {
    return <FaqPage items={faqData} />;
  }

  // Doc page: /docs/guides/getting-started, etc.
  const entry = getDocBySlug(joined);
  if (!entry) {
    notFound();
  }

  const content = getDocContent(joined);
  if (!content) {
    notFound();
  }

  const { prev, next } = getDocPagination(joined);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-2">
        <span className="text-xs font-medium text-orange-600 uppercase tracking-wider">
          {entry.section}
        </span>
      </div>
      <MarkdownRenderer content={content} />
      <DocPagination prev={prev} next={next} />
    </div>
  );
}
