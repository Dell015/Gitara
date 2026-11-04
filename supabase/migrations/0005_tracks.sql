-- Gitara 0005: backing tracks (Phase 4, track maker v1). A track is the drum/loop patterns you
-- play along with. It can belong to a song (optional) and is private, unlisted or public.
-- The patterns live in `content` (JSON), like a version's chart.

create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles (id) on delete set null,
  song_id uuid references public.songs (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  bpm smallint not null check (bpm between 20 and 400),
  time_signature text not null default '4/4' check (time_signature ~ '^[0-9]{1,2}/(1|2|4|8|16)$'),
  swing real not null default 0 check (swing between 0 and 0.6),
  content jsonb not null default '{"patterns": []}'::jsonb,
  visibility public.visibility not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tracks_owner on public.tracks (owner_id);
create index tracks_song on public.tracks (song_id);
create trigger tracks_updated_at before update on public.tracks
  for each row execute function public.set_updated_at();

alter table public.tracks enable row level security;

create policy tracks_select on public.tracks for select to authenticated
  using (visibility in ('public', 'unlisted') or owner_id = (select auth.uid()));
-- A shared track on a song needs that song to be public (same rule as versions).
create policy tracks_insert on public.tracks for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (visibility = 'private' or song_id is null
         or exists (select 1 from public.songs s where s.id = song_id and s.visibility = 'public'))
  );
create policy tracks_update_own on public.tracks for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and (visibility = 'private' or song_id is null
         or exists (select 1 from public.songs s where s.id = song_id and s.visibility = 'public'))
  );
create policy tracks_delete_own on public.tracks for delete to authenticated
  using (owner_id = (select auth.uid()));
