-- Gitara 0001: core schema for Phases 0-2.
-- Profiles, instruments, songs, versions (chord charts), chord shapes, library, playlists.
-- Votes, ratings, reports, follows, tracks and jams come in later migrations.
--
-- Everything is private by default. Row-level security (RLS) is on for every table; the browser
-- uses the publishable key, so these policies ARE the security model.
--
-- BEFORE PUBLIC LAUNCH: decide whether guest (anonymous) accounts may publish. Right now they can,
-- so you and your cousin can test public features. See the TODO near the songs policies.

-- ------------------------------------------------------------------ types

create type public.visibility as enum ('private', 'unlisted', 'public');
create type public.learn_status as enum ('planning', 'learning', 'performing');

-- --------------------------------------------------------------- helpers

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- profiles

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text check (char_length(display_name) <= 40),
  avatar_url text,
  bio text check (char_length(bio) <= 280),
  -- What the owner chose to show publicly. Everything is off until they turn it on.
  public_sections jsonb not null
    default '{"planning": false, "learning": false, "performing": false, "rating": false}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Every new auth user (including guests) gets a profile row.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------------------- instruments

create table public.instruments (
  id text primary key,
  name text not null,
  strings smallint not null check (strings between 3 and 12),
  frets smallint not null check (frets between 0 and 36),
  default_tuning smallint[] not null,
  check (cardinality(default_tuning) = strings)
);

insert into public.instruments (id, name, strings, frets, default_tuning)
values ('guitar', 'Guitar', 6, 24, '{40,45,50,55,59,64}');

-- ------------------------------------------------------------------- songs

