-- Gitara 0006: "Popular in Gitara" on Home. Counts how many people saved each public song.
-- Runs with the owner's rights so it can count other people's library entries, but it only ever
-- returns public songs and a number: nobody's library is revealed.

create or replace function public.popular_songs(lim integer default 12)
returns table (song_id uuid, saves bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, count(le.user_id) as saves
  from public.songs s
  left join public.library_entries le on le.song_id = s.id
  where s.visibility = 'public'
  group by s.id, s.created_at
  order by count(le.user_id) desc, s.created_at desc
  limit least(greatest(lim, 1), 50);
$$;

revoke all on function public.popular_songs(integer) from public, anon;
grant execute on function public.popular_songs(integer) to authenticated;
