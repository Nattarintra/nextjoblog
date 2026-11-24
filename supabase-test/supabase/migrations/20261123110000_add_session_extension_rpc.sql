create or replace function public.extend_session_if_current(
  p_session_id text,
  p_expected_extended_until timestamptz,
  p_expected_effective_expires_at timestamptz
)
returns table(result text, extended_until timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_new_extended_until timestamptz;
begin
  if v_user_id is null
    or p_session_id is null
    or p_session_id = ''
    or p_expected_effective_expires_at is null
    or (
      p_expected_extended_until is not null
      and p_expected_effective_expires_at < p_expected_extended_until
    ) then
    return query select 'conflict'::text, null::timestamptz;
    return;
  end if;

  v_new_extended_until := p_expected_effective_expires_at + interval '30 days';

  if p_expected_extended_until is null then
    insert into public.session_extensions (
      session_id,
      user_id,
      extended_until,
      updated_at
    ) values (
      p_session_id,
      v_user_id,
      v_new_extended_until,
      clock_timestamp()
    )
    on conflict (session_id) do nothing;

    if found then
      return query select 'success'::text, v_new_extended_until;
      return;
    end if;
  else
    update public.session_extensions as se
    set extended_until = v_new_extended_until,
        updated_at = clock_timestamp()
    where se.session_id = p_session_id
      and se.user_id = v_user_id
      and se.extended_until is not distinct from p_expected_extended_until;

    if found then
      return query select 'success'::text, v_new_extended_until;
      return;
    end if;
  end if;

  return query select 'conflict'::text, null::timestamptz;
end;
$$;

revoke all on function public.extend_session_if_current(text, timestamptz, timestamptz)
from public, anon, authenticated;
grant execute on function public.extend_session_if_current(text, timestamptz, timestamptz)
to authenticated;
