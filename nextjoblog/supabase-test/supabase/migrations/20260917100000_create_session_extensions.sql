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
