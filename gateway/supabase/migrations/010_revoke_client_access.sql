-- Only the gateway talks to this database, with the service_role key (which
-- bypasses RLS). Nothing uses the anon key or Clerk-signed JWTs directly.
--
-- The RLS policies from earlier migrations check tenant membership but not
-- role, so if Supabase were ever set up to trust Clerk sessions, a read-only
-- viewer (for example the public demo login) could write rows directly and
-- skip the gateway's checks. Close that door: clients get no table access.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
-- Functions get EXECUTE through PUBLIC by default, so revoke it there too and
-- give it back to the gateway's role.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
