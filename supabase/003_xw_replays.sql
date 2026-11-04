-- Expansion Wars: custom battle replays (Family Supabase project).
-- Migration name for apply_migration: xw_replays
-- Tested first in a rolled-back transaction; see test_003_xw_replays_rollback.sql.
--
-- Access: signed-in family account only (same pattern as xw_maps and xw_notes).
-- anon has no access. No delete from the app.
-- A replay is the battle request, every order with the tick it was given on, and the result.
-- Feeding request and commands to V4.replay reproduces the battle exactly.

create table if not exists public.xw_replays (
    id          uuid primary key default gen_random_uuid(),
    created_at  timestamptz not null default timezone('utc', now()),
    app         text not null default 'v4' check (char_length(app) <= 20),
    version     text not null default '' check (char_length(version) <= 40),
    scale       text not null check (scale in ('village', 'fortress', 'country')),
    seed        bigint not null check (seed >= 0),
    mode        text not null default 'play' check (mode in ('play', 'auto')),
    request     jsonb not null check (jsonb_typeof(request) = 'object'),
    commands    jsonb not null default '[]'::jsonb check (jsonb_typeof(commands) = 'array'),
    result      jsonb not null check (jsonb_typeof(result) = 'object'),
    winner      text check (winner in ('attacker', 'defender')),
    how         text not null default '' check (char_length(how) <= 20),
    seconds     integer not null default 0 check (seconds >= 0)
);

comment on table public.xw_replays is
    'Expansion Wars custom battle replays: the request, every order with its tick, and the result. Replaying the request and orders reproduces the battle.';

alter table public.xw_replays enable row level security;

revoke all on public.xw_replays from anon, authenticated;
grant select, insert on public.xw_replays to authenticated;

drop policy if exists "Family can read xw_replays" on public.xw_replays;
create policy "Family can read xw_replays"
    on public.xw_replays for select to authenticated using (true);

drop policy if exists "Family can add xw_replays" on public.xw_replays;
create policy "Family can add xw_replays"
    on public.xw_replays for insert to authenticated with check (true);

insert into public.app_table_registry (app, object_name, object_type, access, description, repo) values
('expansion-wars', 'xw_replays', 'table', 'owner',
 'Expansion Wars custom battle replays: request, orders with ticks, and result. Reproduces the battle.',
 'ShimmyCane/Expansion-Wars')
on conflict (app, object_name) do nothing;
