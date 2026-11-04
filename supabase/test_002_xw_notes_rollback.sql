-- Rollback test for 002_xw_notes.sql. Run in one execute_sql call.
-- Creates the table, checks the family can write and read, and that anon is refused,
-- then raises so nothing persists. Returns the results inside the error message.
do $$
declare
  n_auth int;
  anon_blocked boolean := false;
begin
  -- the same statements as 002_xw_notes.sql, minus the registry insert
  create table public.xw_notes (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default timezone('utc', now()),
    at timestamptz not null,
    text text not null check (char_length(text) between 1 and 500),
    status text not null default 'open' check (status in ('open', 'done')),
    page text not null default '' check (char_length(page) <= 80),
    label text not null default '' check (char_length(label) <= 120),
    version text not null default '' check (char_length(version) <= 40)
  );
  alter table public.xw_notes enable row level security;
  revoke all on public.xw_notes from anon, authenticated;
  grant select, insert, update on public.xw_notes to authenticated;
  create policy "Family can read xw_notes" on public.xw_notes for select to authenticated using (true);
  create policy "Family can add xw_notes" on public.xw_notes for insert to authenticated with check (true);
  create policy "Family can update xw_notes" on public.xw_notes for update to authenticated using (true) with check (true);

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
  insert into public.xw_notes (at, text, status, page, label, version)
    values (now(), 'rollback test', 'open', 'screen-country', 'Your nation', '2.0');
  select count(*) into n_auth from public.xw_notes;
  reset role;

  set local role anon;
  begin
    perform count(*) from public.xw_notes;
  exception when insufficient_privilege then
    anon_blocked := true;
  end;
  reset role;

  raise exception 'RESULT: authenticated rows=%, anon blocked=%', n_auth, anon_blocked;
end $$;
