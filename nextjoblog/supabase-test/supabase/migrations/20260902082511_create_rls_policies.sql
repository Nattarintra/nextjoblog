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
