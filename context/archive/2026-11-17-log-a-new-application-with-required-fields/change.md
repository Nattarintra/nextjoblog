---
change_id: log-a-new-application-with-required-fields
title: Log a new application with required fields
status: archived
created: 2026-11-17
updated: 2026-11-19
archived_at: 2026-11-19T21:01:41Z
---

## Notes

# Story 1.1 — Log a New Application with Required Fields

## User Story Statement

**As a** Job Seeker,
**I want** to log a new application with the 5 core details (title, company, applied date, location, job posting link),
**so that** I never forget which jobs I've applied to, even when I apply to many in a row.

## Context & Background

Split from F1-S1. This is the smallest "core" that delivers real value — the user currently "just remembers" with no tool at all, so saving these 5 fields already solves the main problem. The 5 required fields were decided by Natta on 1 Sep 2026. The initial status is "Applied" (Natta, 16 Nov 2026), because making the applied date required means the user has already applied. **The applied date is the starting point of the 7-day follow-up reminder (F3-S4), and the "Applied" status is the starting point of the 14-day status check-in (F3-S7).**

## Acceptance Criteria

#### Happy Path

- **Given** the user is on the new application page
  **When** they fill in title, company, applied date, location and job posting link, and click Save
  **Then** the system creates a new application with the initial status "Applied" and shows it in the application list immediately

#### Edge Cases

- **Given** the user opens the new application page
  **When** the form finishes loading
  **Then** the applied date is pre-filled with today's date, and the user can change it

#### Error Handling

- **Given** the user leaves any required field empty
  **When** they click Save
  **Then** the system shows a message under each missing field and does not save until all 5 fields are filled
- **Given** the user enters a job posting link that is not a URL (e.g. "linkedin job")
  **When** they click Save
  **Then** the system says the link is invalid, shows an example of a valid format (e.g. `https://...`), and does not save
- **Given** saving fails (e.g. the connection drops)
  **When** the system cannot save
  **Then** everything the user entered stays in the form, with an error message and a Retry button

#### Non-Functional

- **Given** a field has a validation message
  **When** the user is using a screen reader or keyboard
  **Then** the message is announced together with its field, and focus moves to the first invalid field

## Dependencies

- Story 0.1–0.2 (login must exist first, because RLS relies on `auth.uid()`) — ✅ done

## Out of Scope

- All optional fields → Story 1.2 (1.3 on hold)
- Linking a CV/cover letter → Feature 4

## Open Questions

- ~~What is the initial status of a new application?~~ **Decided (Natta, 16 Nov 2026):** "Applied" (`applied`) — schema default changed from `interested` to `applied`

---
