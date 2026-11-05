-- Rollback test for 004_xw_worlds.sql. Run in one execute_sql call.
-- Creates the table, checks the family can add a world, save it again (upsert) and read it, that anon is refused,
-- that delete is refused and a bad scale is rejected, then raises so nothing persists.
do $$
declare
  n_auth int;
  saved_turn int;
  anon_denied boolean := false;
  delete_denied boolean := false;
  bad_scale_rejected boolean := false;
  wid uuid := '00000000-0000-4000-8000-000000000004';
begin
  -- the same statements as 004_xw_worlds.sql, minus the registry insert
  create table public.xw_worlds (
    id uuid primary key,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    app text not null default 'combined' check (char_length(app) <= 20),
    version integer not null default 1 check (version >= 1),
    seed bigint not null check (seed >= 0),
    turn integer not null default 1 check (turn >= 1),
    scale text not null default 'country' check (scale in ('country', 'province', 'unit')),
    provinces integer not null default 0 check (provinces >= 0),
    over text not null default '' check (over in ('', 'won', 'lost')),
    name text not null default '' check (char_length(name) <= 60),
    data jsonb not null check (jsonb_typeof(data) = 'object')
  );
  create index xw_worlds_updated_idx on public.xw_worlds (app, updated_at desc);
  alter table public.xw_worlds enable row level security;
  revoke all on public.xw_worlds from anon, authenticated;
  grant select, insert, update on public.xw_worlds to authenticated;
  create policy "Family can read xw_worlds" on public.xw_worlds for select to authenticated using (true);
  create policy "Family can add xw_worlds" on public.xw_worlds for insert to authenticated with check (true);
  create policy "Family can save xw_worlds" on public.xw_worlds for update to authenticated using (true) with check (true);

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
  -- first save, then the same world saved again later (the app's upsert)
  insert into public.xw_worlds (id, seed, turn, scale, provinces, name, data)
    values (wid, 880406, 1, 'country', 3, 'Your nation', '{"seed":880406,"time":{"turn":1}}');
  insert into public.xw_worlds (id, seed, turn, scale, provinces, name, data)
    values (wid, 880406, 7, 'unit', 5, 'Your nation', '{"seed":880406,"time":{"turn":7}}')
    on conflict (id) do update set turn = excluded.turn, scale = excluded.scale, provinces = excluded.provinces,
      data = excluded.data, updated_at = timezone('utc', now());
  select count(*), max(turn) into n_auth, saved_turn from public.xw_worlds;
  begin
    delete from public.xw_worlds where id = wid;
  exception when insufficient_privilege then
    delete_denied := true;
  end;
  begin
    insert into public.xw_worlds (id, seed, scale, data) values (gen_random_uuid(), 1, 'galaxy', '{}');
  exception when check_violation then bad_scale_rejected := true;
  end;
  reset role;

  set local role anon;
  begin
    perform count(*) from public.xw_worlds;
  exception when insufficient_privilege then
    anon_denied := true;
  end;
  reset role;

  raise exception 'RESULT (rolled back): family_rows=% saved_turn=% anon_denied=% delete_denied=% bad_scale_rejected=%',
    n_auth, saved_turn, anon_denied, delete_denied, bad_scale_rejected;
end $$;
