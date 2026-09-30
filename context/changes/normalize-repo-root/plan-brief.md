# Normalize Repo Root — Plan Brief

> Full plan: `context/changes/normalize-repo-root/plan.md`
> Research: `context/changes/normalize-repo-root/research.md`

## What & Why

Move the Git repository root from `/Users/natta/Desktop/Nextjs` into `/Users/natta/Desktop/Nextjs/nextjoblog`, so the Next.js app directory is the true repo root instead of looking like a monorepo with one accidental subdirectory. This removes the `working-directory: nextjoblog` workarounds in CI and the `Root Directory: nextjoblog` setting in Vercel that exist only because of the current layout.

## Starting Point

`main`, `dev`, and `chore/normalize-repo-root` all sit at the same commit (`a23c40b`); 5 other remote branches are already merged into `main` and stale. The only tracked top-level entries are `.github/` and `nextjoblog/`. `.github/workflows/playwright.yml` hardcodes the old boundary in three places (working directory, cache path, artifact path). No `git-filter-repo` is installed — only stock Git.

## Desired End State

`nextjoblog/.git` is the repository root. The CI workflow runs and passes from that root with no path workarounds. Vercel deploys successfully with Root Directory cleared. History for the app is preserved; the 5 stale branches are gone.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Migration shape | Move Git root into `nextjoblog/`, don't flatten app up into parent | Keeps the app directory identical; zero source-path edits needed | Research |
| Rewrite tool | `git filter-branch --subdirectory-filter` (built-in) | Available without installing anything; repo is small enough that its speed/deprecation caveats don't matter | Plan (user-selected) |
| `.github` history | Dropped by the filter, then re-added as one fresh commit with fixed paths | `--subdirectory-filter` can only keep one top-level directory; `.github` has no history worth a custom index-filter to save | Plan |
| Stale branches | Delete the 5 merged branches before rewriting | They're already merged into `main`; nothing is lost, and it shrinks the rewrite surface | Plan (user-selected) |
| Backup | Full `git clone --mirror` before any destructive step | Makes every subsequent step recoverable with one force-push | Plan (user-selected) |
| Rollback trigger | Force-push the mirror back if CI or Vercel verification fails after push | Symmetric with the backup; avoids debugging a broken remote in place | Plan (user-selected) |
| Validation depth | Full local suite + live CI run + real Vercel deploy | The workflow-path edit and Vercel setting are exactly what's most likely to break, and only a live run proves them | Plan (user-selected) |

## Scope

**In scope:** Git history rewrite, `.github/workflows/playwright.yml` path fixes, stale branch cleanup, local + CI + Vercel validation, documented rollback.

**Out of scope:** Flattening the app into the parent directory, npm workspaces, any application/test/config code changes, adding `.next/cache` CI caching, installing `git-filter-repo`.

## Architecture / Approach

Work happens on the parent-level checkout since that's the repo being rewritten. Backup and branch cleanup come first (Phase 1), then a single `filter-branch` pass rewrites the three live branches followed by a manual re-add of the corrected workflow file (Phase 2). Validation runs local-first for fast feedback (Phase 3), then remote via a real force-push and CI run (Phase 4), then the external Vercel setting and a real deployment (Phase 5) — the two steps a rollback specifically covers.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Pre-flight safety net | Mirror backup + stale branches deleted | Backup incomplete before destructive steps run |
| 2. Rewrite history | `nextjoblog/` promoted to root, workflow restored with fixed paths | `.github` history silently dropped if not understood/accepted |
| 3. Local validation | Full suite + 80% coverage confirmed from new root | Coverage threshold regression goes unnoticed |
| 4. Push & verify CI | Rewritten history live on origin, CI green | Force-push conflicts or CI breaks on the new path |
| 5. Vercel cutover | Root Directory updated, deployment verified | Deploy fails silently or prod env vars detach |

**Prerequisites:** Solo project, no other clones/worktrees to coordinate (confirmed by project owner); `dev`, `main`, `chore/normalize-repo-root` already converged at the same commit.
**Estimated effort:** Single session, ~5 phases, mostly command execution and verification — no code to write.

## Open Risks & Assumptions

- Assumes the mirror backup and rollback procedure are sufficient recovery — no additional off-machine backup is planned.
- Assumes Vercel deployment can be manually triggered/verified within this session; if not, Phase 5 verification becomes a follow-up.

## Success Criteria (Summary)

- `git rev-parse --show-toplevel` from `nextjoblog/` returns `nextjoblog/` itself.
- CI passes both jobs from the new root with no `nextjoblog` path references left in the workflow.
- Vercel deploys successfully with Root Directory cleared.
