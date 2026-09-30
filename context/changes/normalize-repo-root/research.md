---
date: 2026-09-28T13:39:27+02:00
researcher: Natta
git_commit: a23c40b6fe005373fb643ef19ad303ad3d7ffeee
branch: chore/normalize-repo-root
repository: nextjoblog
topic: "Research CI and developer tooling for normalize-repo-root"
tags: [research, codebase, ci, github-actions, nextjs, playwright, vitest, supabase, vercel]
status: complete
last_updated: 2026-09-28
last_updated_by: Natta
---

# Research: Research CI and developer tooling for normalize-repo-root

**Date**: 2026-09-28T13:39:27+02:00
**Researcher**: Natta
**Git Commit**: a23c40b6fe005373fb643ef19ad303ad3d7ffeee
**Branch**: chore/normalize-repo-root
**Repository**: nextjoblog

## Research Question

Research CI and developer tooling for `normalize-repo-root`: inspect GitHub Actions, package scripts, lockfiles, Next.js config/docs requirements, Playwright/Vitest/Supabase scripts, README/AGENTS/CLAUDE instructions, and path assumptions. Explain exactly what must change if `nextjoblog` becomes the repository root.

## Summary

The actual Git root is `/Users/natta/Desktop/Nextjs`, while the application and all application tooling are under `/Users/natta/Desktop/Nextjs/nextjoblog` (`git rev-parse --show-toplevel`; current commit `a23c40b6...`). The tracked repository has only two top-level entries: `.github` and `nextjoblog`.

The safest intended migration is to keep the application files in their existing directory, move the Git metadata and `.github` directory into `nextjoblog`, and make `nextjoblog` the new Git root. Under that approach, the only required tracked-file edits are in the workflow:

1. Move `.github/workflows/playwright.yml` to `nextjoblog/.github/workflows/playwright.yml`.
2. Remove `defaults.run.working-directory: nextjoblog` from both jobs, or replace it with `.`.
3. Change both `cache-dependency-path` values from `nextjoblog/package-lock.json` to `package-lock.json`.
4. Change the artifact path from `nextjoblog/playwright-report/` to `playwright-report/`.

No package scripts, lockfile contents, Next.js config, Playwright config, Vitest config, Supabase commands, or application source imports require changes when the physical application directory remains the same. The internal `../` references in Supabase documentation also remain correct in this migration.

The deployment platform is an external follow-up: verify Vercel's Project Settings → General → Root Directory and change it from `nextjoblog` to `.` (or clear the setting) after the repository root changes. There is no committed `vercel.json`; `.vercel` is ignored and only contains local project metadata.

## Detailed Findings

### Repository layout and migration boundary

- `git rev-parse --show-toplevel` returns `/Users/natta/Desktop/Nextjs`; `git ls-tree --name-only HEAD` returns only `.github` and `nextjoblog`.
- The app already has the normal Next.js project shape inside `nextjoblog`: `app/`, `components/`, `lib/`, `public`-equivalent assets, `package.json`, `tsconfig.json`, `next.config.ts`, and tooling configs. Next.js's installed project-structure guide treats `app`, `package.json`, `eslint.config.mjs`, `.gitignore`, and `tsconfig.json` as top-level application files ([`node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md:9-49`](../../node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md)).
- Therefore, “make `nextjoblog` the repository root” should mean changing the Git boundary and workflow location, not adding npm workspaces or restructuring the Next.js application.
- If instead all files are physically flattened into `/Users/natta/Desktop/Nextjs`, that is a different migration. The relative-path consequences are listed in the alternative section below.

### GitHub Actions

The only workflow is `../.github/workflows/playwright.yml` from the current app directory. It has two jobs and is currently intentionally written for an application subdirectory:

