-- Gitara 0004: a version can have a short label ("Easy version", "Live 2019") and tags
-- (cover, live, acoustic, original) that say what kind of take it is. Same song, different take.

alter table public.versions add column label text check (char_length(label) <= 60);
alter table public.versions add column tags text[] not null default '{}'
  check (tags <@ array['cover', 'live', 'acoustic', 'original', 'simplified', 'fingerstyle']);
