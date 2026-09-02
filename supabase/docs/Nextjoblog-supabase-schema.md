# NextJobLog — Supabase (Postgres) Schema

> Tech stack: **Next.js + Supabase**. This schema is designed to cover all 5 Features / 13 User Stories (`epics/nextjoblog-user-stories.md`) and to support the multi-tenant/RLS NFR specified in the Epic from day 1 (each user sees only their own data, via Supabase `auth.users` + Row Level Security) — ready to scale to multiple users in the future without any structural rework.

## Table relationship overview

```
auth.users (Supabase managed)
  └─ profiles (1:1)                         — user settings, Google Calendar connection
  └─ cv_documents (1:many)                  — Feature 4: every CV/Cover letter file version
  └─ applications (1:many)                  — Feature 1: main application record
        ├─ status_history (1:many)          — Feature 2: status change history
        ├─ reminders (1:many)               — Feature 3: follow-up / interview / technical test
        ├─ conversation_notes (1:many)      — Feature 1: notes from conversations with the recruiter
        ├─ cv_document_id → cv_documents    — Feature 4: CV version used (nullable, ON DELETE SET NULL)
        └─ cover_letter_document_id → cv_documents — Feature 4: Cover letter version used

Feature 5 (Dashboard & Analytics) has no table of its own — it's SQL views queried from the tables above
```

Every table has a `user_id` column (denormalized, even though some tables could already reach the user via `applications`) so that RLS policies stay straightforward to write and queries stay fast.

---

## 1. Enum types

```sql
create type application_status as enum (
  'interested',              -- Interested
  'preparing',                -- Preparing application
  'applied',                  -- Applied
  'recruiter_contacted',      -- Recruiter followed up
  'interview_scheduled',      -- Interview scheduled
  'technical_test',           -- Technical test
  'reference_check',          -- Reference check
  'offer_received',           -- Offer received
  'rejected',                 -- Rejected
  'withdrawn'                 -- Withdrawn
);

create type work_format as enum ('on_site', 'hybrid', 'remote');
create type contract_type as enum ('permanent', 'consultant', 'internship', 'contract');
create type discipline as enum ('frontend', 'fullstack', 'backend', 'tester_qa');
create type document_type as enum ('cv', 'cover_letter');
create type reminder_type as enum ('follow_up', 'interview', 'technical_test');
```

> `location` and `source_website` are **deliberately not enums**, because the Epic states a future plan to open this up to other job seekers, who may be in other cities or use job sites outside the current list — stored as `text` instead, so we don't need an `ALTER TYPE` every time a new city or site shows up.

---

## 2. Tables

### `profiles`

Supplementary user data not covered by `auth.users` (Feature 3: Google Calendar connection)

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'Europe/Stockholm',
  google_calendar_connected boolean not null default false,
  google_refresh_token_encrypted text,  -- see the encryption note below
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

> **Security note:** Don't store the Google refresh token as plain text, even with RLS in place — use [Supabase Vault](https://supabase.com/docs/guides/database/vault) (pgsodium) to encrypt this column, to satisfy the "encrypt data at rest and in transit" NFR in the Epic.

### `cv_documents`

Feature 4 — the CV/Cover letter file library (the actual files live in Supabase Storage; this table holds metadata)

```sql
create table public.cv_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type document_type not null,
  version_label text not null,
  storage_path text not null,           -- path in the 'cv-documents' bucket, e.g. {user_id}/{id}.pdf
  file_size_bytes integer not null check (file_size_bytes <= 10 * 1024 * 1024), -- 10 MB limit as decided
  uploaded_at timestamptz not null default now()
);

-- prevent duplicate version names at the DB level (the UI layer should warn/suggest a suffix before an actual collision, per the noted edge case)
create unique index cv_documents_user_type_label_uniq
  on public.cv_documents(user_id, type, version_label);
```

### `applications`

Feature 1 (main application record) + current status (Feature 2) + CV/Cover letter linkage (Feature 4)

