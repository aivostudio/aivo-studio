create extension if not exists pgcrypto;

create table if not exists admin_audit_logs (
  id uuid primary key default gen_random_uuid(),

  scope text not null,

  user_uuid uuid null,
  user_id text null,

  app text null,
  action text null,
  amount integer not null default 0,

  request_id text null,
  job_id text null,
  provider_job_id text null,

  related_transaction_id uuid null references credit_transactions(id) on delete set null,

  reason text null,
  status text not null default 'logged',

  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_scope_idx
  on admin_audit_logs (scope);

create index if not exists admin_audit_logs_user_uuid_idx
  on admin_audit_logs (user_uuid);

create index if not exists admin_audit_logs_user_id_idx
  on admin_audit_logs (user_id);

create index if not exists admin_audit_logs_app_idx
  on admin_audit_logs (app);

create index if not exists admin_audit_logs_action_idx
  on admin_audit_logs (action);

create index if not exists admin_audit_logs_request_id_idx
  on admin_audit_logs (request_id);

create index if not exists admin_audit_logs_job_id_idx
  on admin_audit_logs (job_id);

create index if not exists admin_audit_logs_provider_job_id_idx
  on admin_audit_logs (provider_job_id);

create index if not exists admin_audit_logs_related_transaction_id_idx
  on admin_audit_logs (related_transaction_id);

create index if not exists admin_audit_logs_created_at_idx
  on admin_audit_logs (created_at desc);
