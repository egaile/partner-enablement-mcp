import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DocEntry } from "@/lib/docs";

interface DocPaginationProps {
  prev: DocEntry | null;
  next: DocEntry | null;
}

export default function DocPagination({ prev, next }: DocPaginationProps) {
  if (!prev && !next) return null;

  return (
    <div className="flex items-center justify-between mt-12 pt-6 border-t border-gray-200">
      {prev ? (
        <Link
          href={`/docs/${prev.slug}`}
          className="group flex items-center gap-2 text-sm text-gray-500 hover:text-orange-600 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <div>
            <div className="text-xs text-gray-400 group-hover:text-orange-400">Previous</div>
            <div className="font-medium">{prev.title}</div>
          </div>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          href={`/docs/${next.slug}`}
          className="group flex items-center gap-2 text-sm text-gray-500 hover:text-orange-600 transition-colors text-right"
        >
          <div>
            <div className="text-xs text-gray-400 group-hover:text-orange-400">Next</div>
            <div className="font-medium">{next.title}</div>
          </div>
          <ChevronRight className="w-4 h-4" />
        </Link>
      ) : (
        <div />
      )}
    </div>
  );
}
