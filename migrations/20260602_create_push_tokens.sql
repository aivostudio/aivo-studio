create extension if not exists pgcrypto;

create table if not exists push_tokens (
  id uuid primary key default gen_random_uuid(),

  user_uuid uuid null,
  user_id text null,

  platform text not null check (platform in ('ios', 'android', 'web')),
  device_token text not null,

  permission_status text not null default 'granted'
    check (permission_status in ('granted', 'denied', 'unknown')),

  app text not null default 'aivo',
  device_id text null,
  user_agent text null,

  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz null,

  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists push_tokens_device_token_uq
  on push_tokens (device_token);

create index if not exists push_tokens_user_uuid_idx
  on push_tokens (user_uuid);

create index if not exists push_tokens_user_id_idx
  on push_tokens (user_id);

create index if not exists push_tokens_platform_idx
  on push_tokens (platform);

create index if not exists push_tokens_permission_status_idx
  on push_tokens (permission_status);

create index if not exists push_tokens_app_idx
  on push_tokens (app);

create index if not exists push_tokens_last_seen_at_idx
  on push_tokens (last_seen_at desc);

create index if not exists push_tokens_revoked_at_idx
  on push_tokens (revoked_at);

create or replace function set_push_tokens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_push_tokens_updated_at on push_tokens;

create trigger trg_push_tokens_updated_at
before update on push_tokens
for each row
execute function set_push_tokens_updated_at();
