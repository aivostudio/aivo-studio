-- DB Migration — jobs tablosu (Postgres) [REVİZE / TAM UYUMLU]
-- Hedefler:
-- - id = bizim job_id (Runway task id UUID ise direkt id olarak yazılabilir)
-- - user_id şimdilik NULL olabilir (auth oturunca NOT NULL + backfill)
-- - request_id UNIQUE yerine (provider, request_id) unique (daha güvenli)
-- - outputs/meta/error default güvenli JSON
-- - updated_at trigger
-- - list performansı için indexler

-- 0) UUID üretimi için extension (ikisi de yaygın; birini seç)
CREATE EXTENSION IF NOT EXISTS pgcrypto;       -- gen_random_uuid()
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- uuid_generate_v4()

-- 1) jobs tablosu
CREATE TABLE IF NOT EXISTS jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT,                          -- şimdilik NULL olabilir (ileride UUID + NOT NULL tercih edilebilir)
  app         TEXT NOT NULL,                 -- music|video|cover|atmo|social|hook
  provider    TEXT,                          -- fal|runway|topmediai|...
  request_id  TEXT,                          -- provider tarafı id (opsiyonel)
  status      TEXT NOT NULL DEFAULT 'queued', -- queued|in_queue|processing|ready|failed vs (senin normalize'ına göre)
  prompt      TEXT,
  meta        JSONB NOT NULL DEFAULT '{}'::jsonb,
  outputs     JSONB NOT NULL DEFAULT '[]'::jsonb,
  error       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) request_id benzersizliği: provider + request_id
-- Not: request_id NULL ise unique constraint çakışmaz (NULL'lar ayrı kabul edilir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'jobs_provider_request_id_uniq'
  ) THEN
    ALTER TABLE jobs
      ADD CONSTRAINT jobs_provider_request_id_uniq
      UNIQUE (provider, request_id);
  END IF;
END $$;

-- 3) updated_at otomatik güncelleme (trigger)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jobs_updated_at ON jobs;
CREATE TRIGGER trg_jobs_updated_at
BEFORE UPDATE ON jobs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- 4) Liste performansı için indexler
-- user_id NULL olacağı için de index işe yarar; auth oturunca daha da güçlenir.
CREATE INDEX IF NOT EXISTS idx_jobs_user_app_created
ON jobs (user_id, app, created_at DESC);

-- jobs/list?app=video gibi çağrılar için
CREATE INDEX IF NOT EXISTS idx_jobs_app_created
ON jobs (app, created_at DESC);

-- provider + request_id lookup (rehydrate / reconcile için hızlı)
CREATE INDEX IF NOT EXISTS idx_jobs_provider_request_id
ON jobs (provider, request_id);

-- (Opsiyonel) status bazlı hızlı filtre
-- CREATE INDEX IF NOT EXISTS idx_jobs_app_status_created
-- ON jobs (app, status, created_at DESC);
