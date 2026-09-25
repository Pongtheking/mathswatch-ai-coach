-- AI paper marker: official paper + mark scheme as source of truth.

create table if not exists papers (
  id              text primary key,
  user_id         text not null,
  title           text not null default 'Untitled paper',
  board           text not null default 'unspecified',
  tier            text not null default 'unknown',
  calculator      text not null default 'unknown',
  status          text not null default 'draft'
                    check (status in ('draft', 'parsed', 'ready', 'marking', 'partial', 'marked')),
  paper_notes     text not null default '',
  ms_notes        text not null default '',
  parse_json      text,
  scheme_json     text,
  mark_json       text,
  total_awarded   integer,
  total_available integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists papers_user_idx on papers (user_id, created_at desc);

create table if not exists paper_assets (
  id          text primary key,
  paper_id    text not null references papers(id) on delete cascade,
  user_id     text not null,
  kind        text not null check (kind in ('paper', 'mark_scheme', 'answers')),
  mime        text not null,
  data_base64 text not null,
  page_index  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists paper_assets_paper_idx on paper_assets (paper_id, kind, page_index);

create table if not exists paper_questions (
  id          text primary key,
  paper_id    text not null references papers(id) on delete cascade,
  ref         text not null,
  prompt      text not null,
  marks       integer not null default 0,
  skill_ids   text not null default '[]',
  sort_order  integer not null default 0,
  notes       text not null default ''
);
create index if not exists paper_questions_paper_idx on paper_questions (paper_id, sort_order);

create table if not exists paper_mark_points (
  id                text primary key,
  paper_id          text not null references papers(id) on delete cascade,
  question_id       text not null references paper_questions(id) on delete cascade,
  question_ref      text not null,
  code              text not null,
  description       text not null,
  marks             integer not null default 1,
  dependent_on      text,
  follow_through    boolean not null default false,
  or_equivalent     boolean not null default false,
  cao               boolean not null default false,
  alternative_group text
);
create index if not exists paper_mark_points_q_idx on paper_mark_points (question_id);

create table if not exists paper_answers (
  id              text primary key,
  paper_id        text not null references papers(id) on delete cascade,
  question_id     text not null references paper_questions(id) on delete cascade,
  user_id         text not null,
  working_text    text,
  asset_id        text,
  unique (paper_id, question_id)
);

create table if not exists paper_question_marks (
  id              text primary key,
  paper_id        text not null references papers(id) on delete cascade,
  question_id     text not null references paper_questions(id) on delete cascade,
  awarded         integer not null default 0,
  max_marks       integer not null default 0,
  points_json     text not null default '[]',
  feedback        text not null default '',
  confidence      double precision not null default 0,
  needs_review    boolean not null default false,
  student_override boolean not null default false,
  analysis_json   text
);
create unique index if not exists paper_question_marks_uq on paper_question_marks (paper_id, question_id);
