-- A newly logged application starts as "applied" (Story 1.1), not "interested".
alter table public.applications
  alter column status set default 'applied';

-- The first status_history row is written by the database so every insert path
-- (Server Action, import, SQL console) records it exactly once.
create function public.record_initial_status()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.status_history (application_id, user_id, status, changed_at)
  values (new.id, new.user_id, new.status, new.created_at);
  return new;
end;
$$;

revoke execute on function public.record_initial_status() from public, anon, authenticated;

create trigger on_application_created
  after insert on public.applications
  for each row execute procedure public.record_initial_status();
