---
change_id: view-application-list-and-details
title: View application list and details
status: implementing
created: 2026-11-26
updated: 2026-11-27
archived_at: null
---

## Notes

# Story 1.4 — View Application List and Details *(new — missing gap)*
 
## User Story Statement
**As a** Job Seeker,
**I want** to see a list of all my applications and open the details of each one,
**so that** I have an overview of my job search and can look up any application at any time.
 
## Context & Background
Not split from any story — found while splitting F1-S1 and F1-S4 that **no story covered showing the list or the detail page**, even though 1.1 ("shown in the list"), 1.5–1.7 ("shown on the detail page") and 1.11–1.13 (filtering the list) all assumed it existed. This is the same kind of gap that led to adding Story 0.
 
## Acceptance Criteria
 
#### Happy Path
- **Given** the user has 3 applications
  **When** they open the application list
  **Then** all 3 are shown, each with title, company, applied date and status, sorted by most recent applied date first
- **Given** the user is on the list
  **When** they click an application
  **Then** the system opens a detail page showing every Story 1.4 application field: the required title, company, applied date, location and posting URL fields; the optional closing date, work format, contract type, discipline, technology stack and salary fields; and the current status
#### Edge Cases
- **Given** the user has no applications yet
  **When** they open the list
  **Then** the system shows a prompt to add the first application with an "Add application" button, instead of an empty page
- **Given** an application has optional fields left empty
  **When** the detail page opens
  **Then** empty fields are shown as "—" or hidden, never as "null" or a blank box that looks broken
#### Error Handling
- **Given** the user opens a detail link to an application that has been deleted (e.g. from a bookmark)
  **When** the page loads
  **Then** the system shows "Application not found" with a button back to the list
#### Non-Functional
- **Given** the user has up to 500 applications
  **When** they open the list
  **Then** the list renders within 2 seconds (consistent with the Dashboard threshold in F5-S1)
 
## Dependencies
- Story 1.1
 
## Out of Scope
- Kanban view → F2-S1
- Pagination — not needed at ≤500 applications
 
## Open Questions
- None
---
