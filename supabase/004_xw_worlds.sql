-- Expansion Wars: combined-scale worlds (Family Supabase project).
-- Migration name for apply_migration: xw_worlds
-- Tested first in a rolled-back transaction; see test_004_xw_worlds_rollback.sql.
--
-- Access: signed-in family account only (same pattern as xw_maps, xw_notes and xw_replays).
-- anon has no access. No delete from the app.
-- One row per world. data is the whole world (combined/js/world/state.js describes its shape); the other columns are
-- copies of a few of its values so worlds can be listed without reading data. The app writes the whole row each time
-- (an upsert on id), so a row is always one consistent snapshot of a world.

create table if not exists public.xw_worlds (
    id          uuid primary key,
    created_at  timestamptz not null default timezone('utc', now()),
    updated_at  timestamptz not null default timezone('utc', now()),
    app         text not null default 'combined' check (char_length(app) <= 20),
    version     integer not null default 1 check (version >= 1),
    seed        bigint not null check (seed >= 0),
    turn        integer not null default 1 check (turn >= 1),
    scale       text not null default 'country' check (scale in ('country', 'province', 'unit')),
    provinces   integer not null default 0 check (provinces >= 0),
    over        text not null default '' check (over in ('', 'won', 'lost')),
    name        text not null default '' check (char_length(name) <= 60),
    data        jsonb not null check (jsonb_typeof(data) = 'object')
);

create index if not exists xw_worlds_updated_idx on public.xw_worlds (app, updated_at desc);

comment on table public.xw_worlds is
    'Expansion Wars combined-scale worlds: the whole world as JSON (data), written whole on every save, one row per world.';

alter table public.xw_worlds enable row level security;

revoke all on public.xw_worlds from anon, authenticated;
grant select, insert, update on public.xw_worlds to authenticated;

drop policy if exists "Family can read xw_worlds" on public.xw_worlds;
create policy "Family can read xw_worlds"
    on public.xw_worlds for select to authenticated using (true);

drop policy if exists "Family can add xw_worlds" on public.xw_worlds;
create policy "Family can add xw_worlds"
    on public.xw_worlds for insert to authenticated with check (true);

drop policy if exists "Family can save xw_worlds" on public.xw_worlds;
create policy "Family can save xw_worlds"
    on public.xw_worlds for update to authenticated using (true) with check (true);

insert into public.app_table_registry (app, object_name, object_type, access, description, repo) values
('expansion-wars', 'xw_worlds', 'table', 'owner',
 'Expansion Wars combined-scale worlds: the whole world as JSON, one row per world, written whole on every save.',
 'ShimmyCane/Expansion-Wars')
on conflict (app, object_name) do nothing;
