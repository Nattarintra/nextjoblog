# Normalize Repo Root Implementation Plan

## Overview

The tracked Git repository root is currently `/Users/natta/Desktop/Nextjs`, one level above the actual Next.js application at `/Users/natta/Desktop/Nextjs/nextjoblog`. This plan rewrites Git history so `nextjoblog/` becomes the repository root — eliminating the accidental-monorepo layout — and updates the one CI workflow and the Vercel platform setting that depend on the old boundary. Application source, configs, and test files do not move or change; only Git metadata, `.github/`, and the workflow's path references change.

## Current State Analysis

- `git rev-parse --show-toplevel` resolves to `/Users/natta/Desktop/Nextjs`; the tracked tree has exactly two top-level entries: `.github/` and `nextjoblog/`.
- `main`, `dev`, and `chore/normalize-repo-root` all point at the same commit (`a23c40b`). The five other remote branches (`feat/extend-session-via-stay-logged-in`, `feat/log-in-to-an-existing-account`, `feat/sign-up-a-new-account`, `feat/stay-logged-in-access-browser-session`, `fix/signup-and-login-fail-in-production`) are already merged into `main` and are stale.
- No Git tags exist. The remote is `git@github.com:Nattarintra/nextjoblog.git`.
- `.github/workflows/playwright.yml` hardcodes the old boundary: `working-directory: nextjoblog` (both jobs), `cache-dependency-path: nextjoblog/package-lock.json` (both jobs), and artifact `path: nextjoblog/playwright-report/`.
- Vitest is already configured with 80% coverage thresholds (`vitest.config.mts`: lines/statements/functions/branches all at 80) — this migration does not touch test code or that config; it only needs to verify the thresholds still pass after the move.
- No `git-filter-repo` is installed locally; only stock Git is available.
- Per `context/changes/normalize-repo-root/research.md`, no `package.json`, lockfile, `next.config.ts`, `playwright.config.ts`, `vitest.config.mts`, `tsconfig.json`, `eslint.config.mjs`, or Supabase path/config changes are required — the application directory stays physically intact.

## Desired End State

`/Users/natta/Desktop/Nextjs/nextjoblog/.git` is the repository root. `git rev-parse --show-toplevel` from inside `nextjoblog/` returns that same path. `nextjoblog/.github/workflows/playwright.yml` exists with corrected paths, and GitHub Actions runs it successfully from the checkout root. Vercel's Root Directory is `.` (or cleared) and a deployment succeeds. `main`, `dev`, and `chore/normalize-repo-root` all carry the rewritten history; the five stale branches are deleted from origin. The pre-migration state is fully recoverable from a local mirror backup.

### Key Discoveries:

- `git filter-branch --subdirectory-filter nextjoblog -- --all` promotes `nextjoblog/`'s content and full commit history to root, but by design **drops everything outside `nextjoblog/`** from the rewritten history — including `.github/`. There is no way to make `--subdirectory-filter` keep two differently-named top-level directories at once.
- Because `.github/` currently contains only one file (`workflows/playwright.yml`) with no history worth preserving on its own, the correct handling is: let `--subdirectory-filter` drop it, then re-add `.github/workflows/playwright.yml` as a single new commit on top of the rewritten history — with the path fixes already applied. This is simpler and safer than a custom `--index-filter` script.
- All three branches that need rewriting (`main`, `dev`, `chore/normalize-repo-root`) are at the identical commit, so the filter only needs to run once per branch ref but the underlying history graph is shared — `git filter-branch ... -- --all` rewrites them together in one pass.
- `git filter-branch` writes `refs/original/*` backup refs and leaves the old objects reachable until expired; these must be cleaned up (`git update-ref -d`, `reflog expire --expire=now --all`, `git gc --prune=now`) or the "removed" `.github`-inclusive history stays recoverable locally (harmless, but should be intentional, not accidental).

## What We're NOT Doing

- Not flattening `nextjoblog/`'s contents up into the parent `Nextjs/` directory (the alternative migration research.md describes but the project owner did not choose).
- Not converting to npm workspaces or any monorepo tooling.
- Not changing `package.json` scripts, `package-lock.json`, `next.config.ts`, `playwright.config.ts`, `vitest.config.mts`, `tsconfig.json`, `eslint.config.mjs`, or any Supabase config/migration paths.
- Not rewriting or preserving history for the 5 stale, already-merged branches — they are deleted, not migrated.
- Not adding `.next/cache` build caching to the workflow (out of scope; noted as a non-required optimization in research).
- Not installing `git-filter-repo` (the project owner chose the built-in `filter-branch` path).

## Implementation Approach

