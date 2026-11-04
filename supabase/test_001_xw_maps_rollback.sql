-- Rolled-back test for 001_xw_maps.sql. Run this FIRST, in the Family project's SQL editor.
-- It creates the table inside a DO block and always ends with an exception, so nothing persists.
-- Expected result message (in the error output):
--   RESULT (rolled back): times_played=1 notes=1 bad_row_rejected=t delete_denied=t anon_denied=t

do $$
declare
  rid uuid; tp int; notes_len int;
  constraint_hit boolean := false; delete_denied boolean := false; anon_denied boolean := false;
begin
  execute $sql$
create table if not exists public.xw_maps (
    id            uuid primary key default gen_random_uuid(),
    created_at    timestamptz not null default timezone('utc', now()),
    updated_at    timestamptz not null default timezone('utc', now()),
    level         smallint not null check (level between 1 and 10),
    players       smallint not null check (players between 2 and 4),
    max_opponents smallint not null check (max_opponents = players - 1),
    title         text not null check (char_length(title) between 1 and 80),
    description   text not null default '' check (char_length(description) <= 500),
    rank          smallint check (rank between 1 and 5),
    features      jsonb not null default '[]'::jsonb check (jsonb_typeof(features) = 'array'),
    notes         jsonb not null default '[]'::jsonb check (jsonb_typeof(notes) = 'array'),
    times_played  integer not null default 0 check (times_played >= 0),
    wins          integer not null default 0 check (wins >= 0),
    losses        integer not null default 0 check (losses >= 0),
    map           jsonb not null check (jsonb_typeof(map) = 'object'),
    check (wins + losses <= times_played)
);
alter table public.xw_maps enable row level security;
revoke all on public.xw_maps from anon, authenticated;
grant select, insert, update on public.xw_maps to authenticated;
create policy "Family can read xw_maps" on public.xw_maps for select to authenticated using (true);
create policy "Family can add xw_maps" on public.xw_maps for insert to authenticated with check (true);
create policy "Family can update xw_maps" on public.xw_maps for update to authenticated using (true) with check (true);
insert into public.app_table_registry (app, object_name, object_type, access, description, repo) values
('expansion-wars', 'xw_maps', 'table', 'owner', 'test', 'ShimmyCane/Index');
$sql$;

  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f001","role":"authenticated"}', true);

  insert into public.xw_maps (level, players, max_opponents, title, description, rank, features, map)
  values (1, 2, 1, 'Level 1 test', 'test map', 4, '["2 cities"]', '{"nodes":[],"lakes":[],"links":[]}')
  returning id into rid;

  update public.xw_maps
     set times_played = times_played + 1, wins = wins + 1,
         notes = notes || '[{"at":"2026-11-03T00:00:00Z","text":"test note"}]'::jsonb
   where id = rid;

  select times_played, jsonb_array_length(notes) into tp, notes_len from public.xw_maps where id = rid;

  begin
    insert into public.xw_maps (level, players, max_opponents, title, map, times_played, wins, losses)
    values (2, 3, 2, 'bad row', '{}', 1, 1, 1);
  exception when check_violation then constraint_hit := true;
  end;

  begin
    delete from public.xw_maps where id = rid;
  exception when insufficient_privilege then delete_denied := true;
  end;

  reset role;
  set local role anon;
  begin
    perform 1 from public.xw_maps;
  exception when insufficient_privilege then anon_denied := true;
  end;
  reset role;

  raise exception 'RESULT (rolled back): times_played=% notes=% bad_row_rejected=% delete_denied=% anon_denied=%',
    tp, notes_len, constraint_hit, delete_denied, anon_denied;
end $$;
