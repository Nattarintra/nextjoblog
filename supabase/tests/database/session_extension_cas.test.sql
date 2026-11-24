begin;

select plan(18);

insert into auth.users (id, instance_id, aud, role, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@example.com');

select has_function(
  'public',
  'extend_session_if_current',
  array['text', 'timestamp with time zone', 'timestamp with time zone']
);
select is(
  has_function_privilege(
    'authenticated',
    'public.extend_session_if_current(text,timestamp with time zone,timestamp with time zone)',
    'execute'
  ),
  true,
  'authenticated can execute the constrained RPC'
);
select is(
  has_function_privilege(
    'anon',
    'public.extend_session_if_current(text,timestamp with time zone,timestamp with time zone)',
    'execute'
  ),
  false,
  'anonymous callers cannot execute the RPC'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

select is(
  (select result from public.extend_session_if_current(
    'session-cas-1', null, '2026-11-23 12:00:00+00'
  )),
  'success',
  'first extension inserts from a null expected raw value'
);
select is(
  (select extended_until::text from public.session_extensions where session_id = 'session-cas-1'),
  '2026-12-23 12:00:00+00',
  'first extension uses the verified effective expiry plus 30 days'
);
select is(
  (select user_id from public.session_extensions where session_id = 'session-cas-1'),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'first extension derives ownership from auth.uid'
);

select is(
  (select result from public.extend_session_if_current(
    'session-cas-1', '2026-12-23 12:00:00+00', '2026-12-23 12:00:00+00'
  )),
  'success',
  'matching raw expiry updates the existing row'
);
select is(
  (select extended_until::text from public.session_extensions where session_id = 'session-cas-1'),
  '2027-01-22 12:00:00+00',
  'matching update advances exactly one fixed lifetime'
);

select is(
  (select result from public.extend_session_if_current(
    'session-cas-1', '2026-12-23 12:00:00+00', '2026-12-23 12:00:00+00'
  )),
  'conflict',
  'stale raw expiry is rejected'
);
select is(
  (select extended_until::text from public.session_extensions where session_id = 'session-cas-1'),
  '2027-01-22 12:00:00+00',
  'stale rejection does not change the row'
);
select is(
  (select result from public.extend_session_if_current(
    'session-cas-1', '2026-12-23 12:00:00+00', '2026-12-23 12:00:00+00'
  )),
  'conflict',
  'repeated stale submission remains rejected'
);

select is(
  (select result from public.extend_session_if_current(
    'session-cas-2', null, '2026-11-23 12:00:00+00'
  )),
  'success',
  'a second session can be extended independently'
);
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select is(
  (select result from public.extend_session_if_current(
    'session-cas-1', '2027-01-22 12:00:00+00', '2027-01-22 12:00:00+00'
  )),
  'conflict',
  'another user cannot extend the owner session'
);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select is(
  (select count(*)::integer from public.session_extensions where session_id = 'session-cas-1'),
  1,
  'cross-user rejection leaves the owner row intact'
);

select is(
  (select result from public.extend_session_if_current(
    'session-cas-1', '2027-01-22 12:00:00+00', '2027-01-22 12:00:00+00'
  )),
  'success',
  'owner can extend again using the latest raw expiry'
);
select is(
  (select extended_until::text from public.session_extensions where session_id = 'session-cas-1'),
  '2027-02-21 12:00:00+00',
  'latest owner update is persisted'
);

select is(
  (select result from public.extend_session_if_current(
    'session-cas-3', null, null
  )),
  'conflict',
  'missing effective cycle is rejected'
);
select is(
  (select count(*)::integer from public.session_extensions where session_id = 'session-cas-3'),
  0,
  'invalid input does not create a row'
);

select * from finish();
rollback;
