`../../supabase-test/supabase/migrations/` holds a manual copy of this directory, used by the
short-timebox test project that `e2e/session-expiry.spec.ts` starts via
`supabase start --workdir supabase-test`.

**Drift risk**: nothing enforces this automatically. Whenever a migration is added or
changed here, copy the same change to `../../supabase-test/supabase/migrations/`.

The rate-limit migration deliberately keeps its table private. Application callers use
only the constrained `consume_rate_limit` function; direct table access remains revoked
for `anon` and `authenticated`. The function accepts only 64-character lowercase
SHA-256 hex keys, prunes rows idle for more than seven days, and caps active rows at
10,000 per scope. Monitor capacity errors and row counts by scope as traffic grows.
