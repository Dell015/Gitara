-- Gitara 0007: community (Phase 6).
-- Upvotes on public versions (no down-votes, decided Q47), star ratings on public songs, reports,
-- an admin flag for moderators, saved and shared playlists, suggested edits to song info, and the
-- admin tools (hide, merge duplicates). Counters are kept by the database itself so nobody can
-- fake them, and the admin flag can't be given to yourself.

-- ---------------------------------------------------------------- tamper-proof columns

alter table public.profiles add column is_admin boolean not null default false;
alter table public.versions add column vote_count integer not null default 0;
alter table public.songs add column rating_sum integer not null default 0;
alter table public.songs add column rating_count integer not null default 0;

-- Signed-in users (and guests) run as "authenticated". They can't change these columns; the
-- database's own functions (running as their owner) can.
create or replace function private.protect_counters()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_table_name = 'profiles' then
      new.is_admin := old.is_admin;
    elsif tg_table_name = 'versions' then
      new.vote_count := old.vote_count;
    elsif tg_table_name = 'songs' then
      new.rating_sum := old.rating_sum;
      new.rating_count := old.rating_count;
    end if;
  end if;
  return new;
end $$;

create trigger profiles_protect before update on public.profiles for each row execute function private.protect_counters();
create trigger versions_protect before update on public.versions for each row execute function private.protect_counters();
create trigger songs_protect before update on public.songs for each row execute function private.protect_counters();

-- and new rows always start at zero / not admin
create or replace function private.zero_counters()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_table_name = 'versions' then new.vote_count := 0;
    elsif tg_table_name = 'songs' then new.rating_sum := 0; new.rating_count := 0;
    end if;
  end if;
  return new;
end $$;
create trigger versions_zero before insert on public.versions for each row execute function private.zero_counters();
create trigger songs_zero before insert on public.songs for each row execute function private.zero_counters();

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = (select auth.uid())), false)
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- ---------------------------------------------------------------- votes

create table public.version_votes (
  version_id uuid not null references public.versions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (version_id, user_id)
);
create index version_votes_user on public.version_votes (user_id);
alter table public.version_votes enable row level security;

create policy votes_select_own on public.version_votes for select to authenticated using (user_id = (select auth.uid()));
-- one vote per account, only on public versions, never on your own
create policy votes_insert on public.version_votes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.versions v where v.id = version_id and v.visibility = 'public' and v.author_id is distinct from (select auth.uid()))
  );
create policy votes_delete_own on public.version_votes for delete to authenticated using (user_id = (select auth.uid()));

create or replace function private.count_votes()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.versions set vote_count = (select count(*) from public.version_votes w where w.version_id = coalesce(new.version_id, old.version_id))
  where id = coalesce(new.version_id, old.version_id);
  return null;
end $$;
create trigger version_votes_count after insert or delete on public.version_votes for each row execute function private.count_votes();

-- ---------------------------------------------------------------- ratings (accuracy and quality only)

create table public.song_ratings (
  song_id uuid not null references public.songs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (song_id, user_id)
);
create index song_ratings_user on public.song_ratings (user_id);
alter table public.song_ratings enable row level security;
create trigger song_ratings_updated_at before update on public.song_ratings for each row execute function public.set_updated_at();

create policy ratings_select_own on public.song_ratings for select to authenticated using (user_id = (select auth.uid()));
create policy ratings_insert on public.song_ratings for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.songs s where s.id = song_id and s.visibility = 'public' and s.created_by is distinct from (select auth.uid()))
  );
create policy ratings_update_own on public.song_ratings for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy ratings_delete_own on public.song_ratings for delete to authenticated using (user_id = (select auth.uid()));

create or replace function private.count_ratings()
returns trigger language plpgsql security definer set search_path = '' as $$
declare sid uuid := coalesce(new.song_id, old.song_id);
begin
  update public.songs set
    rating_sum = coalesce((select sum(r.stars) from public.song_ratings r where r.song_id = sid), 0),
    rating_count = (select count(*) from public.song_ratings r where r.song_id = sid)
  where id = sid;
  return null;
