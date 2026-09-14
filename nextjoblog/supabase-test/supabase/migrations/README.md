These migrations are a manual copy of `../../supabase/migrations/`, kept identical
so `supabase-test`'s schema matches the real dev/prod stack that
`e2e/session-expiry.spec.ts`'s short-timebox test exercises.

**Drift risk**: nothing enforces this automatically. Whenever a migration is added or
changed under `../../supabase/migrations/`, copy the same change here.
