create table public.rate_limit_buckets (
  scope text not null,
  key_hash text not null,
  tokens numeric(20, 6) not null,
  updated_at timestamptz not null default clock_timestamp(),
  last_allowed boolean not null,
  primary key (scope, key_hash)
);

create index rate_limit_buckets_updated_at_idx
  on public.rate_limit_buckets (updated_at);

alter table public.rate_limit_buckets enable row level security;

revoke all on table public.rate_limit_buckets from public, anon, authenticated;

create or replace function public.consume_rate_limit(
  p_scope text,
  p_key_hash text,
  p_capacity integer,
  p_refill_interval_seconds integer
)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_capacity numeric := greatest(1, least(coalesce(p_capacity, 1), 100));
  v_refill_interval_seconds numeric := greatest(
    1,
    least(coalesce(p_refill_interval_seconds, 1), 86400)
  );
  v_row record;
  v_retry_after integer;
begin
  if p_scope not in (
    'password_reset_ip',
    'password_reset_unknown_ip',
    'password_reset_email_cooldown',
    'password_reset_email_hourly'
  ) then
    raise exception 'invalid rate limit scope';
  end if;

  if p_key_hash is null or length(p_key_hash) > 128 then
    raise exception 'invalid rate limit key';
  end if;

  delete from public.rate_limit_buckets
  where updated_at < clock_timestamp() - interval '7 days';

  insert into public.rate_limit_buckets (
    scope,
    key_hash,
    tokens,
    updated_at,
    last_allowed
  ) values (
    p_scope,
    p_key_hash,
    v_capacity - 1,
    clock_timestamp(),
    true
  )
  on conflict (scope, key_hash) do update
  set
    tokens = case
      when least(
        v_capacity,
        public.rate_limit_buckets.tokens
          + extract(epoch from clock_timestamp() - public.rate_limit_buckets.updated_at)
            * v_capacity / v_refill_interval_seconds
      ) >= 1 then least(
        v_capacity,
        public.rate_limit_buckets.tokens
          + extract(epoch from clock_timestamp() - public.rate_limit_buckets.updated_at)
            * v_capacity / v_refill_interval_seconds
      ) - 1
      else least(
        v_capacity,
        public.rate_limit_buckets.tokens
          + extract(epoch from clock_timestamp() - public.rate_limit_buckets.updated_at)
            * v_capacity / v_refill_interval_seconds
      )
    end,
    updated_at = clock_timestamp(),
    last_allowed = least(
      v_capacity,
      public.rate_limit_buckets.tokens
        + extract(epoch from clock_timestamp() - public.rate_limit_buckets.updated_at)
          * v_capacity / v_refill_interval_seconds
    ) >= 1
  returning * into v_row;

  if v_row.last_allowed then
    return query select true, 0;
    return;
  end if;

  v_retry_after := greatest(
    1,
    ceil((1 - v_row.tokens) * v_refill_interval_seconds / v_capacity)
  )::integer;
  return query select false, v_retry_after;
end;
$$;

revoke execute on function public.consume_rate_limit(text, text, integer, integer)
  from public;
grant execute on function public.consume_rate_limit(text, text, integer, integer)
  to anon, authenticated;
