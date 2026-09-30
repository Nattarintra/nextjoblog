<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Normalize Repo Root

- **Plan**: context/changes/normalize-repo-root/plan.md
- **Mode**: Deep
- **Date**: 2026-09-30
- **Verdict**: REVISE
- **Findings**: 2 critical, 2 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | FAIL |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | FAIL |
| Plan Completeness | WARNING |

## Grounding

6/6 paths ✓ (.github/workflows/playwright.yml, package.json scripts, vitest.config.mts thresholds, branch refs, git version, remote config), brief↔plan ✓

## Findings

### F1 — Rollback command is syntactically invalid

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Rollback Procedure, step 1
- **Detail**: The rollback command is `git push origin --force-with-lease --mirror <backup-path>`. Confirmed via `git push --help` that `--mirror` is a boolean flag ("instead of naming each ref to push, ... all refs ... be mirrored") — it does not take a path argument. As written, git will try to interpret `<backup-path>` as an extra refspec alongside `--mirror`, which is an invalid combination. This is the sole safety net for an irreversible force-push/history-rewrite on the real GitHub remote, and it's wrong exactly when it would be needed — after a failed Phase 4/5 verification. The correct direction is: push FROM the backup mirror TO origin, run with the backup as the source repo.
- **Fix**: Rewrite Rollback step 1 as `git -C <backup-path> push --force origin --mirror` (run from/against the mirror clone created in Phase 1, not as a flag on a push invoked from the working repo).
- **Decision**: FIXED

### F2 — Workflow re-add commit isn't guaranteed to land on dev and chore

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: End-State Alignment
- **Location**: Phase 2, step 3 + Success Criteria
- **Detail**: Verified `main`, `dev`, and `chore/normalize-repo-root` currently point at the identical commit (a23c40b), so after the subdirectory-filter they will still be identical to each other. But Phase 2 step 3's contract just says "Create `.github/workflows/playwright.yml` as a new commit" — it never says to apply that commit to all three branches, and the automated Success Criteria only check it on `main`/`HEAD`. If the implementer commits this file only on the currently-checked-out branch, `dev` and `chore/normalize-repo-root` are force-pushed in Phase 4 without any `.github/` at all — silently missing CI entirely, while automated verification reports green because it never looked at those two branches. This directly contradicts the plan's own Desired End State ("main, dev, and chore/normalize-repo-root all carry the rewritten history").
- **Fix**: Since all three branches are identical post-filter, create the re-add commit once (e.g. on a detached HEAD or main), then fast-forward the other two: `git branch -f dev <new-sha>` and `git branch -f chore/normalize-repo-root <new-sha>`. Extend Phase 2's automated success criteria to check `git show dev:.github/workflows/playwright.yml` and the same for `chore/normalize-repo-root`, not just main.
- **Decision**: FIXED

### F3 — Stale branch cleanup doesn't prune local remote-tracking refs

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 1, step 2 + Success Criteria
- **Detail**: Confirmed `remote.origin.prune` is not set in this repo's config. `git push origin --delete <branch>` removes the branch on GitHub but does not remove the local `refs/remotes/origin/<branch>` tracking ref — that needs an explicit `git fetch --prune` or `git remote prune origin`. Two consequences, both verified: (1) Phase 1's own automated check ("Only 3 branches remain locally and on origin: `git branch -a`") will not pass as written — the 5 stale `remotes/origin/*` entries are still listed. (2) Phase 2's `git filter-branch --subdirectory-filter nextjoblog -- --all` still walks those 5 stale remote-tracking refs (`--all` includes `refs/remotes/*`), defeating the plan's stated purpose of shrinking the rewrite surface.
- **Fix**: Add `git remote prune origin` (or `git fetch --prune`) as the last step of Phase 1, before the "only 3 branches remain" check runs.
- **Decision**: FIXED

### F4 — filter-branch will leave ~6 known empty commits in history

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2, step 1
- **Detail**: `--subdirectory-filter` does not imply `--prune-empty` (a separate, non-default flag). Found 6 existing commits on `main` that touch only `.github/workflows/playwright.yml` and nothing under `nextjoblog/` (e.g. `991eea6 "Fix: Error Invalid supabaseUrl"`, `40d8587 "chore(sign-up): finalize implementation review fixes"`). After the subdirectory-filter these become tree-identical to their parent — they'll survive in the rewritten history as empty, misleading no-op commits (their messages imply real changes that no longer exist post-filter). Not a functional blocker, but undermines "history for the app is preserved" as a clean guarantee, and the plan's own manual spot-check step could land on one of these and see nothing.
- **Fix A ⭐ Recommended**: Accept the empty commits as harmless historical artifacts; note in the plan that some commit messages will no longer match their (empty) diff.
  - Strength: No extra flag/risk; keeps 1:1 commit correspondence with the pre-rewrite history, which the plan's spot-check step assumes.
  - Tradeoff: `git log` on the rewritten repo will show a handful of commits whose message doesn't match their (empty) diff.
  - Confidence: HIGH — purely cosmetic; no downstream step depends on commit count or these specific commits being non-empty.
  - Blind spot: None significant.
- **Fix B**: Add `--prune-empty` to the filter-branch invocation.
  - Strength: Cleaner resulting history, no dangling no-op commits.
  - Tradeoff: Changes commit count/graph shape versus what Phase 2's success criteria implicitly assume; merge commits are exempted from pruning per the flag's own semantics, so behavior needs re-verification.
  - Confidence: MEDIUM — flag is well-documented but not tested against this specific history in this review.
  - Blind spot: Whether any of the 6 identified commits sit adjacent to a merge commit, which would change how pruning applies.
- **Decision**: FIXED via Fix A
