-- Expansion Wars: saved maps and their play records (Family Supabase project).
-- Migration name for apply_migration: xw_maps
-- Tested first in a rolled-back transaction; see test_001_xw_maps_rollback.sql.
--
-- Access: signed-in family account only (same pattern as fmz_* in Felix Maze).
-- anon has no access. No delete from the app; a map is retired by editing it.

create table if not exists public.xw_maps (
    id            uuid primary key default gen_random_uuid(),
    created_at    timestamptz not null default timezone('utc', now()),
    updated_at    timestamptz not null default timezone('utc', now()),
    level         smallint not null check (level between 1 and 10),
    players       smallint not null check (players between 2 and 4),
    max_opponents smallint not null check (max_opponents = players - 1),
    title         text not null check (char_length(title) between 1 and 80),
    description   text not null default '' check (char_length(description) <= 500),
    rank          smallint check (rank between 1 and 5),          -- player rating, 1 to 5 stars
    features      jsonb not null default '[]'::jsonb check (jsonb_typeof(features) = 'array'),
    notes         jsonb not null default '[]'::jsonb check (jsonb_typeof(notes) = 'array'),  -- [{at, text}] improvement notes logged during play
    times_played  integer not null default 0 check (times_played >= 0),
    wins          integer not null default 0 check (wins >= 0),
    losses        integer not null default 0 check (losses >= 0),
    map           jsonb not null check (jsonb_typeof(map) = 'object'),  -- spots, lakes, roads, starts
    check (wins + losses <= times_played)
);

comment on table public.xw_maps is
    'Expansion Wars maps: every generated map with its level, features, description, rating, play and win counts, and improvement notes. Win rate = wins / times_played.';

alter table public.xw_maps enable row level security;

revoke all on public.xw_maps from anon, authenticated;
grant select, insert, update on public.xw_maps to authenticated;

drop policy if exists "Family can read xw_maps" on public.xw_maps;
create policy "Family can read xw_maps"
    on public.xw_maps for select to authenticated using (true);

drop policy if exists "Family can add xw_maps" on public.xw_maps;
create policy "Family can add xw_maps"
    on public.xw_maps for insert to authenticated with check (true);

drop policy if exists "Family can update xw_maps" on public.xw_maps;
create policy "Family can update xw_maps"
    on public.xw_maps for update to authenticated using (true) with check (true);

insert into public.app_table_registry (app, object_name, object_type, access, description, repo) values
('expansion-wars', 'xw_maps', 'table', 'owner',
 'Saved Expansion Wars maps: level, features, description, rating, play and win counts, improvement notes, map geometry.',
 'ShimmyCane/Index')
on conflict (app, object_name) do nothing;

-- Check: must be empty, or list only other apps' unclaimed tables.
-- select * from public.app_table_unregistered;
