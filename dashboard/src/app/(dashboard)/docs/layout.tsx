import { getDocSections } from "@/lib/docs";
import DocsSidebar from "@/components/docs/DocsSidebar";
import "highlight.js/styles/github-dark.css";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const sections = getDocSections();

  return (
    <div className="flex -m-4 lg:-m-6 min-h-[calc(100vh-3.5rem)]">
      <DocsSidebar sections={sections} />
      <div className="flex-1 overflow-y-auto p-6 lg:p-8">
        {children}
      </div>
    </div>
  );
}
