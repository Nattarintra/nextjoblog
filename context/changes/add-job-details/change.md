---
change_id: add-job-details
title: Add job details (optional fields)
status: implemented
created: 2026-11-20
updated: 2026-11-22
archived_at: null
---

## Notes

# Story 1.2 — Add Job Details (Optional Fields)

### User Story Statement

**As a** Job Seeker,
**I want to** add job details — closing date, work arrangement, contract type, track, required technologies and salary,
**so that** I can compare jobs and see which ones match what I'm looking for.

### Context & Background

Split from F1-S1. This data isn't needed to "not forget", but it helps compare jobs. **The "Website Where Found" field has been removed** (Natta, 16 Nov 2026) because it isn't needed for analysis — website ranking in F5-S3 was removed too. The closing-date warning follows the mockup rule.

### Acceptance Criteria

**Happy Path**
- **Given** the user is creating or editing an application
  **When** they fill in any optional field and click Save
  **Then** the data is saved and shown on the application detail page
- **Given** the user is choosing a work arrangement, contract type or track
  **When** they open the options
  **Then** the system shows predefined options (e.g. track: Frontend / Fullstack / Backend / Tester-QA) to pick from instead of free text
- **Given** the user is entering required technologies
  **When** they add several (e.g. React, TypeScript, Next.js)
  **Then** each one is stored as a separate tag and can be removed individually

**Edge Cases**
- **Given** the user enters applied date 25 Aug and closing date 20 Aug (closing date before applied date)
  **When** they finish entering the closing date
  **Then** the system shows the warning "Closing date is before the applied date — double check (you can still save)" and the user can still save as normal
- **Given** the closing-date warning is showing
  **When** the user changes the closing date to on or after the applied date, or clears it
  **Then** the warning disappears immediately

### Dependencies

- Story 1.1

### Out of Scope

- Automatically pulling job details from the posting link
- The "Website Where Found" field (removed)
- Warning when the closing date has passed relative to today (the mockup rule is used instead)

### Open Questions

- ~~Which closing-date warning rule?~~ **Decided (Natta, 16 Nov 2026):** follow the mockup — warn when the closing date is before the applied date
- ~~Should "Website Where Found" be a fixed list or autocomplete?~~ **Decided (Natta, 16 Nov 2026):** remove the field entirely
