-- Rollback test for 003_xw_replays.sql. Run in one execute_sql call.
-- Creates the table, checks the family can write and read, that anon is refused,
-- and that an update is refused (replays are never edited), then raises so nothing persists.
do $$
declare
  n_auth int;
  anon_denied boolean := false;
  update_denied boolean := false;
  bad_scale_rejected boolean := false;
  rid uuid;
begin
  -- the same statements as 003_xw_replays.sql, minus the registry insert
  create table public.xw_replays (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default timezone('utc', now()),
    app text not null default 'v4' check (char_length(app) <= 20),
    version text not null default '' check (char_length(version) <= 40),
    scale text not null check (scale in ('village', 'fortress', 'country')),
    seed bigint not null check (seed >= 0),
    mode text not null default 'play' check (mode in ('play', 'auto')),
    request jsonb not null check (jsonb_typeof(request) = 'object'),
    commands jsonb not null default '[]'::jsonb check (jsonb_typeof(commands) = 'array'),
    result jsonb not null check (jsonb_typeof(result) = 'object'),
    winner text check (winner in ('attacker', 'defender')),
    how text not null default '' check (char_length(how) <= 20),
    seconds integer not null default 0 check (seconds >= 0)
  );
  alter table public.xw_replays enable row level security;
  revoke all on public.xw_replays from anon, authenticated;
  grant select, insert on public.xw_replays to authenticated;
  create policy "Family can read xw_replays" on public.xw_replays for select to authenticated using (true);
  create policy "Family can add xw_replays" on public.xw_replays for insert to authenticated with check (true);

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
  insert into public.xw_replays (scale, seed, mode, request, commands, result, winner, how, seconds)
    values ('fortress', 555, 'play', '{"seed":555}', '[{"tick":0,"cmd":{"kind":"place"}}]', '{"winner":"defender"}', 'defender', 'surrender', 4)
    returning id into rid;
  select count(*) into n_auth from public.xw_replays;
  begin
    update public.xw_replays set how = 'edited' where id = rid;
  exception when insufficient_privilege then
    update_denied := true;
  end;
  begin
    insert into public.xw_replays (scale, seed, request, result)
      values ('galaxy', 1, '{}', '{}');
  exception when check_violation then bad_scale_rejected := true;
  end;
  reset role;

  set local role anon;
  begin
    perform count(*) from public.xw_replays;
  exception when insufficient_privilege then
    anon_denied := true;
  end;
  reset role;

  raise exception 'RESULT (rolled back): family_rows=% anon_denied=% update_denied=% bad_scale_rejected=%',
    n_auth, anon_denied, update_denied, bad_scale_rejected;
end $$;
