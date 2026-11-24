# NextJobLog — Supabase (Postgres) Schema (English)

> English version of `architecture/nextjoblog-supabase-schema.md` (Thai). Both files carry the same content as of 19 Nov 2026 — if one is updated, update the other.
>
> Tech stack: **Next.js + Supabase**. This schema is designed to cover all 5 Features / 13 User Stories (`epics/nextjoblog-user-stories.md`) and to meet the multi-tenant/RLS NFR in the Epic from day 1 (each user only sees their own data, via Supabase `auth.users` + Row Level Security) — ready to grow to many users later without restructuring.
>
> **Update (Natta, 16 Nov 2026)** following the decisions in `epics/nextjoblog-feature-1-breakdown.md`:
> - `applications.status` default changed from `'interested'` to **`'applied'`** (new applications start at "Applied")
> - **Removed the `source_website` column** and the **`v_website_rankings`** view — the "Website Where Found" field isn't needed for analysis
> - `rejection_reason` is kept permanently for analysis — the app must not clear it when the status moves away from `rejected`
>
> **Update (Natta, 18 Nov 2026):** **Removed the `fit_rating`, `fit_reason` and `missing_skills` columns** — Story 1.3 (Rate Job Fit) is on hold and not in the MVP. If it comes back later, add them back with a migration.

## Table relationships overview

```
auth.users (Supabase managed)
  └─ profiles (1:1)                         — user settings, Google Calendar connection
  └─ cv_documents (1:many)                  — Feature 4: every CV/cover letter file version
  └─ applications (1:many)                  — Feature 1: the core application record
        ├─ status_history (1:many)          — Feature 2: status change history
        ├─ reminders (1:many)               — Feature 3: follow-up / interview / technical test
        ├─ conversation_notes (1:many)      — Feature 1: conversation notes with the recruiter
        ├─ cv_document_id → cv_documents    — Feature 4: CV version used (nullable, ON DELETE SET NULL)
        └─ cover_letter_document_id → cv_documents — Feature 4: cover letter version used

Feature 5 (Dashboard & Analytics) has no tables of its own — it is SQL views over the tables above
```

Every table has a `user_id` column (denormalised, even where the user could be reached through `applications`) so RLS policies stay simple and queries are faster.

---

## 1. Enum types

```sql
create type application_status as enum (
  'interested',            -- Interested
  'preparing',              -- Preparing application
  'applied',                 -- Applied
  'recruiter_contacted',     -- Recruiter responded
  'interview_scheduled',     -- Interview scheduled
  'technical_test',          -- Technical test
  'reference_check',         -- Reference check
  'offer_received',          -- Offer received
  'rejected',                -- Rejected
  'withdrawn'                -- Withdrawn
);

create type work_format as enum ('on_site', 'hybrid', 'remote');
create type contract_type as enum ('permanent', 'consultant', 'internship', 'contract');
create type discipline as enum ('frontend', 'fullstack', 'backend', 'tester_qa');
create type document_type as enum ('cv', 'cover_letter');
create type reminder_type as enum ('follow_up', 'interview', 'technical_test');
```

> `location` is **intentionally not an enum**, because the Epic plans to open the app to other job seekers later, who may be in other cities beyond the current list — it is stored as `text` so a new city never needs an `ALTER TYPE`.

---

## 2. Tables

### `profiles`
Extra user data that `auth.users` doesn't hold (Feature 3: Google Calendar connection)

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

