# Changelog

All notable changes to this repo. Versions use `MAJOR.MINOR.PATCH.MICRO`.

## [0.1.0.0] - 2026-09-29

### Added
- Anyone can try the hosted dashboard without an account: **Explore the live demo** on the sign-in page opens the demo tenant read-only with one click, no password shared. The dashboard only issues a demo session if the gateway confirms it treats that user as read-only.
- A read-only `viewer` role. Viewers can browse servers, tools, policies, the audit log, alerts and approvals, and run the policy simulator; everything else is refused by the gateway. New sign-ups start as viewers.
- `GET /api/me` (who am I, my role, read-only or not) and `GET /api/demo/viewer-check`.
- The dashboard hides write controls for read-only users, with separate messages for the demo, regular read-only accounts, and permissions that failed to load (with a Retry button).
- Migration 009 adds `mcp_servers.oauth_code_verifier`. Migration 010 revokes all direct database access for Supabase's `anon` and `authenticated` roles.

### Changed
- The hosted gateway connects to HTTP MCP servers only. Stdio servers ran a command inside the shared gateway, so they now need the self-hosted `mcpshield` CLI.
- Only owners and admins can approve or reject held tool calls, and never for a request they made (including through an API key they created). API keys can't decide approvals at all.
- An approval now covers only the exact arguments that were approved, for one hour after the decision. Expired requests can't be approved.
- Server responses list only safe fields: OAuth secrets and stdio command/args are never returned, header and env values are redacted, and URLs lose credentials (viewers see only scheme and host).
- The gateway Docker image builds from the repo root and runs as a non-root user.
- The HIPAA "approval for writes" template now matches real tool names (`create*`, `add*`, `edit*`, `update*`, `delete*`, `transition*`).

### Fixed
- Stripe webhooks verify again: the webhook receives the raw request body.
- Every MCP session is attributed to the caller who opened it, so audit logs, per-user policies, rate limits and approvals name the right user. Another caller can't reuse a session ID.
- Prompt-injection and PII scanning can no longer be stalled by crafted input. Several patterns backtracked quadratically (up to 40 seconds on 200KB); all of them now run in linear time, and Atlassian block macros are matched by a small linear scanner.
- The OAuth callback no longer reflects error text as HTML or echoes the token endpoint's response.
- Self-hosted auth errors return the right status code (403 vs 401).
- The server detail page shows the right creation date.

### Docs
- `CLAUDE.md` rewritten to match the current repo. README, API reference, deployment and admin guides corrected (API key header, dev mode, pipeline order, roles, approvals, demo login).
- Plain-language copy pass across the repo: no em dashes, less filler.
