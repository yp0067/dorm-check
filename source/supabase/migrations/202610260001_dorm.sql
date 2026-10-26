-- Run once in the Supabase SQL Editor before deploying the night function.
create table if not exists public.dorm_nights (
  date date primary key,
  state jsonb not null,
  revision bigint not null check (revision > 0)
);
create table if not exists public.dorm_sessions (
  token_hash text primary key,
  name text not null,
  expires_at timestamptz not null
);
create index if not exists dorm_sessions_expiry on public.dorm_sessions(expires_at);
alter table public.dorm_nights enable row level security;
alter table public.dorm_sessions enable row level security;
revoke all on public.dorm_nights, public.dorm_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.dorm_nights, public.dorm_sessions to service_role;

-- Only the server can call this. A stale tab cannot overwrite a newer submission.
create or replace function public.dorm_save_night(p_date date, p_state jsonb, p_expected bigint)
returns boolean language plpgsql security invoker
set search_path = public, pg_temp as $$
declare affected integer;
begin
  if p_expected < 0 then return false; end if;
  if p_expected = 0 then
    insert into public.dorm_nights(date, state, revision)
    values (p_date, p_state, 1) on conflict (date) do nothing;
  else
    update public.dorm_nights set state = p_state, revision = revision + 1
    where date = p_date and revision = p_expected;
  end if;
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;
revoke all on function public.dorm_save_night(date,jsonb,bigint) from public, anon, authenticated;
grant execute on function public.dorm_save_night(date,jsonb,bigint) to service_role;
