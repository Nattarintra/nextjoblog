begin;

select plan(14);

select ok(
  to_regclass('public.rate_limit_buckets') is not null,
  'rate_limit_buckets table exists'
);
select has_function(
  'public',
  'consume_rate_limit',
  ARRAY['text', 'text', 'integer', 'integer']
);

select is(
  (select allowed from public.consume_rate_limit(
    'password_reset_ip', repeat('a', 64), 2, 60
  )),
  true,
  'first token is allowed'
);
select is(
  (select allowed from public.consume_rate_limit(
    'password_reset_ip', repeat('a', 64), 2, 60
  )),
  true,
  'second token is allowed'
);
select is(
  (select allowed from public.consume_rate_limit(
    'password_reset_ip', repeat('a', 64), 2, 60
  )),
  false,
  'empty bucket is denied'
);
select is(
  (select retry_after_seconds from public.consume_rate_limit(
    'password_reset_ip', repeat('a', 64), 2, 60
  )),
  30,
  'denied request returns a retry delay'
);

update public.rate_limit_buckets
set updated_at = clock_timestamp() - interval '30 seconds'
where scope = 'password_reset_ip' and key_hash = repeat('a', 64);
select is(
  (select allowed from public.consume_rate_limit(
    'password_reset_ip', repeat('a', 64), 2, 60
  )),
  true,
  'elapsed time refills a token'
);

select is(
  (select allowed from public.consume_rate_limit(
    'password_reset_email_cooldown', repeat('b', 64), 0, 0
  )),
  true,
  'capacity and interval are clamped to safe minimums'
);

insert into public.rate_limit_buckets(scope, key_hash, tokens, updated_at, last_allowed)
values ('password_reset_ip', repeat('c', 64), 0, clock_timestamp() - interval '8 days', false);
select public.consume_rate_limit('password_reset_ip', repeat('c', 64), 1, 60);
select is(
  (select count(*)::integer from public.rate_limit_buckets where key_hash = repeat('c', 64)),
  0,
  'stale rows are cleaned up opportunistically'
);

select throws_ok(
  $$select * from public.consume_rate_limit('not_allowed', repeat('d', 64), 1, 60)$$,
  'invalid rate limit scope',
  'unknown scopes are rejected'
);
select throws_ok(
  $$select * from public.consume_rate_limit('password_reset_ip', repeat('e', 65), 1, 60)$$,
  'invalid rate limit key',
  'oversized keys are rejected'
);
select throws_ok(
  $$select * from public.consume_rate_limit('password_reset_ip', repeat('z', 64), 1, 60)$$,
  'invalid rate limit key',
  'non-hex keys are rejected'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.rate_limit_buckets$$,
  '42501',
  'permission denied for table rate_limit_buckets',
  'anonymous callers cannot read bucket rows'
);
select is(
  (select allowed from public.consume_rate_limit(
    'password_reset_unknown_ip', repeat('f', 64), 1, 60
  )),
  true,
  'anonymous callers can use the constrained RPC'
);

select * from finish();
rollback;