```sql
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- 5 required fields (decided)
  title text not null,
  company text not null,
  applied_date date not null,
  location text not null,
  posting_url text not null,

  -- remaining fields (optional)
  source_website text,
  closing_date date,
  work_format work_format,
  contract_type contract_type,
  discipline discipline,
  tech_stack text[] not null default '{}',
  fit_rating smallint check (fit_rating between 1 and 5),
  fit_reason text,
  missing_skills text,
  salary_info text,

  -- recruiter contact info (Feature 1, Story: Record Recruiter Contact & Conversation Notes)
  recruiter_name text,
  recruiter_contact text,
  rejection_reason text,

  -- current status (full history lives in status_history)
  status application_status not null default 'interested',

  -- CV/Cover letter version used — the source file can be deleted without deleting the application (per the edge case)
  cv_document_id uuid references public.cv_documents(id) on delete set null,
  cover_letter_document_id uuid references public.cv_documents(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index applications_user_idx on public.applications(user_id);
create index applications_user_status_idx on public.applications(user_id, status);
create index applications_user_applied_date_idx on public.applications(user_id, applied_date);
```

> `closing_date < applied_date` is **not enforced by a DB constraint**, because the user story states the system must "still save the record, but show a warning" — validate this at the app layer (Next.js form), not by rejecting at the DB.

### `status_history`

Feature 2 — status change timeline (insert-only; no update/delete from normal UI flows)

```sql
create table public.status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status application_status not null,
  changed_at timestamptz not null default now()
);

create index status_history_application_idx on public.status_history(application_id, changed_at);
```

The number of days between each status **is not stored as a column** (it could go stale if computed at the wrong time) — it's computed at query time with a window function:

```sql
select
  application_id, status, changed_at,
  changed_at - lag(changed_at) over (partition by application_id order by changed_at) as days_since_previous
from public.status_history;
```

### `reminders`

Feature 3 — follow-up / interview / technical test dates, with the linked Google Calendar event

```sql
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type reminder_type not null,
  event_date date not null,
  event_time time,                      -- optional, in case there's a specific interview time
  notes text,
  google_calendar_event_id text,        -- used to check before re-syncing (prevents duplicate events, per the edge case)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reminders_application_idx on public.reminders(application_id);
create index reminders_user_date_idx on public.reminders(user_id, event_date);
```

> When a reminder or an application is deleted (`on delete cascade`), the server-side code must also call the Google Calendar API to delete the associated `google_calendar_event_id` — the DB cascade does not delete anything on the Google side; that must be handled in application logic (e.g. a Supabase Edge Function or a Next.js API route, before/after the delete).

### `conversation_notes`

