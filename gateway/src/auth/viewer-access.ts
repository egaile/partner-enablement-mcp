/**
 * Read-only access for the `viewer` role (the public demo login and new
 * sign-ups). Enforced centrally in `requireAuth`.
 *
 * This is an allowlist: a viewer can only reach the reads listed below, so a
 * new route stays closed to viewers until someone adds it here on purpose.
 * Anything that returns secrets (webhooks, API keys, team emails) or has side
 * effects on GET (OAuth authorize) must not be listed.
 */

import { normalizePath } from "../lib/path.js";

export { normalizePath };

export const VIEWER_ROLE = "viewer";

const VIEWER_ALLOWED_READS: RegExp[] = [
  /^\/api\/me$/,
  /^\/api\/dashboard\/overview$/,
  /^\/api\/servers$/,
  /^\/api\/servers\/[^/]+\/(health|snapshots|oauth\/status)$/,
  /^\/api\/policies$/,
  /^\/api\/audit$/,
  /^\/api\/audit\/metrics$/,
  /^\/api\/alerts$/,
  /^\/api\/approvals$/,
  /^\/api\/billing\/(usage|plans)$/,
  /^\/api\/templates\/atlassian$/,
];

// Non-GET endpoints that don't change anything.
const VIEWER_ALLOWED_WRITES: RegExp[] = [/^\/api\/policies\/simulate$/];

export function isViewerAllowed(method: string, path: string): boolean {
  const p = normalizePath(path);
  const m = method.toUpperCase();
  if (m === "GET" || m === "HEAD") {
    return VIEWER_ALLOWED_READS.some((re) => re.test(p));
  }
  return VIEWER_ALLOWED_WRITES.some((re) => re.test(p));
}

/**
 * Clerk user ids that always get the viewer role, whatever tenant_users says.
 * Reads DEMO_CLERK_USER_IDS, and also DEMO_CLERK_USER_ID (the dashboard's
 * name for the same user) so setting either one is enough.
 */
export function demoUserIds(): Set<string> {
  return new Set(
    [process.env.DEMO_CLERK_USER_IDS, process.env.DEMO_CLERK_USER_ID]
      .join(",")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}