- Both jobs set `defaults.run.working-directory: nextjoblog` ([`../.github/workflows/playwright.yml:10-15`](../../../.github/workflows/playwright.yml:10), [`../.github/workflows/playwright.yml:34-41`](../../../.github/workflows/playwright.yml:34)). Remove these defaults after the workflow moves inside `nextjoblog/.github`.
- Both Node setup steps use `cache: npm` and point at `nextjoblog/package-lock.json` ([`../.github/workflows/playwright.yml:21-26`](../../../.github/workflows/playwright.yml:21), [`../.github/workflows/playwright.yml:47-52`](../../../.github/workflows/playwright.yml:47)). Change both paths to `package-lock.json`, relative to the checkout root.
- The unit job installs with `npm ci` and runs `npm run test:run` ([`../.github/workflows/playwright.yml:28-32`](../../../.github/workflows/playwright.yml:28)). No command change is needed once the working directory default is removed.
- The E2E job starts and resets the default local Supabase project, installs Chromium, and runs `npm run test:e2e` ([`../.github/workflows/playwright.yml:54-75`](../../../.github/workflows/playwright.yml:54)). These commands will resolve the same `supabase/`, `package.json`, and `scripts/` directories from the new repository root.
- The artifact upload currently uses `nextjoblog/playwright-report/` ([`../.github/workflows/playwright.yml:77-83`](../../../.github/workflows/playwright.yml:77)). Change it to `playwright-report/`.
- Checkout, Node 22, Supabase CLI 2.117.0, triggers, job timeouts, and artifact retention do not depend on the old root layout ([`../.github/workflows/playwright.yml:3-7`](../../../.github/workflows/playwright.yml:3), [`../.github/workflows/playwright.yml:18-24`](../../../.github/workflows/playwright.yml:18), [`../.github/workflows/playwright.yml:57-63`](../../../.github/workflows/playwright.yml:57)).
- The workflow must remain at the Git repository root under `.github/workflows`; GitHub will not discover a workflow placed at `nextjoblog/.github/workflows` while the Git root remains `Nextjs`. It becomes correct only after the Git root changes to `nextjoblog`.

### Package scripts and lockfile

- `package.json` has standard root-relative scripts: `next dev`, `next build`, `next start`, `eslint`, Vitest, and `node scripts/run-e2e.mjs` ([`package.json:5-13`](../../package.json:5)). None contains `nextjoblog`, `../`, or an explicit working directory.
- The lockfile is npm lockfile version 3 and its root package is `nextjoblog` ([`package-lock.json:1-9`](../../package-lock.json:1)). It has no workspace/package-manager configuration requiring a change when the Git root changes.
- `npm ci` will continue to work from the new root because `package.json` and `package-lock.json` already sit together there ([`package.json:1-4`](../../package.json:1), [`package-lock.json:6-15`](../../package-lock.json:6)). Do not regenerate the lockfile solely because of the repository-boundary move.

### Next.js, agent instructions, and developer documentation

- `next.config.ts` contains only an empty typed config object and no path, output, tracing, or monorepo settings ([`next.config.ts:1-6`](../../next.config.ts:1)). No change is required.
- `AGENTS.md` and `CLAUDE.md` are already at the application directory root. `CLAUDE.md` delegates to `AGENTS.md` ([`CLAUDE.md:1`](../../CLAUDE.md:1)); the Next.js-specific instruction resolves `node_modules/next/dist/docs/` relative to the same directory ([`AGENTS.md:1-9`](../../AGENTS.md:1)). Moving the Git root to this directory makes the instruction more natural and requires no text change.
- The installed Next.js 16.3.4 docs require the usual top-level `package.json`, `app`, config, `.gitignore`, and `tsconfig.json` layout ([`node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md:23-49`](../../node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md)). The existing app already satisfies this layout.
- The installation guide documents the same npm scripts used here ([`node_modules/next/dist/docs/01-app/01-getting-started/01-installation.md:135-156`](../../node_modules/next/dist/docs/01-app/01-getting-started/01-installation.md)). No script rename is needed.
- `README.md` documents `npm run dev`, localhost, the Next.js/Supabase/Tailwind stack, and `supabase/migrations/`, all of which remain valid from the new root ([`README.md:1-16`](../../README.md:1)). It does not mention the old parent repository layout, so no required README edit was found.

### Playwright and E2E

- `playwright.config.ts` uses `testDir: "./e2e"`, a root-relative `webServer.command`, and `npm run dev` ([`playwright.config.ts:3-4`](../../playwright.config.ts:3), [`playwright.config.ts:19-26`](../../playwright.config.ts:19)). Since the config and `e2e/` directory move together with the app, no change is required.
- The config intentionally forces one worker because the suite swaps shared Supabase stacks ([`playwright.config.ts:5-12`](../../playwright.config.ts:5)). The repository-root change does not alter that concurrency constraint.
- `scripts/run-e2e.mjs` invokes `supabase status`, reads the local stack's API URL/keys, and launches `npx playwright test` from the process working directory ([`scripts/run-e2e.mjs:1-29`](../../scripts/run-e2e.mjs:1)). The new root is exactly that process working directory in local use and CI, so no change is required.
- The E2E short-timebox harness uses `supabase start --workdir supabase-test` and `supabase stop --workdir supabase-test` ([`e2e/session-expiry.spec.ts:274-295`](../../e2e/session-expiry.spec.ts:274)). Those paths are relative to the app/project root, not the Git metadata location, so they remain valid when only `.git` and `.github` move.

