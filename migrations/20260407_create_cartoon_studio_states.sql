create table if not exists cartoon_studio_states (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  app text not null default 'cartoon',
  mode text not null default 'studio',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists cartoon_studio_states_user_app_mode_uidx
  on cartoon_studio_states (user_id, app, mode);

create index if not exists cartoon_studio_states_user_id_idx
  on cartoon_studio_states (user_id);

create index if not exists cartoon_studio_states_updated_at_idx
  on cartoon_studio_states (updated_at desc);
