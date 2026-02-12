-- Blok Adı: DB Migration — jobs tablosu (Postgres)

-- 0) UUID üretimi için extension (ikisi de yaygın; birini seç)
CREATE EXTENSION IF NOT EXISTS pgcrypto;      -- gen_random_uuid()
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- uuid_generate_v4()

-- 1) jobs tablosu
CREATE TABLE IF NOT EXISTS jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- bizim job_id
  user_id     TEXT NOT NULL,
  app         TEXT NOT NULL,          -- music|video|cover|atmo|social|hook
  provider    TEXT NOT NULL,          -- fal|runway|topmediai|...
  request_id  TEXT UNIQUE,            -- provider id (nullable)
  status      TEXT NOT NULL DEFAULT 'queued',
  prompt      TEXT,
  meta        JSONB,
  outputs     JSONB,
  error       JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) updated_at otomatik güncelleme (trigger)
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

-- 3) Liste performansı için index
CREATE INDEX IF NOT EXISTS idx_jobs_user_app_created
ON jobs (user_id, app, created_at DESC);

-- 4) (Opsiyonel ama önerilir) status/app/provider için basic check disiplinini kodda uygula.
