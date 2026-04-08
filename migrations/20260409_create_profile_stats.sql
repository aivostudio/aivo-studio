create table if not exists profile_stats (
  user_id uuid primary key,
  music integer not null default 0,
  cover integer not null default 0,
  atmo integer not null default 0,
  cartoon integer not null default 0,
  photofx integer not null default 0,
  image_to_video integer not null default 0,
  video integer not null default 0,
  spent integer not null default 0,
  total integer,
  last_credits integer,
  seen_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profile_stats_updated_at
  on profile_stats(updated_at);
