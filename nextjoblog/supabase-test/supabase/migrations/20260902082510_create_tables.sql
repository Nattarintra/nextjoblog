create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'Europe/Stockholm',
  google_calendar_connected boolean not null default false,
  google_refresh_token_encrypted text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cv_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type document_type not null,
  version_label text not null,
  storage_path text not null,
  file_size_bytes integer not null check (file_size_bytes <= 10 * 1024 * 1024),
  uploaded_at timestamptz not null default now()
);

create unique index cv_documents_user_type_label_uniq
  on public.cv_documents(user_id, type, version_label);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  title text not null,
  company text not null,
  applied_date date not null,
  location text not null,
  posting_url text not null,

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

  recruiter_name text,
  recruiter_contact text,
  rejection_reason text,

  status application_status not null default 'interested',

  cv_document_id uuid references public.cv_documents(id) on delete set null,
  cover_letter_document_id uuid references public.cv_documents(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index applications_user_idx on public.applications(user_id);
create index applications_user_status_idx on public.applications(user_id, status);
create index applications_user_applied_date_idx on public.applications(user_id, applied_date);

create table public.status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status application_status not null,
  changed_at timestamptz not null default now()
);

create index status_history_application_idx on public.status_history(application_id, changed_at);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type reminder_type not null,
  event_date date not null,
  event_time time,
  notes text,
  google_calendar_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reminders_application_idx on public.reminders(application_id);
create index reminders_user_date_idx on public.reminders(user_id, event_date);

create table public.conversation_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  note text not null,
  noted_at timestamptz not null default now()
);

create index conversation_notes_application_idx on public.conversation_notes(application_id, noted_at);