end $$;
create trigger song_ratings_count after insert or update or delete on public.song_ratings for each row execute function private.count_ratings();

-- ---------------------------------------------------------------- profile rating (public numbers only)

create or replace function public.profile_stats(uid uuid)
returns table (version_votes bigint, public_versions bigint, public_songs bigint, ratings bigint, rating_avg numeric, public_tracks bigint)
language sql stable security definer set search_path = '' as $$
  select
    coalesce((select sum(v.vote_count) from public.versions v where v.author_id = uid and v.visibility = 'public'), 0),
    (select count(*) from public.versions v where v.author_id = uid and v.visibility = 'public'),
    (select count(*) from public.songs s where s.created_by = uid and s.visibility = 'public'),
    coalesce((select sum(s.rating_count) from public.songs s where s.created_by = uid and s.visibility = 'public'), 0),
    (select round(sum(s.rating_sum)::numeric / nullif(sum(s.rating_count), 0), 2) from public.songs s where s.created_by = uid and s.visibility = 'public'),
    (select count(*) from public.tracks t where t.owner_id = uid and t.visibility = 'public')
$$;
revoke all on function public.profile_stats(uuid) from public, anon;
grant execute on function public.profile_stats(uuid) to authenticated;

-- A profile is visible once its owner has anything public (now including tracks and playlists).
create or replace function private.has_public_content(uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.songs s where s.created_by = uid and s.visibility = 'public')
      or exists (select 1 from public.versions v where v.author_id = uid and v.visibility = 'public')
      or exists (select 1 from public.tracks t where t.owner_id = uid and t.visibility = 'public')
      or exists (select 1 from public.playlists p where p.owner_id = uid and p.visibility = 'public')
$$;

-- Find someone by @handle (to invite them to a playlist). Returns only the public name fields.
create or replace function public.find_profile_by_handle(h text)
returns table (id uuid, handle text, display_name text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.handle, p.display_name from public.profiles p where p.handle = lower(btrim(h)) limit 1
$$;
revoke all on function public.find_profile_by_handle(text) from public, anon;
grant execute on function public.find_profile_by_handle(text) to authenticated;

-- Names of a playlist's members (for the people you share a playlist with).
create or replace function public.playlist_member_names(pid uuid)
returns table (user_id uuid, handle text, display_name text)
language sql stable security definer set search_path = '' as $$
  select m.user_id, p.handle, p.display_name
  from public.playlist_members m join public.profiles p on p.id = m.user_id
  where m.playlist_id = pid and private.can_view_playlist(pid)
$$;
revoke all on function public.playlist_member_names(uuid) from public, anon;
grant execute on function public.playlist_member_names(uuid) to authenticated;

-- ---------------------------------------------------------------- saved playlists

create table public.playlist_saves (
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (playlist_id, user_id)
);
create index playlist_saves_user on public.playlist_saves (user_id);
alter table public.playlist_saves enable row level security;
create policy saves_select_own on public.playlist_saves for select to authenticated using (user_id = (select auth.uid()));
create policy saves_insert on public.playlist_saves for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.playlists p where p.id = playlist_id and p.visibility in ('public', 'unlisted')));
create policy saves_delete_own on public.playlist_saves for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- reports (moderation queue)

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  target_type text not null check (target_type in ('song', 'version', 'track', 'playlist', 'profile')),
  target_id uuid not null,
  reason text not null check (reason in ('wrong_info', 'duplicate', 'spam', 'offensive', 'copyright', 'other')),
  note text check (char_length(note) <= 2000),
  contact text check (char_length(contact) <= 200),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolution text check (char_length(resolution) <= 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index reports_status on public.reports (status, created_at);
create index reports_reporter on public.reports (reporter_id);
alter table public.reports enable row level security;
create policy reports_insert on public.reports for insert to authenticated with check (reporter_id = (select auth.uid()) and status = 'open');
create policy reports_select on public.reports for select to authenticated using (reporter_id = (select auth.uid()) or private.is_admin());
create policy reports_update_admin on public.reports for update to authenticated using (private.is_admin()) with check (private.is_admin());

-- ---------------------------------------------------------------- suggested edits to song info

create table public.song_suggestions (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  patch jsonb not null,
  note text check (char_length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);
create index song_suggestions_song on public.song_suggestions (song_id, status);
create index song_suggestions_user on public.song_suggestions (user_id);
alter table public.song_suggestions enable row level security;
create policy suggestions_insert on public.song_suggestions for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'open' and exists (select 1 from public.songs s where s.id = song_id and s.visibility = 'public'));
-- the suggester, the song's owner and admins can see it; the owner and admins decide
create policy suggestions_select on public.song_suggestions for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin() or exists (select 1 from public.songs s where s.id = song_id and s.created_by = (select auth.uid())));
create policy suggestions_update on public.song_suggestions for update to authenticated
  using (private.is_admin() or exists (select 1 from public.songs s where s.id = song_id and s.created_by = (select auth.uid())))
  with check (private.is_admin() or exists (select 1 from public.songs s where s.id = song_id and s.created_by = (select auth.uid())));

