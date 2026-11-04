-- Gitara 0008: Jam mode (Phase 7).
-- A jam is a temporary room. Friends join with a short code (or a link / QR that carries it). Each
-- member shares an "offer": the songs they can play in this jam, with their roles, key and capo.
-- Only people inside the jam can see it. The host builds the setlist and everyone sees it live.
-- Joining and creating go through functions, so nobody can read a jam without its code, and codes
-- are never listed.

-- ---------------------------------------------------------------- tables

create table public.jams (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references public.profiles (id) on delete cascade,
  name text not null default 'Jam' check (char_length(name) between 1 and 60),
  include_learning boolean not null default false,
  target_minutes integer check (target_minutes is null or target_minutes between 5 and 600),
  setlist jsonb not null default '[]' check (jsonb_typeof(setlist) = 'array' and jsonb_array_length(setlist) <= 200 and pg_column_size(setlist) < 200000),
  status text not null default 'open' check (status in ('open', 'ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jams_host on public.jams (host_id);
create index jams_updated on public.jams (updated_at);
alter table public.jams enable row level security;

create table public.jam_members (
  jam_id uuid not null references public.jams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  display_name text not null default 'Guitarist' check (char_length(display_name) between 1 and 40),
  offer jsonb not null default '[]' check (jsonb_typeof(offer) = 'array' and jsonb_array_length(offer) <= 300 and pg_column_size(offer) < 300000),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (jam_id, user_id)
);
create index jam_members_user on public.jam_members (user_id);
alter table public.jam_members enable row level security;

create table public.jam_requests (
  id uuid primary key default gen_random_uuid(),
  jam_id uuid not null references public.jams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  artist text not null default '' check (char_length(artist) <= 120),
  created_at timestamptz not null default now()
);
create index jam_requests_jam on public.jam_requests (jam_id);
create index jam_requests_user on public.jam_requests (user_id);
alter table public.jam_requests enable row level security;

-- ---------------------------------------------------------------- helpers (not callable from the app)

create or replace function private.in_jam(jid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.jam_members m where m.jam_id = jid and m.user_id = (select auth.uid()))
$$;
revoke all on function private.in_jam(uuid) from public, anon;
grant execute on function private.in_jam(uuid) to authenticated;

create or replace function private.is_jam_host(jid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.jams j where j.id = jid and j.host_id = (select auth.uid()))
$$;
revoke all on function private.is_jam_host(uuid) from public, anon;
grant execute on function private.is_jam_host(uuid) to authenticated;

-- any change inside a jam counts as the jam being used (so empty, forgotten jams can be cleaned up)
create or replace function private.touch_jam()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    update public.jams set updated_at = now() where id = old.jam_id;
    return old;
  end if;
  update public.jams set updated_at = now() where id = new.jam_id;
  return new;
end $$;
create trigger jam_members_touch after insert or update or delete on public.jam_members for each row execute function private.touch_jam();
create trigger jam_requests_touch after insert or delete on public.jam_requests for each row execute function private.touch_jam();

create or replace function private.stamp_updated()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger jams_stamp before update on public.jams for each row execute function private.stamp_updated();
create trigger jam_members_stamp before update on public.jam_members for each row execute function private.stamp_updated();

-- at most 50 live requests per jam, 10 per person
create or replace function private.limit_requests()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.jam_requests r where r.jam_id = new.jam_id) >= 50 then
    raise exception 'Too many requests in this jam';
  end if;
  if (select count(*) from public.jam_requests r where r.jam_id = new.jam_id and r.user_id = new.user_id) >= 10 then
    raise exception 'You have already asked for 10 songs';
  end if;
  return new;
end $$;
create trigger jam_requests_limit before insert on public.jam_requests for each row execute function private.limit_requests();

-- ---------------------------------------------------------------- who can do what

create policy jams_select on public.jams for select to authenticated using (private.in_jam(id));
create policy jams_update_host on public.jams for update to authenticated
  using (host_id = (select auth.uid())) with check (host_id = (select auth.uid()));
create policy jams_delete_host on public.jams for delete to authenticated using (host_id = (select auth.uid()));
-- creating is done by create_jam(); the host can change only these columns
revoke update on public.jams from authenticated, anon;
grant update (name, include_learning, target_minutes, setlist, status) on public.jams to authenticated;
revoke insert on public.jams from authenticated, anon;

create policy members_select on public.jam_members for select to authenticated using (private.in_jam(jam_id));
create policy members_update_own on public.jam_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- you can leave; the host can remove others (the host ends the jam instead of leaving it)
create policy members_delete on public.jam_members for delete to authenticated
  using ((user_id = (select auth.uid()) and not private.is_jam_host(jam_id)) or (private.is_jam_host(jam_id) and user_id <> (select auth.uid())));
revoke update on public.jam_members from authenticated, anon;
grant update (display_name, offer) on public.jam_members to authenticated;
revoke insert on public.jam_members from authenticated, anon;

create policy requests_select on public.jam_requests for select to authenticated using (private.in_jam(jam_id));
create policy requests_insert on public.jam_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and private.in_jam(jam_id));
create policy requests_delete on public.jam_requests for delete to authenticated
  using (user_id = (select auth.uid()) or private.is_jam_host(jam_id));

-- ---------------------------------------------------------------- create and join

-- six letters/numbers without the look-alikes (0/O, 1/I/L)
create or replace function private.new_jam_code()
returns text language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  bytes bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  out text := '';
begin
  for i in 0..5 loop
    out := out || substr(alphabet, 1 + (get_byte(bytes, i) % 31), 1);
  end loop;
  return out;
end $$;

-- A host has one open jam at a time: starting a new one ends the old one.
create or replace function public.create_jam(p_name text, p_display_name text, p_include_learning boolean default false, p_target_minutes integer default null)
returns table (id uuid, code text) language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  new_id uuid;
  new_code text;
  tries int := 0;
begin
  if me is null then raise exception 'not signed in'; end if;
  update public.jams j set status = 'ended' where j.host_id = me and j.status = 'open';
  loop
    new_code := private.new_jam_code();
    begin
      insert into public.jams (code, host_id, name, include_learning, target_minutes)
        values (new_code, me, coalesce(nullif(trim(p_name), ''), 'Jam'), coalesce(p_include_learning, false), p_target_minutes)
        returning public.jams.id into new_id;
      exit;
    exception when unique_violation then
      tries := tries + 1;
      if tries > 8 then raise exception 'try again'; end if;
    end;
  end loop;
  insert into public.jam_members (jam_id, user_id, display_name) values (new_id, me, coalesce(nullif(trim(p_display_name), ''), 'Host'));
  return query select new_id, new_code;
end $$;
revoke all on function public.create_jam(text, text, boolean, integer) from public, anon;
grant execute on function public.create_jam(text, text, boolean, integer) to authenticated;

create or replace function public.join_jam(p_code text, p_display_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  j public.jams;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into j from public.jams x where x.code = upper(trim(p_code)) and x.status = 'open';
  if not found then raise exception 'No open jam with that code'; end if;
  if exists (select 1 from public.jam_members m where m.jam_id = j.id and m.user_id = me) then
    update public.jam_members m set display_name = coalesce(nullif(trim(p_display_name), ''), m.display_name) where m.jam_id = j.id and m.user_id = me;
    return j.id;
  end if;
  if (select count(*) from public.jam_members m where m.jam_id = j.id) >= 12 then raise exception 'This jam is full'; end if;
  insert into public.jam_members (jam_id, user_id, display_name) values (j.id, me, coalesce(nullif(trim(p_display_name), ''), 'Guitarist'));
  return j.id;
end $$;
revoke all on function public.join_jam(text, text) from public, anon;
grant execute on function public.join_jam(text, text) to authenticated;

-- Jams nobody has touched are removed: open ones after 3 days, ended ones after 1 day.
-- (The host can save a jam as a playlist before then.) Run on a schedule; see the notes in the app docs.
create or replace function private.cleanup_stale_jams()
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from public.jams j
   where (j.status = 'open' and j.updated_at < now() - interval '3 days')
      or (j.status = 'ended' and j.updated_at < now() - interval '1 day');
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function private.cleanup_stale_jams() from public, anon, authenticated;

-- live updates for people inside a jam (row security still decides who receives what)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.jams, public.jam_members, public.jam_requests;
  end if;
end $$;
