/**
 * Express matches routes case-insensitively and ignores a trailing slash, so
 * `/API/Settings/team/` still reaches `/api/settings/team`. Anything that
 * compares request paths itself must normalize the same way.
 */
export function normalizePath(path: string): string {
  const p = path.toLowerCase().replace(/\/{2,}/g, "/").replace(/\/+$/, "");
  return p === "" ? "/" : p;
}
