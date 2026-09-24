-- MathsWatch AI Coach — application schema
-- Curriculum tables are shared (no user_id). All student evidence is user-scoped.

create table if not exists topics (
  id            text primary key,
  name          text not null,
  category      text not null,
  description   text not null default '',
  sort_order    integer not null default 0
);

create table if not exists skills (
  id                 text primary key,
  name               text not null,
  category           text not null,
  subtopic           text not null,
  topic_id           text not null references topics(id),
  tier               text not null check (tier in ('foundation', 'higher', 'both')),
  difficulty         integer not null check (difficulty between 1 and 9),
  gcse_relevance     integer not null check (gcse_relevance between 1 and 10),
  target_grade_min   integer not null check (target_grade_min between 1 and 9),
  target_grade_max   integer not null check (target_grade_max between 1 and 9),
  exam_frequency     integer not null check (exam_frequency between 1 and 10),
  common_mistakes    text not null default '[]',
  sort_order         integer not null default 0
);

create table if not exists skill_prerequisites (
  skill_id          text not null references skills(id) on delete cascade,
  prerequisite_id   text not null references skills(id) on delete cascade,
  primary key (skill_id, prerequisite_id)
);

create table if not exists skill_related (
  skill_id    text not null references skills(id) on delete cascade,
  related_id  text not null references skills(id) on delete cascade,
  primary key (skill_id, related_id)
);

