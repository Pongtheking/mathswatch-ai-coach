-- The marker saves incomplete multi-page runs as `partial` so the earlier
-- marked pages remain available rather than being discarded.
alter table papers drop constraint if exists papers_status_check;
alter table papers add constraint papers_status_check
  check (status in ('draft', 'parsed', 'ready', 'marking', 'partial', 'marked'));