Feature 1 — notes from conversations with the recruiter, in chronological order (kept separate from `applications` since it's a list, not a single field)

```sql
create table public.conversation_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  note text not null,
  noted_at timestamptz not null default now()
);

create index conversation_notes_application_idx on public.conversation_notes(application_id, noted_at);
```

---

## 3. Row Level Security (RLS)

RLS is enabled on every table, using the same policy pattern: a user can see/edit only their own rows.

```sql
alter table public.profiles enable row level security;
create policy "profiles_self" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

alter table public.cv_documents enable row level security;
create policy "cv_documents_owner" on public.cv_documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.applications enable row level security;
create policy "applications_owner" on public.applications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.status_history enable row level security;
create policy "status_history_owner" on public.status_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.reminders enable row level security;
create policy "reminders_owner" on public.reminders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.conversation_notes enable row level security;
create policy "conversation_notes_owner" on public.conversation_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

This is the core mechanism that makes the "designed for multi-tenant from the start" NFR real — the day this opens up to other job seekers, no schema or policy changes are needed at all, because isolation is already enforced at the DB level.

---

## 4. Supabase Storage (CV/Cover letter files)

```sql
insert into storage.buckets (id, name, public)
values ('cv-documents', 'cv-documents', false);

-- path convention: {user_id}/{cv_document_id}.pdf
create policy "cv_documents_storage_select" on storage.objects
  for select using (bucket_id = 'cv-documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "cv_documents_storage_insert" on storage.objects
  for insert with check (bucket_id = 'cv-documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "cv_documents_storage_delete" on storage.objects
  for delete using (bucket_id = 'cv-documents' and auth.uid()::text = (storage.foldername(name))[1]);
```

The 10 MB file size limit should be enforced at **two layers**: on the client before upload (for fast UX), and via the `file_size_bytes` check constraint above (to catch a client-side bypass) — Supabase Storage itself also lets you set a global upload limit per bucket from the Dashboard, as a third layer.

---

## 5. Analytics views (Feature 5)

> **Important:** A regular Postgres view runs with the privileges of the view's owner (usually `postgres`), which **bypasses the RLS of the underlying tables entirely**. You must declare `security_invoker = true` (Postgres 15+, supported by Supabase) so the view respects the RLS of the actual querying user — otherwise one user could see everyone's data through this view.

```sql
create view public.v_application_counts
  with (security_invoker = true) as
select
  user_id,
  count(*) filter (where applied_date = current_date) as today_count,
  count(*) filter (where applied_date >= date_trunc('week', current_date)::date) as week_count,
  count(*) filter (where applied_date >= date_trunc('month', current_date)::date) as month_count
from public.applications
group by user_id;

create view public.v_status_counts
  with (security_invoker = true) as
select user_id, status, count(*) as count
from public.applications
group by user_id, status;

create view public.v_response_rates
  with (security_invoker = true) as
select
  user_id,
  count(*) as total_applications,
  count(*) filter (where status not in ('interested','preparing','applied')) as responded_count,
  count(*) filter (where status in ('interview_scheduled','technical_test','reference_check','offer_received')) as interview_count,
  round(100.0 * count(*) filter (where status not in ('interested','preparing','applied')) / nullif(count(*), 0), 1) as response_rate_pct,
  round(100.0 * count(*) filter (where status in ('interview_scheduled','technical_test','reference_check','offer_received')) / nullif(count(*), 0), 1) as interview_rate_pct
from public.applications
group by user_id;

create view public.v_website_rankings
  with (security_invoker = true) as
select
  user_id,
  coalesce(nullif(trim(lower(source_website)), ''), 'unknown') as source_website_normalized,
  count(*) as total_applications,
  round(100.0 * count(*) filter (where status not in ('interested','preparing','applied')) / nullif(count(*), 0), 1) as response_rate_pct
from public.applications
group by user_id, coalesce(nullif(trim(lower(source_website)), ''), 'unknown');

create view public.v_cv_rankings
  with (security_invoker = true) as
select
  a.user_id,
  a.cv_document_id,
  cd.version_label,
  count(*) as total_applications,
  round(100.0 * count(*) filter (where a.status not in ('interested','preparing','applied')) / nullif(count(*), 0), 1) as response_rate_pct
from public.applications a
join public.cv_documents cd on cd.id = a.cv_document_id
group by a.user_id, a.cv_document_id, cd.version_label;
```

Notes tied to previously identified edge cases:

- `nullif(count(*), 0)` → guards against division by zero, producing `NULL`, which the Next.js side converts to `0%` instead of erroring
- `lower(trim(source_website))` in `v_website_rankings` → partially reduces the "linkedin" vs "LinkedIn" problem, but **it's recommended to change the `source_website` form field to a dropdown/autocomplete with predefined standardized values** (LinkedIn, Indeed, Arbetsförmedlingen, Company website, Other) instead of a free-text field — fixing this at the source is better than normalizing at the destination
- `avg_days_awaiting_response` is not included in this set of views, because the logic for what counts as a "response" may change (e.g. counting from `recruiter_contacted`, or any status other than `applied`) — it's recommended to compute this in a Next.js server component directly from `status_history`, so the logic can be adjusted easily without migrating the view

---

## 6. Next.js integration notes

- Use `@supabase/ssr` (not the deprecated `@supabase/auth-helpers-nextjs`) for Server Components + Route Handlers in the Next.js App Router
- Every client-side query uses the Supabase anon key with RLS as the primary line of defense — there's no need to write `where user_id = ...` manually in code (RLS already enforces it), though adding it anyway for clarity doesn't hurt
- Google Calendar sync (creating/updating/deleting events + override policy) should be a Supabase Edge Function or a Next.js Route Handler that runs after a successful insert/update on `reminders` — it shouldn't rely on a Postgres trigger calling an external API directly
- CV/Cover letter files are uploaded directly from the client to Supabase Storage (signed upload), and a row is inserted into `cv_documents` only after the upload succeeds — this avoids the "upload interrupted midway" issue noted in the edge cases document