> **Security note:** never store the Google refresh token as plain text, even with RLS in place — encrypt this column with [Supabase Vault](https://supabase.com/docs/guides/database/vault) (pgsodium) to meet the Epic's NFR "encrypt data at rest and in transit".

### `cv_documents`
Feature 4 — the CV/cover letter library (the files themselves live in Supabase Storage; this table holds the metadata)

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

-- Prevent duplicate version names at the DB level (the UI should warn / suggest a numeric suffix before it ever collides — per the documented edge case)
create unique index cv_documents_user_type_label_uniq
  on public.cv_documents(user_id, type, version_label);
```

### `applications`
Feature 1 (the core application) + current status (Feature 2) + CV/cover letter links (Feature 4)

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

  -- remaining fields (optional) — source_website removed (16 Nov 2026), fit_rating/fit_reason/missing_skills removed (18 Nov 2026)
  closing_date date,
  work_format work_format,
  contract_type contract_type,
  discipline discipline,
  tech_stack text[] not null default '{}',
  salary_info text,

  -- recruiter contact: one per application (decided — Story 1.5)
  recruiter_name text,
  recruiter_contact text,
  -- kept permanently for analysis; never cleared when the status moves away from 'rejected' (Story 1.7)
  rejection_reason text,

  -- current status (full history lives in status_history) — new applications start at "Applied" (Story 1.1)
  status application_status not null default 'applied',

  -- CV/cover letter version used — the source file can be deleted without deleting the application (per edge case)
  cv_document_id uuid references public.cv_documents(id) on delete set null,
  cover_letter_document_id uuid references public.cv_documents(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index applications_user_idx on public.applications(user_id);
create index applications_user_status_idx on public.applications(user_id, status);
create index applications_user_applied_date_idx on public.applications(user_id, applied_date);
```

> `closing_date < applied_date` is **not enforced by a DB constraint**, because Story 1.2 says the system must "still save, but show a warning" — validate it in the app layer (the Next.js form), not by rejecting at the DB.

> **Migration (if the table already exists):**
> ```sql
> alter table public.applications alter column status set default 'applied';
> drop view if exists public.v_website_rankings;
> alter table public.applications drop column if exists source_website;
> alter table public.applications drop column if exists fit_rating;
> alter table public.applications drop column if exists fit_reason;
> alter table public.applications drop column if exists missing_skills;
> ```

### `status_history`
Feature 2 — the status change timeline (insert only; no update/delete from the normal UI)

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

The number of days between statuses is **not stored as a column** (it can go stale if calculated at the wrong moment) — it is calculated at query time with a window function:

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
  event_time time,                      -- optional, for interviews with a set time
  notes text,
  google_calendar_event_id text,        -- checked before syncing again (prevents duplicate events, per edge case)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reminders_application_idx on public.reminders(application_id);
create index reminders_user_date_idx on public.reminders(user_id, event_date);
```

> When a reminder or an application is deleted (`on delete cascade`), server code must call the Google Calendar API to delete the related `google_calendar_event_id` — a DB cascade doesn't reach Google; it has to be handled in application logic (e.g. a Supabase Edge Function or a Next.js API route before/after the delete).

### `conversation_notes`
Feature 1 — time-ordered conversation notes with the recruiter (separate from `applications` because it's a list, not a single field)

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

RLS is enabled on every table with the same policy pattern: users can only see/edit their own rows.

### `session_extensions`

Application-owned login expiry is stored once per Supabase session. The
`extended_until` value is combined with the provider expiry using the later
value. Row-level security limits reads and writes to the owning authenticated
user.

```sql
create table public.session_extensions (
  session_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  extended_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.session_extensions enable row level security;
create policy "session_extensions_owner" on public.session_extensions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Session extension uses the security-definer RPC introduced by
`20261123110000_add_session_extension_rpc.sql`:

```sql
public.extend_session_if_current(
  p_session_id text,
  p_expected_extended_until timestamptz,
  p_expected_effective_expires_at timestamptz
)
returns table(result text, extended_until timestamptz)
```

The authenticated caller is derived from `auth.uid()`; it cannot supply a
user ID, replacement expiry, or lifetime. The function atomically inserts or
updates only when the expected stored expiry still matches, returning
`result = 'success'` and the persisted timestamp on success, or
`result = 'conflict'` with no mutation for stale or invalid input. Its fixed
`search_path` is `pg_catalog, public`, execute is revoked from `public` and
`anon`, and granted only to `authenticated`.

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

This is the core mechanism behind the NFR "design for multi-tenant from the start" — the day other job seekers can sign up, no schema or policy changes are needed, because isolation already works at the DB level.

---

## 4. Supabase Storage (CV/cover letter files)

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

The 10 MB file size limit should be enforced in **two layers**: on the client before upload (fast UX) and by the `file_size_bytes` check constraint above (in case the client is bypassed) — Supabase Storage can also set a global per-bucket upload limit from the Dashboard as a third layer.

---

## 5. Analytics views (Feature 5)

> **Important:** a normal Postgres view runs with its owner's privileges (usually `postgres`), which **bypasses RLS on the underlying tables entirely**. Declare `security_invoker = true` (Postgres 15+, supported by Supabase) so the view respects the RLS of the user actually querying it — otherwise one user could see everyone's data through the view.

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

Notes linked to previously documented edge cases:
- `nullif(count(*), 0)` → avoids division by zero, returning `NULL`, which the Next.js side shows as `0%` instead of an error
- `v_website_rankings` has been removed (16 Nov 2026) along with the `source_website` column
- `avg_days_awaiting_response` is not in these views because the definition of a "response" may change (e.g. counting from `recruiter_contacted`, or any status other than `applied`) — calculate it in a Next.js server component directly from `status_history`, so the logic can change without migrating a view

---

## 6. Next.js integration notes

- Use `@supabase/ssr` (not the deprecated `@supabase/auth-helpers-nextjs`) for Server Components + Route Handlers in the Next.js App Router
- Every client query uses the Supabase anon key with RLS as the main line of defence — there's no need to write `where user_id = ...` in code (RLS enforces it), though adding it for clarity does no harm
- Google Calendar sync (create/update/delete events + the override policy) should be a Supabase Edge Function or a Next.js Route Handler that runs after a successful insert/update on `reminders` — don't rely on a Postgres trigger calling an external API directly
- CV/cover letter files are uploaded straight from the client to Supabase Storage (signed upload), and the `cv_documents` row is inserted only once the upload succeeds — this avoids the "upload cut off mid-way" problem listed in the edge cases doc
- When creating a new application, insert the first `status_history` row (`'applied'`, `changed_at = now()`) in the same transaction, so the F2-S2 timeline always has a starting point
