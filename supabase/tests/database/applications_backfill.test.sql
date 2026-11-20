begin;

select plan(3);

insert into auth.users (id, instance_id, aud, role, email)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'legacy@example.com');

-- Simulate an application created before the trigger existed: no history row.
alter table public.applications disable trigger on_application_created;
insert into public.applications (id, user_id, title, company, applied_date, location, posting_url, status, created_at)
values ('33333333-3333-3333-3333-333333333333', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        'Legacy', 'Acme', '2026-10-01', 'Lund', 'https://example.com/legacy', 'interested', '2026-10-01 08:00:00+00');
alter table public.applications enable trigger on_application_created;

select is(
  (select count(*)::integer from public.status_history where application_id = '33333333-3333-3333-3333-333333333333'),
  0,
  'legacy application starts without history'
);

-- Same statement as supabase/migrations/20261119110000_backfill_initial_status_history.sql.
insert into public.status_history (application_id, user_id, status, changed_at)
select a.id, a.user_id, a.status, a.created_at
from public.applications a
where not exists (
  select 1 from public.status_history h where h.application_id = a.id
);

select is(
  (select count(*)::integer from public.status_history
    where application_id = '33333333-3333-3333-3333-333333333333'
      and user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
      and status = 'interested'
      and changed_at = '2026-10-01 08:00:00+00'),
  1,
  'backfill writes one history row with the current status at created_at'
);

-- Running it again must not duplicate rows.
insert into public.status_history (application_id, user_id, status, changed_at)
select a.id, a.user_id, a.status, a.created_at
from public.applications a
where not exists (
  select 1 from public.status_history h where h.application_id = a.id
);

select is(
  (select count(*)::integer from public.status_history where application_id = '33333333-3333-3333-3333-333333333333'),
  1,
  'backfill is idempotent'
);

select * from finish();
rollback;
