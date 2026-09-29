import { Eye } from "lucide-react";
import type { ReadOnlyReason } from "@/lib/viewer";

/**
 * Opening sentence for a read-only notice, worded for why editing is off.
 * `action` finishes "you can't ...", e.g. "add servers".
 */
export function readOnlyMessage(reason: ReadOnlyReason, action: string): string {
  switch (reason) {
    case "demo":
      return `This is a read-only demo, so you can't ${action}.`;
    case "account":
      return `Your account is read-only, so you can't ${action}. Ask an owner of this workspace for edit access.`;
    default:
      return "Editing is off until your permissions load.";
  }
}

/** Short hint for a disabled control (title text or screen reader description). */
export function readOnlyControlHint(reason: ReadOnlyReason): string {
  switch (reason) {
    case "demo":
      return "Read-only demo: you can't change this setting.";
    case "account":
      return "Your account is read-only, so you can't change this setting.";
    default:
      return "Editing is off until your permissions load.";
  }
}

/** Shown in place of a write-only page (create forms, onboarding) for read-only users. */
export default function ReadOnlyNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-5 text-sm text-cyan-200">
      <Eye className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