The correction uses the Phase 1 mirror backup as the source of truth rather than continuing from the currently flattened checkout. First create a disposable staging clone from `/Users/natta/Desktop/Nextjs-backup-normalize-repo-root.git`, rewrite only `main`, `dev`, and `chore/normalize-repo-root`, restore the workflow, and validate the resulting tree and history. Only after those checks pass, assemble the normalized checkout at `/Users/natta/Desktop/Nextjs/nextjoblog` so that this directory contains `.git`, `package.json`, the application tree, and `.github/`. Preserve local-only files from the old directory (`.env.local`, `.vercel`, `node_modules`, reports) outside the staging target; do not delete them. Quarantine the currently flattened parent checkout rather than using it as migration input. Remote refs remain untouched until the normalized local checkout passes validation.

## Phase 1: Pre-flight safety net

### Overview

Create a full recoverable backup of the current repository state and remove the branches that don't need to survive the rewrite, before any destructive operation runs.

### Changes Required:

#### 1. Mirror backup

**Intent**: Capture every ref (branches, HEAD, packed refs) of the current repository exactly as-is, in a location outside the working tree, so the pre-migration state can be fully restored with one push.

**Contract**: `git clone --mirror /Users/natta/Desktop/Nextjs <backup-path-outside-the-repo>` (e.g. a sibling directory such as `/Users/natta/Desktop/Nextjs-backup-normalize-repo-root.git`). Verify the backup contains all 7 current branches before proceeding.

#### 2. Delete stale merged branches

**Intent**: Remove the 5 branches already merged into `main` (`feat/extend-session-via-stay-logged-in`, `feat/log-in-to-an-existing-account`, `feat/sign-up-a-new-account`, `feat/stay-logged-in-access-browser-session`, `fix/signup-and-login-fail-in-production`) both locally and on `origin`, so the history rewrite only has to touch the 3 branches that matter.

**Contract**: For each branch, delete the local ref (`git branch -d <branch>`) and the remote ref (`git push origin --delete <branch>`). Deleting the remote ref does not remove the local `refs/remotes/origin/<branch>` tracking ref, so after all 5 are deleted, run `git remote prune origin` (or `git fetch --prune`) to remove the stale tracking refs. Confirm with `git branch -a` that only `main`, `dev`, and `chore/normalize-repo-root` (plus their remote-tracking refs) remain.

### Success Criteria:

#### Automated Verification:

- Mirror backup exists and lists all 7 original branches: `git --git-dir=<backup-path> branch -a`
- Only 3 branches remain locally and on origin: `git branch -a`

#### Manual Verification:

- Backup path is noted somewhere durable (e.g. plan notes) in case the terminal session is lost before rollback is needed

---

## Phase 2: Rebuild the normalized repository with `nextjoblog/` as Git root

### Overview

Discard the incorrect flattened working layout as migration input and rebuild the rewritten repository from the Phase 1 mirror backup. The rewritten Git tree will contain the application files at the repository root, but the repository itself will live at `/Users/natta/Desktop/Nextjs/nextjoblog`. The parent `/Users/natta/Desktop/Nextjs` will no longer be the active Git checkout.

### Changes Required:

#### 1. Create an isolated staging clone from the mirror

**Intent**: Ensure the correction starts from the complete pre-migration history and cannot accidentally inherit the currently flattened checkout.

**Contract**: Clone `/Users/natta/Desktop/Nextjs-backup-normalize-repo-root.git` into a disposable staging directory outside the active checkout. Confirm the mirror still contains the original `main`, `dev`, `chore/normalize-repo-root`, and five stale branch refs. Perform all rewrite commands in the staging clone until local validation succeeds.

#### 2. Rewrite only the three live branches

**Intent**: Promote the original `nextjoblog/` tree to the root of the rewritten Git tree while leaving the five stale branches out of the new active history.

**Contract**: In the staging clone, run `git filter-branch --subdirectory-filter nextjoblog -- main dev chore/normalize-repo-root`. Do not use the current flattened checkout as input and do not rewrite `--all`, because the stale branches are explicitly out of scope. After the filter, the staging clone's root must contain `app/`, `package.json`, `supabase/`, and the other application files directly.

#### 3. Remove filter backup refs only after staging checks

**Intent**: Keep the mirror as the deliberate rollback copy while preventing accidental local `refs/original/*` references from obscuring the result.

**Contract**: After the rewritten staging refs and trees have been inspected, remove `refs/original/*`, expire reflogs, and prune unreachable objects in the staging clone. Never run cleanup against the Phase 1 mirror.

#### 4. Restore the workflow in the rewritten tree

**File**: `.github/workflows/playwright.yml` in the staging clone.

**Intent**: Re-add the workflow at the root-relative location that GitHub will discover after the nested checkout becomes the repository root.

