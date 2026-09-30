---
change_id: normalize-repo-root
title: Normalize repo root
status: archived
created: 2026-09-28
updated: 2026-09-30
archived_at: 2026-09-30T17:45:27Z
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- Phase 1 mirror backup: `/Users/natta/Desktop/Nextjs-backup-normalize-repo-root.git`
- Correct GitHub Actions location: `.github/workflows/playwright.yml` now lives inside `nextjoblog/` (the repo root). Previously it sat one level above `nextjoblog/` in the old parent repo. Docs and plan references to the old location are historical; this layout is the correct one.
