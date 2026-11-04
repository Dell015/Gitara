-- Gitara 0009: versions grouped by part, ratings and learning status per version.
--  * every version is a Rhythm, Lead, Solo or Fingerstyle take (existing ones become Rhythm, fingerstyle-tagged ones Fingerstyle)
--  * star ratings move from the song to each version (replacing the up-vote); the old tables are kept but no longer used
--  * Learning / Performing is kept per version (version_progress); the song's own status in library_entries is only a cache
--    of "furthest" and "all statuses" for lists and profiles
--  * a version can carry its own reference video

-- ---------------------------------------------------------------- versions

alter table public.versions add column part text not null default 'rhythm'
  check (part in ('rhythm', 'lead', 'solo', 'fingerstyle'));
alter table public.versions add column youtube_url text check (char_length(youtube_url) <= 300);
alter table public.versions add column rating_sum integer not null default 0;
alter table public.versions add column rating_count integer not null default 0;
update public.versions set part = 'fingerstyle' where 'fingerstyle' = any (tags);
create index versions_song_part on public.versions (song_id, part);

-- counters can't be edited by users (as for vote_count and the song ratings)
create or replace function private.protect_counters()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_table_name = 'profiles' then
      new.is_admin := old.is_admin;
    elsif tg_table_name = 'versions' then
      new.vote_count := old.vote_count;
      new.rating_sum := old.rating_sum;
      new.rating_count := old.rating_count;
    elsif tg_table_name = 'songs' then
      new.rating_sum := old.rating_sum;
      new.rating_count := old.rating_count;
    end if;
  end if;
  return new;
end $$;

create or replace function private.zero_counters()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_table_name = 'versions' then new.vote_count := 0; new.rating_sum := 0; new.rating_count := 0;
    elsif tg_table_name = 'songs' then new.rating_sum := 0; new.rating_count := 0;
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- ratings on versions

create table public.version_ratings (
  version_id uuid not null references public.versions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (version_id, user_id)
);
create index version_ratings_user on public.version_ratings (user_id);
alter table public.version_ratings enable row level security;
create trigger version_ratings_updated_at before update on public.version_ratings for each row execute function public.set_updated_at();

create policy vratings_select_own on public.version_ratings for select to authenticated using (user_id = (select auth.uid()));
-- one rating per account, only on public versions, never on your own
create policy vratings_insert on public.version_ratings for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.versions v where v.id = version_id and v.visibility = 'public' and v.author_id is distinct from (select auth.uid()))
  );
create policy vratings_update_own on public.version_ratings for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy vratings_delete_own on public.version_ratings for delete to authenticated using (user_id = (select auth.uid()));

create or replace function private.count_version_ratings()
returns trigger language plpgsql security definer set search_path = '' as $$
declare vid uuid := coalesce(new.version_id, old.version_id);
begin
  update public.versions set
    rating_sum = coalesce((select sum(r.stars) from public.version_ratings r where r.version_id = vid), 0),
    rating_count = (select count(*) from public.version_ratings r where r.version_id = vid)
  where id = vid;
  return null;
end $$;
create trigger version_ratings_count after insert or update or delete on public.version_ratings
  for each row execute function private.count_version_ratings();

-- ---------------------------------------------------------------- learning status per version

create table public.version_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  version_id uuid not null references public.versions (id) on delete cascade,
  song_id uuid not null references public.songs (id) on delete cascade,
  status public.learn_status not null,
  started_learning_at timestamptz,
  started_performing_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, version_id)
);
create index version_progress_song on public.version_progress (user_id, song_id);
create index version_progress_version on public.version_progress (version_id);
alter table public.version_progress enable row level security;
create trigger version_progress_updated_at before update on public.version_progress for each row execute function public.set_updated_at();
-- dates are recorded automatically the first time a version reaches Learning / Performing (same rule as library_entries)
create trigger version_progress_status_dates before insert or update on public.version_progress
  for each row execute function public.apply_status_dates();

create policy vprogress_select_own on public.version_progress for select to authenticated using (user_id = (select auth.uid()));
create policy vprogress_insert_own on public.version_progress for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.versions v where v.id = version_id and v.song_id = version_progress.song_id)
  );
create policy vprogress_update_own on public.version_progress for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy vprogress_delete_own on public.version_progress for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- the song's status, as a cache

alter table public.library_entries add column statuses public.learn_status[] not null default '{}';
update public.library_entries set statuses = array[status] where status is not null;

-- a status section you chose to show publicly shows every song that has a version in that state
drop policy library_select on public.library_entries;
create policy library_select on public.library_entries for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.section_is_public(user_id, status)
    or exists (select 1 from unnest(statuses) st where private.section_is_public(user_id, st))
  );

-- ---------------------------------------------------------------- profile numbers now come from version ratings

create or replace function public.profile_stats(uid uuid)
returns table (version_votes bigint, public_versions bigint, public_songs bigint, ratings bigint, rating_avg numeric, public_tracks bigint)
language sql stable security definer set search_path = '' as $$
  select
    0::bigint,
    (select count(*) from public.versions v where v.author_id = uid and v.visibility = 'public'),
    (select count(*) from public.songs s where s.created_by = uid and s.visibility = 'public'),
    coalesce((select sum(v.rating_count) from public.versions v where v.author_id = uid and v.visibility = 'public'), 0),
    (select round(sum(v.rating_sum)::numeric / nullif(sum(v.rating_count), 0), 2) from public.versions v where v.author_id = uid and v.visibility = 'public'),
    (select count(*) from public.tracks t where t.owner_id = uid and t.visibility = 'public')
$$;
