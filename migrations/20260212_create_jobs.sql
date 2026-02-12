-- DB Migration — jobs tablosu (Postgres) [REVİZE / UYUMLU]

-- 0) UUID üretimi için extension (ikisi de yaygın; birini seç)
CREATE EXTENSION IF NOT EXISTS pgcrypto;      -- gen_random_uuid()
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- uuid_generate_v4()

-- 1) jobs tablosu (revize)
-- Notlar:
-- - id: bizim "job_id". Runway task id UUID ise direkt bunu id olarak yazacağız.
-- - user_id: şimdilik NULL olabilir (auth bağlanınca NOT NULL + backfill yapılır)
-- - provider: şimdilik NULL olabilir (create insert’te ayrıca yazacağız)
-- - outputs/error default boş json
CREATE TABLE IF NOT EXISTS jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT,                          -- (şimdilik NULL olabilir)
  app         TEXT NOT NULL,                 -- music|video|cover|atmo|social|hook
  provider    TEXT,                          -- fal|runway|topmediai|...
  request_id  TEXT UNIQUE,                   -- provider id (opsiyonel)
  status      TEXT NOT NULL DEFAULT 'queued',
  prompt      TEXT,
  meta        JSONB NOT NULL DEFAULT '{}'::jsonb,
  outputs     JSONB NOT NULL DEFAULT '[]'::jsonb,
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
-- user_id NULL olacağı için index yine işe yarar; ileride user_id zorunlu olunca daha da güçlenir.
CREATE INDEX IF NOT EXISTS idx_jobs_user_app_created
ON jobs (user_id, app, created_at DESC);

-- 4) app bazlı hızlı listelemek için ek index (jobs/list?app=video çok kullanacak)
CREATE INDEX IF NOT EXISTS idx_jobs_app_created
ON jobs (app, created_at DESC);
