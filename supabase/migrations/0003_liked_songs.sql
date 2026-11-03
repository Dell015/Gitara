-- Gitara 0003: "liked" songs (docs/screens.md, navigation model).
-- A library entry with no status means the song is liked (saved) but you haven't said how well you
-- know it. Setting a status (Planning / Learning / Performing) keeps it in the library too.
-- Entries with no status are never shown publicly: section_is_public() returns false for null.

alter table public.library_entries alter column status drop not null;
alter table public.library_entries alter column status drop default;