### Vitest and TypeScript

- Vitest includes `__tests__/**/*.test.{ts,tsx}` and uses `vite-tsconfig-paths()` to read the existing `@/*` alias ([`vitest.config.mts:5-20`](../../vitest.config.mts:5)). No repository-root-specific setting exists.
- `tsconfig.json` maps `@/*` to `./*`, includes the project tree and `.next` generated types, and excludes only `node_modules` ([`tsconfig.json:16-33`](../../tsconfig.json:16)). Because the source tree does not move relative to the config, no change is required.
- ESLint's explicit ignores are root-relative (`.next/**`, `out/**`, `build/**`, `coverage/**`) and remain correct ([`eslint.config.mjs:5-17`](../../eslint.config.mjs:5)).

### Supabase paths and migration mirrors

- The default Supabase CLI project is `supabase/` and the test-only project is `supabase-test/`; the CLI config itself documents paths relative to its `supabase` directory ([`supabase/config.toml:1-5`](../../supabase/config.toml:1), [`supabase/config.toml:58-70`](../../supabase/config.toml:58)). No Git-root reference is involved.
- `supabase/migrations/README.md` points from `supabase/migrations/` up two levels to sibling `supabase-test/` ([`supabase/migrations/README.md:1-6`](../../supabase/migrations/README.md:1)). This remains correct if the app directory stays physically intact.
- `supabase-test/supabase/config.toml` points up two levels to the main `supabase/config.toml`, and its migration README points up three levels to the main migrations ([`supabase-test/supabase/config.toml:1-13`](../../supabase-test/supabase/config.toml:1), [`supabase-test/supabase/migrations/README.md:1-6`](../../supabase-test/supabase/migrations/README.md:1)). These are relative to nested Supabase directories and are likewise unaffected by moving `.git`/`.github`.
- The migration mirror is intentionally manual and has a documented drift risk ([`supabase/migrations/README.md:5-6`](../../supabase/migrations/README.md:5)). The root normalization must not relocate or merge `supabase/` and `supabase-test/`.

### Ignore rules, generated output, and Vercel

- `.gitignore` already ignores root-relative `node_modules`, `.next`, coverage, Playwright reports/results, `.env*`, and `.vercel` ([`.gitignore:3-20`](../../.gitignore:3), [`.gitignore:35-43`](../../.gitignore:35)). Once `nextjoblog` is the Git root, those patterns apply directly to the same generated directories; no edit is required.
- The local `.vercel/project.json` contains only Vercel project/org IDs ([`.vercel/project.json:1`](../../.vercel/project.json:1)), and `.vercel/README.txt` says the directory should not be committed ([`.vercel/README.txt:1-10`](../../.vercel/README.txt:1)). `.vercel` is ignored by `.gitignore`, so it is not part of the tracked migration.
- Vercel's Root Directory is platform configuration, not represented in this repository. Verify it manually: with the normalized repository, the Root Directory should be `.`/empty rather than `nextjoblog`. Also verify the install/build commands still run from the project root and that the production environment variables remain attached to the same project.
- The installed Next.js CI guide describes `.next/cache` as root-relative and shows GitHub cache keys using `**/package-lock.json` ([`node_modules/next/dist/docs/01-app/02-guides/ci-build-caching.md:7-11`](../../node_modules/next/dist/docs/01-app/02-guides/ci-build-caching.md), [`:73-89`](../../node_modules/next/dist/docs/01-app/02-guides/ci-build-caching.md)). The current workflow does not cache `.next/cache`, and this migration does not require adding that optimization.

## Exact Change Checklist

Required for the “move Git root, keep app directory” approach:

- Move `.git` from `Nextjs/.git` to `Nextjs/nextjoblog/.git` only after creating a backup and confirming no other project relies on the parent repository.
- Move `.github/` to `nextjoblog/.github/` so GitHub sees the workflow at the new root.
- Edit `.github/workflows/playwright.yml`: remove both `working-directory: nextjoblog` values, change both cache dependency paths to `package-lock.json`, and change the artifact path to `playwright-report/`.
- Update any local clone/worktree or contributor instructions that assume the Git root is `Nextjs`; no current `README.md`, `AGENTS.md`, or `CLAUDE.md` line requires this update.
- In GitHub, verify the default branch/PR checks still point at the same workflow after the history/path migration. A history rewrite will require coordinated force-push handling and fresh clones/worktrees.
- In Vercel, set Root Directory to `.`/empty and verify one production preview after the repository migration.
- Validate from `nextjoblog`: `npm ci`, `npm run lint`, `npm run test:run`, `npm run build`, and the Supabase-backed E2E flow as environment availability permits.

Not required for this approach:

- No npm workspaces or monorepo configuration.
- No `package.json` script changes.
- No `package-lock.json` regeneration.
- No Next.js, TypeScript, Playwright, Vitest, ESLint, Supabase config, migration, or source-import changes.
- No changes to internal `supabase-test` relative references.

## Alternative: physical flattening into `Nextjs/`

If the intended operation is instead to move the contents of `nextjoblog/` into its parent directory, the following additional edits are required:

- Move every application file/directory, including `package.json`, `package-lock.json`, `app`, `lib`, `scripts`, `supabase`, and `supabase-test`, into `Nextjs/`.
- Move `.github` to the resulting root if it is not already there; in that layout the workflow's old `working-directory: nextjoblog` values still must be removed.
- Update nested Supabase documentation paths because their directory depth changes: `supabase/migrations/README.md` references change from `../../supabase-test` to `../supabase-test`; `supabase-test/supabase/config.toml` references change from `../../supabase` to `../supabase`; and `supabase-test/supabase/migrations/README.md` references change from `../../../supabase/migrations` to `../../supabase/migrations`.
- Update the stale E2E comment at `e2e/session-expiry.spec.ts:275-276` from `../supabase-test/` to `supabase-test/`; the executable `--workdir supabase-test` commands already remain correct.
- Re-check any historical/context documentation that describes the old directory depth. Archived research and plans intentionally record historical paths and should normally not be rewritten; current contributor-facing documentation should be corrected if it is retained.

This physical flattening is more invasive than changing the Git root and is not needed to eliminate the accidental monorepo appearance.

## Historical Context

- `context/archive/2026-09-07-log-in-an-existing-account/research.md:91` records the earlier discovery that the actual repository root was one level above `nextjoblog` and that the workflow intentionally used `working-directory: nextjoblog`.
- `context/archive/2026-09-15-extend-session-via-stay-loggen-in/research.md:119-124` records the same workflow arrangement and the Supabase stack behavior. Those files are historical evidence, not live configuration.
- `context/changes/stay-logged-in-across-browser-sessions/plan.md:206-210` documents why `supabase-test/` is a sibling project and why `--workdir` is used. That architecture should remain unchanged during root normalization.

## Open Questions

- Resolved: Vercel's Root Directory is explicitly set to `nextjoblog` in the project settings. This is correct for the current repository layout. After the repository root migration, clear the setting or change it to `.` before the next deployment.
- Resolved by project owner: this is a solo project, so there are no other contributor clones or worktrees that require coordination. The only GitHub Actions workflow runs unit and E2E tests; it contains no Vercel deployment commands or external deployment calls. Vercel also reports that this project has no Deploy Hooks.
- Resolved by project owner: use the following history-preserving migration sequence to make `nextjoblog/` the Git root, with `.git`, `.github`, `app`, `package.json`, `supabase`, and the remaining application files at that root. The implementation is intentionally deferred until the implementation plan is complete. No migration actions have been performed.
  1. Create a backup of the directory and current Git state.
  2. Check the remote, current branch, and working tree state.
  3. Confirm that there are no uncommitted changes that must be preserved separately.
  4. Rewrite the Git history so the contents of `nextjoblog/` become the repository root.
  5. Include the existing `.github/` directory at the new repository root.
  6. Inspect the rewritten tree, branches, and tags.
  7. Verify that `package.json`, `.github/workflows`, and application source files are in the expected locations.
  8. Update workflow paths for the normalized root.
  9. Run `npm ci`, lint, unit tests, build, and the Supabase-backed E2E flow.
  10. Push the rewritten branch with `--force-with-lease`.
  11. Change Vercel's Root Directory from `nextjoblog` to `.` or clear it.
  12. Trigger and verify a new Vercel deployment and GitHub Actions run.