-- ---------------------------------------------------------------- admin tools

-- Hide something that breaks the rules (it becomes private to its owner).
create or replace function public.admin_hide(kind text, target uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'not allowed'; end if;
  if kind = 'song' then update public.songs set visibility = 'private' where id = target;
  elsif kind = 'version' then update public.versions set visibility = 'private' where id = target;
  elsif kind = 'track' then update public.tracks set visibility = 'private' where id = target;
  elsif kind = 'playlist' then update public.playlists set visibility = 'private' where id = target;
  else raise exception 'unknown kind %', kind;
  end if;
end $$;
revoke all on function public.admin_hide(text, uuid) from public, anon;
grant execute on function public.admin_hide(text, uuid) to authenticated;

-- Merge a duplicate song into the one to keep: versions, tracks, library entries, playlist items and
-- ratings move over (where someone has both, the kept one wins), then the duplicate is deleted.
create or replace function public.admin_merge_songs(keep uuid, dupe uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'not allowed'; end if;
  if keep = dupe then raise exception 'same song'; end if;
  update public.versions set song_id = keep where song_id = dupe;
  update public.tracks set song_id = keep where song_id = dupe;
  update public.playlist_items set song_id = keep where song_id = dupe;
  insert into public.library_entries (user_id, song_id, status, can_play, can_sing, created_at)
    select user_id, keep, status, can_play, can_sing, created_at from public.library_entries where song_id = dupe
    on conflict (user_id, song_id) do nothing;
  insert into public.song_ratings (song_id, user_id, stars) select keep, user_id, stars from public.song_ratings where song_id = dupe
    on conflict (song_id, user_id) do nothing;
  update public.song_suggestions set song_id = keep where song_id = dupe;
  delete from public.songs where id = dupe;
end $$;
revoke all on function public.admin_merge_songs(uuid, uuid) from public, anon;
grant execute on function public.admin_merge_songs(uuid, uuid) to authenticated;

-- Possible duplicate public songs (same title and artist once punctuation and "the" are ignored).
create or replace function public.admin_possible_duplicates()
returns table (a uuid, b uuid, title text, artist text)
language sql stable security definer set search_path = '' as $$
  select x.id, y.id, x.title, x.artist
  from public.songs x join public.songs y
    on x.id < y.id
   and regexp_replace(regexp_replace(x.norm_title, '^the ', ''), '[^a-z0-9 ]', '', 'g') = regexp_replace(regexp_replace(y.norm_title, '^the ', ''), '[^a-z0-9 ]', '', 'g')
   and regexp_replace(regexp_replace(x.norm_artist, '^the ', ''), '[^a-z0-9 ]', '', 'g') = regexp_replace(regexp_replace(y.norm_artist, '^the ', ''), '[^a-z0-9 ]', '', 'g')
  where x.visibility = 'public' and y.visibility = 'public' and private.is_admin()
  limit 100
$$;
revoke all on function public.admin_possible_duplicates() from public, anon;
grant execute on function public.admin_possible_duplicates() to authenticated;
