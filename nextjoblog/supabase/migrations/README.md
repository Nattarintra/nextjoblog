`../../supabase-test/migrations/` holds a manual copy of this directory, used by the
short-timebox test project that `e2e/session-expiry.spec.ts` starts via
`supabase start --workdir supabase-test`.

**Drift risk**: nothing enforces this automatically. Whenever a migration is added or
changed here, copy the same change to `../../supabase-test/migrations/`.