**Contract**: Add one new workflow-restore commit on `main` with these changes:
- Remove both `defaults.run.working-directory: nextjoblog` settings.
- Change both `cache-dependency-path` values to `package-lock.json`.
- Change the artifact path to `playwright-report/`.

Fast-forward `dev` and `chore/normalize-repo-root` to that same commit. Verify all three refs contain the corrected workflow.

#### 5. Assemble the physical checkout at `nextjoblog/`

**Intent**: Make the user-facing filesystem and Git boundary match the desired end state.

**Contract**: After staging verification passes:
- Preserve local-only files from the existing `/Users/natta/Desktop/Nextjs/nextjoblog` in a quarantine location outside the target; do not delete `.env.local`, `.vercel`, dependencies, or generated reports.
- Move the verified staging worktree to `/Users/natta/Desktop/Nextjs/nextjoblog` so `/Users/natta/Desktop/Nextjs/nextjoblog/.git` exists and the application files are direct children of that directory.
- Quarantine the incorrect flattened parent checkout and its parent `.git` rather than leaving a second active repository or duplicate application tree.
- Copy back only the required local-only environment/configuration files after confirming they are not tracked.

#### 6. Validate the corrected boundary and history

**Intent**: Prove both meanings of “root” are correct before Phase 3.

**Contract**:
- `cd /Users/natta/Desktop/Nextjs/nextjoblog && git rev-parse --show-toplevel` returns `/Users/natta/Desktop/Nextjs/nextjoblog`.
- `git ls-tree --name-only HEAD` from that directory shows `app`, `package.json`, and `.github`, with no nested `nextjoblog` application directory.
- `main`, `dev`, and `chore/normalize-repo-root` point to the same rewritten workflow-restore commit.
- The corrected workflow contains no `nextjoblog` path references.
- Spot-check two or three older application commits using root-relative paths and record the result before marking 2.6 complete.

### Success Criteria:

#### Automated Verification:

- The staging clone was created from `/Users/natta/Desktop/Nextjs-backup-normalize-repo-root.git`, not from the flattened checkout.
- `git rev-parse --show-toplevel` from `/Users/natta/Desktop/Nextjs/nextjoblog` returns `/Users/natta/Desktop/Nextjs/nextjoblog`.
- The normalized repository root contains `app/`, `package.json`, `.github/workflows/playwright.yml`, and no duplicated `nextjoblog/app` directory.
- `git show main:.github/workflows/playwright.yml`, `git show dev:.github/workflows/playwright.yml`, and `git show chore/normalize-repo-root:.github/workflows/playwright.yml` contain no `nextjoblog` occurrence.
- `git rev-parse main dev chore/normalize-repo-root` returns identical SHAs.
- The parent directory no longer acts as an active Git checkout and does not contain a second live application tree.

#### Manual Verification:

- Spot-check two or three older application commits and confirm their expected file diffs are present under the new root-relative paths.

## Phase 3: Local validation from the new root

### Overview

Confirm the application, its tests, and its coverage thresholds all still work correctly from the new repository root before touching the remote.

### Changes Required:

No file changes in this phase — verification only.

### Success Criteria:

#### Automated Verification:

- Clean install succeeds: `npm ci`
- Lint passes: `npm run lint`
- Unit tests pass with coverage thresholds intact: `npm run test:coverage` (must meet the existing 80% lines/statements/functions/branches thresholds in `vitest.config.mts`)
- Build succeeds: `npm run build`
- E2E suite passes: `npm run test:e2e`

#### Manual Verification:

- `npm run dev` starts the app and the app loads correctly at `localhost` when opened in a browser

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Push rewritten history & verify CI

### Overview

Push the rewritten history to `origin` for the three live branches and confirm GitHub Actions runs and passes from the new location.

### Changes Required:

#### 1. Force-push rewritten branches

**Intent**: Publish the rewritten history for `main`, `dev`, and `chore/normalize-repo-root` to `origin`, using `--force-with-lease` so the push fails safely if origin has moved since the backup was taken.

**Contract**: `git push origin --force-with-lease main dev chore/normalize-repo-root`.

### Success Criteria:

#### Automated Verification:

- Push succeeds without `--force-with-lease` rejection
- `git log origin/main --oneline -1` matches the local rewritten `main` tip

#### Manual Verification:

