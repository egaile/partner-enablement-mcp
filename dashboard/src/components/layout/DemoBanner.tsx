"use client";

import { SignOutButton } from "@clerk/nextjs";
import { AlertTriangle, Eye, Lock } from "lucide-react";
import { useViewer } from "@/lib/viewer";

export default function DemoBanner() {
  // Only show once the gateway has answered, not while loading.
  const { me, loaded, retry } = useViewer();

  if (loaded && !me) {
    return (
      <div
        role="alert"
        className="flex items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-sm text-amber-200 lg:px-6"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Couldn&apos;t load your account permissions. Editing is off until
            your permissions load.
          </span>
        </div>
        <button
          type="button"
          onClick={retry}
          className="min-h-9 shrink-0 rounded-md border border-amber-500/40 px-3 py-1.5 text-xs font-medium hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!me?.readOnly) return null;

  if (!me.demo) {
    // A regular read-only account. They keep Clerk's UserButton in the top
    // bar, so there's no sign-out button here.
    return (
      <div className="flex items-center gap-2 border-b border-slate-500/30 bg-slate-500/10 px-4 py-2 text-sm text-slate-200 lg:px-6">
        <Lock className="h-4 w-4 shrink-0" />
        <span>
          Your account is read-only. Ask an owner of this workspace for edit
          access.
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200 lg:px-6">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4 shrink-0" />
        <span>
          You&apos;re viewing a live demo tenant in read-only mode. Browsing
          works; changes are turned off.
        </span>
      </div>
      <SignOutButton redirectUrl="/sign-in">
        <button className="min-h-9 shrink-0 rounded-md border border-cyan-500/40 px-3 py-1.5 text-xs font-medium hover:bg-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
          Exit demo
        </button>
      </SignOutButton>
    </div>
  );
}
