-- Expansion Wars: notes for improvement from the ⚙️ panel, for the Family database.
-- Migration name for apply_migration: xw_notes
-- Tested first in a rolled-back transaction; see test_002_xw_notes_rollback.sql.
--
-- Access: signed-in family account only (same pattern as xw_maps and fish_notes).
-- anon has no access. No delete from the app; a note is closed by setting status to done.

create table if not exists public.xw_notes (
    id          uuid primary key default gen_random_uuid(),
    created_at  timestamptz not null default timezone('utc', now()),
    at          timestamptz not null,                                  -- when the note was written on the device
    text        text not null check (char_length(text) between 1 and 500),
    status      text not null default 'open' check (status in ('open', 'done')),
    page        text not null default '' check (char_length(page) <= 80),    -- screen the note was written on
    label       text not null default '' check (char_length(label) <= 120),  -- what was on screen
    version     text not null default '' check (char_length(version) <= 40)
);

comment on table public.xw_notes is
    'Expansion Wars notes for improvement: text, open or done, the screen it was written on, and the app version.';

alter table public.xw_notes enable row level security;

revoke all on public.xw_notes from anon, authenticated;
grant select, insert, update on public.xw_notes to authenticated;

drop policy if exists "Family can read xw_notes" on public.xw_notes;
create policy "Family can read xw_notes"
    on public.xw_notes for select to authenticated using (true);

drop policy if exists "Family can add xw_notes" on public.xw_notes;
create policy "Family can add xw_notes"
    on public.xw_notes for insert to authenticated with check (true);

drop policy if exists "Family can update xw_notes" on public.xw_notes;
create policy "Family can update xw_notes"
    on public.xw_notes for update to authenticated using (true) with check (true);

insert into public.app_table_registry (app, object_name, object_type, access, description, repo) values
('expansion-wars', 'xw_notes', 'table', 'owner',
 'Expansion Wars notes for improvement written from the settings panel: text, open or done, screen, label, version.',
 'ShimmyCane/Expansion-Wars')
on conflict (app, object_name) do nothing;