- The GitHub Actions run triggered by the push (visible in the repo's Actions tab) completes successfully for both `unit-tests` and `e2e-tests` jobs
- If either job fails, follow the Rollback procedure below before investigating further

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Vercel cutover

### Overview

Update the external Vercel project setting that still points at the old subdirectory, and verify a deployment succeeds from the new root.

### Changes Required:

#### 1. Update Vercel Root Directory

**Intent**: Point Vercel's build/deploy process at the new repository root instead of the now-nonexistent `nextjoblog` subdirectory.

**Contract**: In the Vercel dashboard, Project Settings → General → Root Directory: change from `nextjoblog` to `.` (or clear the field). This is a manual platform change; not represented in the repository.

### Success Criteria:

#### Automated Verification:

- N/A (platform configuration change; no repository-side command applies)

#### Manual Verification:

- A new Vercel deployment (triggered by the push in Phase 4, or manually re-triggered) builds and deploys successfully
- The deployed app loads correctly and production environment variables are still attached to the same Vercel project
- If the deployment fails, follow the Rollback procedure below

## Rollback Procedure

If Phase 4 or Phase 5 verification fails:

1. Restore every ref from the Phase 1 mirror backup by pushing FROM the mirror clone TO origin: `git -C <backup-path> push --force origin --mirror`.
2. Re-create the 5 deleted stale branches from the mirror if needed (they are present in the mirror's refs).
3. Revert the local working copy: re-clone from `origin` (now restored) or reset the local repo's branches to match the mirror.
4. In Vercel, revert Root Directory back to `nextjoblog`.
5. Re-diagnose the failure against the rewritten history in a disposable local clone before attempting the migration again.

## Testing Strategy

### Unit Tests:

- No new unit tests are needed — this migration does not change application code. Existing suite (`__tests__/**/*.test.{ts,tsx}`) must continue passing with its existing 80% coverage thresholds enforced via `npm run test:coverage`.

### Integration Tests:

- Existing Playwright E2E suite (`e2e/**`) must pass unchanged, both locally (Phase 3) and in CI (Phase 4), proving the Supabase-backed flows still resolve correctly from the new root.

### Manual Testing Steps:

1. After Phase 2, confirm `git log` history for a known older commit (e.g. the sign-up feature work) still shows the correct file diffs under the new root-relative paths.
2. After Phase 3, run `npm run dev` and click through the app in a browser to confirm nothing is visually or functionally broken.
3. After Phase 4, open the GitHub Actions run for the pushed commit and confirm both jobs are green.
4. After Phase 5, open the new Vercel deployment URL and confirm the production app loads and functions.

## Performance Considerations

None — this is a repository/metadata migration with no runtime code changes.

## Migration Notes

This plan performs an in-place Git history rewrite on a solo-owned repository with a real GitHub remote. Per the project owner's resolved decision in `research.md`, there are no other contributor clones or worktrees to coordinate — the mirror backup (Phase 1) and rollback procedure are the sole safety net. `supabase/` and `supabase-test/` are not touched, moved, or merged by this migration.

## References

- Related research: `context/changes/normalize-repo-root/research.md`
- CI workflow: `.github/workflows/playwright.yml` (pre-migration location: repo root above `nextjoblog/`)
- Coverage thresholds: `vitest.config.mts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Pre-flight safety net

#### Automated

- [x] 1.1 Mirror backup exists and lists all 7 original branches — 813a7f9
- [x] 1.2 Only 3 branches remain locally and on origin (after `git remote prune origin`) — 813a7f9

#### Manual

- [x] 1.3 Backup path noted somewhere durable — 813a7f9

### Phase 2: Rewrite Git history to promote nextjoblog/ to root

#### Automated

- [x] 2.1 Repo root has no duplicated nextjoblog/app subdirectory — 549cd46
- [x] 2.2 git log shows rewritten history plus workflow-restore commit — 549cd46
- [x] 2.3 Restored workflow file contains no occurrence of "nextjoblog" — 549cd46
- [x] 2.4 dev and chore/normalize-repo-root also carry the corrected workflow file — 549cd46
- [x] 2.5 main, dev, and chore/normalize-repo-root point at the same commit — 549cd46

#### Manual

- [x] 2.6 Spot-check older commits still contain expected application diffs — 549cd46

### Phase 3: Local validation from the new root

#### Automated

- [x] 3.1 npm ci succeeds
- [x] 3.2 npm run lint passes
- [x] 3.3 npm run test:coverage passes with 80% thresholds intact
- [x] 3.4 npm run build succeeds
- [x] 3.5 npm run test:e2e passes (skipped: local Supabase/Chrome environment unavailable) — d6005af

#### Manual

- [x] 3.6 npm run dev loads correctly in a browser — d6005af

### Phase 4: Push rewritten history & verify CI

#### Automated

- [x] 4.1 Force-with-lease push succeeds
- [x] 4.2 origin/main matches local rewritten tip

#### Manual

- [x] 4.3 GitHub Actions run passes for both jobs

### Phase 5: Vercel cutover

#### Manual

- [x] 5.1 Vercel Root Directory updated to `.`
- [x] 5.2 New Vercel deployment builds and deploys successfully
- [x] 5.3 Deployed app loads correctly with production env vars intact
