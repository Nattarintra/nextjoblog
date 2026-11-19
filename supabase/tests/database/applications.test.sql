begin;

select plan(9);

-- Two users; the profile trigger creates their profiles.
insert into auth.users (id, instance_id, aud, role, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@example.com');

select is(
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'applications' and column_name = 'status'),
  '''applied''::application_status',
  'status defaults to applied'
);

-- Act as the owner (RLS applies).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

insert into public.applications (id, user_id, title, company, applied_date, location, posting_url)
values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'Engineer', 'Acme', '2026-11-19', 'Stockholm', 'https://example.com/job');

select is(
  (select status::text from public.applications where id = '11111111-1111-1111-1111-111111111111'),
  'applied',
  'inserted application has status applied'
);
select is(
  (select count(*)::integer from public.status_history
    where application_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'insert writes exactly one status_history row'
);
select ok(
  exists (
    select 1
    from public.status_history h
    join public.applications a on a.id = h.application_id
    where a.id = '11111111-1111-1111-1111-111111111111'
      and h.user_id = a.user_id
      and h.status = a.status
      and h.changed_at = a.created_at
  ),
  'history row copies user, status and timestamp'
);

select throws_ok(
  $$insert into public.applications (user_id, title, company, applied_date, location, posting_url)
    values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Sneaky', 'Acme', '2026-11-19', 'Oslo', 'https://example.com')$$,
  '42501',
  'new row violates row-level security policy for table "applications"',
  'cannot insert an application for another user'
);

select throws_ok(
  $$insert into public.applications (id, user_id, title, company, applied_date, location, posting_url)
    values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            'Duplicate', 'Acme', '2026-11-19', 'Oslo', 'https://example.com')$$,
  '23505',
  null,
  'duplicate primary key is rejected'
);
select is(
  (select count(*)::integer from public.status_history
    where application_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'rejected duplicate adds no second history row'
);

-- Injection-looking text is stored verbatim.
insert into public.applications (id, user_id, title, company, applied_date, location, posting_url)
values ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        $$'; drop table public.applications; --$$, 'Acme', '2026-11-19', 'Stockholm', 'https://example.com/job');
select is(
  (select title from public.applications where id = '22222222-2222-2222-2222-222222222222'),
  $$'; drop table public.applications; --$$,
  'injection string is stored verbatim'
);

-- Another user cannot read the history.
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select is(
  (select count(*)::integer from public.status_history),
  0,
  'second user cannot read another user''s status_history'
);

select * from finish();
rollback;