create table public.songs (
  id uuid primary key default gen_random_uuid(),
  -- null = the author deleted their account; the song stays, shown as "deleted user"
  created_by uuid references public.profiles (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  artist text not null check (char_length(artist) between 1 and 200),
  album text,
  release_year smallint check (release_year between 1000 and 2200),
  genre text,
  tags text[] not null default '{}',
  original_key text,
  original_bpm smallint check (original_bpm between 20 and 400),
  time_signature text not null default '4/4' check (time_signature ~ '^[0-9]{1,2}/(1|2|4|8|16)$'),
  duration_sec integer check (duration_sec > 0),
  youtube_url text,
  spotify_url text,
  musicbrainz_id uuid,
  visibility public.visibility not null default 'private'
    check (visibility in ('private', 'public')),
  -- normalized title/artist, used to refuse a second public entry for the same song
  norm_title text generated always as (lower(regexp_replace(btrim(title), '\s+', ' ', 'g'))) stored,
  norm_artist text generated always as (lower(regexp_replace(btrim(artist), '\s+', ' ', 'g'))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Same title + artist can exist only once publicly: add a version to it instead (Q135).
create unique index songs_public_title_artist on public.songs (norm_title, norm_artist)
  where visibility = 'public';
create index songs_created_by on public.songs (created_by);
create index songs_search on public.songs (norm_artist, norm_title);

create trigger songs_updated_at before update on public.songs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- versions

create table public.versions (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  -- the version this was copied from; keeps the credit
  based_on uuid references public.versions (id) on delete set null,
  instrument_id text not null default 'guitar' references public.instruments (id),
  tuning smallint[] not null,
  capo smallint not null default 0 check (capo between 0 and 12),
  key_played text,
  bpm smallint check (bpm between 20 and 400),
  time_signature text check (time_signature ~ '^[0-9]{1,2}/(1|2|4|8|16)$'),
  techniques text[] not null default '{}',
  -- the chart: { "sections": [...], "arrangement": [...] } (see src/core/model.ts)
  content jsonb not null default '{"sections": [], "arrangement": []}'::jsonb,
  -- hash of canonical content + tuning + capo, computed by the app
  content_hash text,
  -- computed by the system from the chart, never typed in (Q21)
  difficulty_score smallint check (difficulty_score between 0 and 100),
  difficulty_level text check (difficulty_level in ('beginner', 'intermediate', 'advanced')),
  visibility public.visibility not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If everything is exactly the same as an existing public version, publishing is denied (Q22).
-- Anything different is allowed and the votes decide which is better.
create unique index versions_public_exact_duplicate
  on public.versions (song_id, content_hash, tuning, capo)
  where visibility = 'public' and content_hash is not null;
create index versions_song on public.versions (song_id);
create index versions_author on public.versions (author_id);

create trigger versions_updated_at before update on public.versions
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------ shapes

-- One way to play a chord ("voicing"). Arrays: one entry per string, lowest string first.
-- frets: -1 = muted, 0 = open. fingers: 0 = none, 1-4 = fingers, 5 = thumb.
create table public.shapes (
  id uuid primary key default gen_random_uuid(),
  instrument_id text not null default 'guitar' references public.instruments (id),
  created_by uuid references public.profiles (id) on delete set null, -- null = built-in
  name text, -- derived from the notes; null if a custom shape hasn't been named
  frets smallint[] not null,
  fingers smallint[],
  base_fret smallint not null default 1 check (base_fret between 1 and 36),
  visibility public.visibility not null default 'private' check (visibility in ('private', 'public')),
  created_at timestamptz not null default now(),
  check (cardinality(fingers) is null or cardinality(fingers) = cardinality(frets))
);

create index shapes_name on public.shapes (name);
create index shapes_created_by on public.shapes (created_by);

-- ----------------------------------------------------------------- library

create table public.library_entries (
  user_id uuid not null references public.profiles (id) on delete cascade,
  song_id uuid not null references public.songs (id) on delete cascade,
  status public.learn_status not null default 'planning',
  can_play text[] not null default '{}' check (can_play <@ array['chords', 'lead', 'solo']),
  can_sing boolean not null default false,
  preferred_version_id uuid references public.versions (id) on delete set null,
  started_learning_at timestamptz,
  started_performing_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, song_id)
);

create index library_entries_song on public.library_entries (song_id);

create trigger library_entries_updated_at before update on public.library_entries
  for each row execute function public.set_updated_at();

-- Dates are recorded automatically when a song first reaches Learning / Performing.
create function public.apply_status_dates()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'learning' and new.started_learning_at is null
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.started_learning_at = now();
  end if;
  if new.status = 'performing' and new.started_performing_at is null
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.started_performing_at = now();
  end if;
  return new;
end;
$$;

create trigger library_entries_status_dates before insert or update on public.library_entries
  for each row execute function public.apply_status_dates();

-- --------------------------------------------------------------- playlists

create table public.playlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  description text check (char_length(description) <= 500),
  visibility public.visibility not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index playlists_owner on public.playlists (owner_id);

create trigger playlists_updated_at before update on public.playlists
  for each row execute function public.set_updated_at();

create table public.playlist_members (
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'editor' check (role in ('editor')),
  created_at timestamptz not null default now(),
  primary key (playlist_id, user_id)
);

create index playlist_members_user on public.playlist_members (user_id);

create table public.playlist_items (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  song_id uuid not null references public.songs (id) on delete cascade,
  -- optional: pin a specific version ("my capo 2 version")
  version_id uuid references public.versions (id) on delete set null,
  position integer not null check (position >= 0),
  note text check (char_length(note) <= 300),
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- deferrable so a reorder can swap positions inside one transaction
  unique (playlist_id, position) deferrable initially deferred
);

create index playlist_items_playlist on public.playlist_items (playlist_id);
create index playlist_items_song on public.playlist_items (song_id);

-- ---------------------------------------------------- policy helper functions
-- security definer so policies can look across tables without recursing into each other's RLS.

create function public.is_playlist_owner(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.playlists p where p.id = pid and p.owner_id = (select auth.uid())
  );
$$;

create function public.is_playlist_editor(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.playlists p where p.id = pid and p.owner_id = (select auth.uid())
  ) or exists (
    select 1 from public.playlist_members m where m.playlist_id = pid and m.user_id = (select auth.uid())
  );
$$;

create function public.can_view_playlist(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.playlists p
    where p.id = pid
      and (p.visibility in ('public', 'unlisted') or p.owner_id = (select auth.uid()))
  ) or exists (
    select 1 from public.playlist_members m where m.playlist_id = pid and m.user_id = (select auth.uid())
  );
$$;

-- Has this person published anything? Only then is their profile visible to others.
create function public.has_public_content(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.songs s where s.created_by = uid and s.visibility = 'public')
      or exists (select 1 from public.versions v where v.author_id = uid and v.visibility = 'public');
$$;

-- Has this person chosen to show this learning-status section on their public profile?
create function public.section_is_public(uid uuid, st public.learn_status)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select (p.public_sections ->> st::text)::boolean from public.profiles p where p.id = uid),
    false
  );
$$;

revoke all on function
  public.is_playlist_owner(uuid),
  public.is_playlist_editor(uuid),
  public.can_view_playlist(uuid),
  public.has_public_content(uuid),
  public.section_is_public(uuid, public.learn_status),
  public.handle_new_user()
from public, anon;

grant execute on function
  public.is_playlist_owner(uuid),
  public.is_playlist_editor(uuid),
  public.can_view_playlist(uuid),
  public.has_public_content(uuid),
  public.section_is_public(uuid, public.learn_status)
to authenticated;

-- ---------------------------------------------------- row-level security

alter table public.profiles enable row level security;
alter table public.instruments enable row level security;
alter table public.songs enable row level security;
alter table public.versions enable row level security;
alter table public.shapes enable row level security;
alter table public.library_entries enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_members enable row level security;
alter table public.playlist_items enable row level security;

-- profiles: your own, plus people who have published something (so bylines work). Profiles are
-- created by the trigger above, so there is no insert or delete policy.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.has_public_content(id));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- instruments: readable by everyone signed in; changed only by migrations
create policy instruments_select on public.instruments for select to authenticated using (true);

