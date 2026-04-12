create extension if not exists pgcrypto;

create table if not exists credit_transactions (
  id uuid primary key default gen_random_uuid(),

  user_uuid uuid null,
  user_id text null,

  app text not null,
  action text not null,

  kind text not null check (kind in ('consume', 'refund')),
  amount integer not null check (amount > 0),
  currency_unit text not null default 'credit',

  status text not null default 'pending' check (status in ('pending', 'applied', 'skipped', 'failed')),

  request_id text null,
  job_id text null,
  provider_job_id text null,

  idempotency_key text not null,
  related_transaction_id uuid null references credit_transactions(id) on delete set null,

  reason text null,
  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists credit_transactions_idempotency_key_uq
  on credit_transactions (idempotency_key);

create index if not exists credit_transactions_user_uuid_idx
  on credit_transactions (user_uuid);

create index if not exists credit_transactions_user_id_idx
  on credit_transactions (user_id);

create index if not exists credit_transactions_app_idx
  on credit_transactions (app);

create index if not exists credit_transactions_action_idx
  on credit_transactions (action);

create index if not exists credit_transactions_kind_idx
  on credit_transactions (kind);

create index if not exists credit_transactions_status_idx
  on credit_transactions (status);

create index if not exists credit_transactions_request_id_idx
  on credit_transactions (request_id);

create index if not exists credit_transactions_job_id_idx
  on credit_transactions (job_id);

create index if not exists credit_transactions_provider_job_id_idx
  on credit_transactions (provider_job_id);

create index if not exists credit_transactions_related_transaction_id_idx
  on credit_transactions (related_transaction_id);

create index if not exists credit_transactions_created_at_idx
  on credit_transactions (created_at desc);

create unique index if not exists credit_transactions_refund_once_per_source_uq
  on credit_transactions (related_transaction_id)
  where kind = 'refund';

create or replace function set_credit_transactions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_credit_transactions_updated_at on credit_transactions;

create trigger trg_credit_transactions_updated_at
before update on credit_transactions
for each row
execute function set_credit_transactions_updated_at();
