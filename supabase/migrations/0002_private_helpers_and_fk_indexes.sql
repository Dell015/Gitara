-- Gitara 0002: housekeeping from Supabase's advisors, applied right after 0001.
--
-- 1. The helper functions used by security policies are SECURITY DEFINER. Left in the `public`
--    schema they can be called from the browser through the REST API (/rest/v1/rpc/...). They are
--    harmless, but there is no reason to expose them, so they move to a private schema that the
--    API doesn't publish. Policies refer to functions by identity, so they keep working.
-- 2. Index the foreign keys that had no covering index.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.is_playlist_owner(uuid) set schema private;
alter function public.is_playlist_editor(uuid) set schema private;
alter function public.can_view_playlist(uuid) set schema private;
alter function public.has_public_content(uuid) set schema private;
alter function public.section_is_public(uuid, public.learn_status) set schema private;

-- The new-user trigger function should not be callable by signed-in users either.
revoke execute on function public.handle_new_user() from authenticated;

create index library_entries_preferred_version on public.library_entries (preferred_version_id);
create index playlist_items_added_by on public.playlist_items (added_by);
create index playlist_items_version on public.playlist_items (version_id);
create index shapes_instrument on public.shapes (instrument_id);
create index versions_based_on on public.versions (based_on);
create index versions_instrument on public.versions (instrument_id);