create table if not exists student_profiles (
  user_id               text primary key,
  display_name          text not null default '',
  exam_board            text not null default 'unspecified',
  target_grade          integer not null default 9,
  weekly_minutes_goal   integer not null default 180,
  calculator_preference text not null default 'either',
  onboarding_complete   boolean not null default false,
  current_streak        integer not null default 0,
  longest_streak        integer not null default 0,
  last_active_date      date,
  total_minutes         integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table if not exists mastery_scores (
  user_id           text not null,
  skill_id          text not null references skills(id),
  score             double precision,
  attempts          integer not null default 0,
  correct_count     integer not null default 0,
  recent_accuracy   double precision not null default 0,
  confidence        double precision not null default 0,
  mistake_frequency double precision not null default 0,
  retention_score   double precision not null default 100,
  last_practiced_at timestamptz,
  next_review_at    timestamptz,
  interval_days     integer not null default 0,
  easiness          double precision not null default 2.5,
  updated_at        timestamptz not null default now(),
  primary key (user_id, skill_id)
);
create index if not exists mastery_scores_user_idx on mastery_scores (user_id);
create index if not exists mastery_scores_review_idx on mastery_scores (user_id, next_review_at);

create table if not exists questions (
  id              text primary key,
  user_id         text,
  source          text not null check (source in ('seed', 'capture', 'generated', 'manual', 'import')),
  prompt          text not null,
  prompt_latex    text,
  marks           integer,
  answer          text,
  worked_solution text,
  skill_ids       text not null default '[]',
  topic_id        text,
  difficulty      integer not null default 5,
  calculator      boolean,
  question_type   text not null default 'structured',
  command_words   text not null default '[]',
  common_mistakes text not null default '[]',
  image_id        text,
  confirmed       boolean not null default true,
  created_at      timestamptz not null default now()
);
create index if not exists questions_user_idx on questions (user_id, created_at desc);
create index if not exists questions_source_idx on questions (source);

create table if not exists uploaded_images (
  id          text primary key,
  user_id     text not null,
  kind        text not null check (kind in ('question', 'working')),
  mime        text not null,
  data_base64 text not null,
  size_bytes  integer not null,
  created_at  timestamptz not null default now()
);
create index if not exists uploaded_images_user_idx on uploaded_images (user_id, created_at desc);

create table if not exists question_attempts (
  id              text primary key,
  user_id         text not null,
  question_id     text not null references questions(id),
  working_text    text,
  working_image_id text,
  is_correct      boolean,
  marks_awarded   integer,
  time_ms         integer not null default 0,
  confidence      integer,
  analysis_json   text,
  created_at      timestamptz not null default now()
);
create index if not exists question_attempts_user_idx on question_attempts (user_id, created_at desc);
create index if not exists question_attempts_q_idx on question_attempts (question_id);

create table if not exists mistakes (
  id                text primary key,
  user_id           text not null,
  attempt_id        text not null,
  question_id       text not null,
  skill_id          text references skills(id),
  category          text not null,
  what_student_did  text not null,
  what_should       text not null,
  why_wrong         text not null,
  how_to_avoid      text not null,
  difficulty        integer,
  corrected         boolean not null default false,
  created_at        timestamptz not null default now()
);
create index if not exists mistakes_user_idx on mistakes (user_id, created_at desc);
create index if not exists mistakes_skill_idx on mistakes (user_id, skill_id);
create index if not exists mistakes_cat_idx on mistakes (user_id, category);

create table if not exists study_sessions (
  id            text primary key,
  user_id       text not null,
  kind          text not null,
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  minutes       integer not null default 0,
  questions_n   integer not null default 0,
  correct_n     integer not null default 0,
  notes         text
);
create index if not exists study_sessions_user_idx on study_sessions (user_id, started_at desc);

create table if not exists revision_plans (
  id          text primary key,
  user_id     text not null,
  period      text not null check (period in ('today', 'week', 'next_week')),
  plan_date   date not null,
  minutes     integer not null default 45,
  rationale   text not null default '',
  items_json  text not null default '[]',
  created_at  timestamptz not null default now(),
  unique (user_id, period, plan_date)
);
create index if not exists revision_plans_user_idx on revision_plans (user_id, plan_date desc);

create table if not exists diagnostic_tests (
  id          text primary key,
  user_id     text not null,
  kind        text not null,
  title       text not null,
  timed       boolean not null default false,
  time_limit_s integer,
  calculator  text not null default 'either',
  status      text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  question_ids text not null default '[]',
  started_at  timestamptz not null default now(),
  completed_at timestamptz,
  score       integer,
  max_score   integer,
  analysis_json text
);
create index if not exists diagnostic_tests_user_idx on diagnostic_tests (user_id, started_at desc);

create table if not exists test_answers (
  id            text primary key,
  user_id       text not null,
  test_id       text not null references diagnostic_tests(id) on delete cascade,
  question_id   text not null,
  response      text,
  flagged       boolean not null default false,
  is_correct    boolean,
  time_ms       integer not null default 0,
  updated_at    timestamptz not null default now(),
  unique (test_id, question_id)
);

create table if not exists assignments (
  id            text primary key,
  user_id       text not null,
  provider      text not null default 'manual',
  title         text not null,
  topic         text,
  score_raw     text,
  score_percent double precision,
  assigned_at   date,
  notes         text,
  created_at    timestamptz not null default now()
);
create index if not exists assignments_user_idx on assignments (user_id, created_at desc);

create table if not exists weekly_reviews (
  id            text primary key,
  user_id       text not null,
  week_start    date not null,
  summary_json  text not null,
  created_at    timestamptz not null default now(),
  unique (user_id, week_start)
);

create table if not exists ai_conversations (
  id            text primary key,
  user_id       text not null,
  question_id   text,
  kind          text not null,
  created_at    timestamptz not null default now()
);

create table if not exists ai_messages (
  id              text primary key,
  conversation_id text not null references ai_conversations(id) on delete cascade,
  user_id         text not null,
  role            text not null,
  content         text not null,
  created_at      timestamptz not null default now()
);
create index if not exists ai_messages_conv_idx on ai_messages (conversation_id, created_at);

create table if not exists goals (
  id          text primary key,
  user_id     text not null,
  title       text not null,
  skill_id    text,
  target      text,
  status      text not null default 'active',
  created_at  timestamptz not null default now()
);
create index if not exists goals_user_idx on goals (user_id);

create table if not exists practice_queue (
  id            text primary key,
  user_id       text not null,
  skill_id      text not null,
  reason        text not null,
  priority      double precision not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists practice_queue_user_idx on practice_queue (user_id, priority desc);