-- songs: public ones are readable by all, private ones only by their author.
-- TODO before public launch: consider requiring a real (non-anonymous) account to publish, e.g.
--   and coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false) = false
-- on the insert/update checks when visibility = 'public'.
create policy songs_select on public.songs for select to authenticated
  using (visibility = 'public' or created_by = (select auth.uid()));
create policy songs_insert on public.songs for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy songs_update_own on public.songs for update to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));
create policy songs_delete_own on public.songs for delete to authenticated
  using (created_by = (select auth.uid()));

-- versions: public and unlisted are readable (unlisted = anyone with the link; it is simply not
-- listed in search); private only by the author. You may only attach a version to a song you can see,
-- and a public version needs a public song.
create policy versions_select on public.versions for select to authenticated
  using (visibility in ('public', 'unlisted') or author_id = (select auth.uid()));
create policy versions_insert on public.versions for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.songs s where s.id = song_id)
    and (visibility = 'private'
         or exists (select 1 from public.songs s where s.id = song_id and s.visibility = 'public'))
  );
create policy versions_update_own on public.versions for update to authenticated
  using (author_id = (select auth.uid()))
  with check (
    author_id = (select auth.uid())
    and (visibility = 'private'
         or exists (select 1 from public.songs s where s.id = song_id and s.visibility = 'public'))
  );
create policy versions_delete_own on public.versions for delete to authenticated
  using (author_id = (select auth.uid()));

-- shapes: built-in (created_by is null) and public shapes are readable; custom ones are yours.
create policy shapes_select on public.shapes for select to authenticated
  using (visibility = 'public' or created_by = (select auth.uid()));
create policy shapes_insert on public.shapes for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy shapes_update_own on public.shapes for update to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));
create policy shapes_delete_own on public.shapes for delete to authenticated
  using (created_by = (select auth.uid()));

-- library: yours, plus any status section you chose to show publicly
create policy library_select on public.library_entries for select to authenticated
  using (user_id = (select auth.uid()) or public.section_is_public(user_id, status));
create policy library_insert_own on public.library_entries for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.songs s where s.id = song_id)
  );
create policy library_update_own on public.library_entries for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy library_delete_own on public.library_entries for delete to authenticated
  using (user_id = (select auth.uid()));

-- playlists
create policy playlists_select on public.playlists for select to authenticated
  using (visibility in ('public', 'unlisted') or owner_id = (select auth.uid())
         or public.is_playlist_editor(id));
create policy playlists_insert on public.playlists for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy playlists_update_own on public.playlists for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy playlists_delete_own on public.playlists for delete to authenticated
  using (owner_id = (select auth.uid()));

-- playlist members: the owner manages them; a member can see their own row and leave
create policy playlist_members_select on public.playlist_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_playlist_owner(playlist_id));
create policy playlist_members_insert on public.playlist_members for insert to authenticated
  with check (public.is_playlist_owner(playlist_id));
create policy playlist_members_delete on public.playlist_members for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_playlist_owner(playlist_id));

-- playlist items: viewable if the playlist is; editable by the owner and invited editors
create policy playlist_items_select on public.playlist_items for select to authenticated
  using (public.can_view_playlist(playlist_id));
create policy playlist_items_insert on public.playlist_items for insert to authenticated
  with check (public.is_playlist_editor(playlist_id) and added_by = (select auth.uid()));
create policy playlist_items_update on public.playlist_items for update to authenticated
  using (public.is_playlist_editor(playlist_id))
  with check (public.is_playlist_editor(playlist_id));
create policy playlist_items_delete on public.playlist_items for delete to authenticated
  using (public.is_playlist_editor(playlist_id));
