// /api/jobs/import-fal-urls.ts
// Amaç: Fal'da zaten üretilmiş mp4 URL'lerini Neon(DB)'a "ready" job+output olarak kaydetmek.
// Böylece /api/jobs/list?app=video UI'da görünür. (Kredi harcamaz, Fal'a istek atmaz.)

import type { NextApiRequest, NextApiResponse } from "next";
import { randomUUID } from "crypto";

// ⚠️ Bunları senin projendeki gerçek helper'larla değiştir:
// - requireUser: cookie/session'dan user_uuid + email döndürsün
// - db: Neon/pg client (sql tagged veya query)
import { requireUser } from "@/lib/auth"; // ör: { user_uuid, email }
import { db } from "@/lib/db";            // ör: db.query(sql, params)

type Body = {
  urls: string[];
  app?: string;        // default: "video"
  prompt?: string;     // opsiyonel: UI'da gösterim için
  endpoint?: string;   // opsiyonel: "fal-ai/kling-video/..."
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  const user = await requireUser(req, res);
  if (!user) return; // requireUser zaten response döndürmüş olur

  let body: Body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ ok: false, error: "bad_json" });
  }

  const urls = Array.isArray(body?.urls) ? body.urls.filter(Boolean) : [];
  if (!urls.length) return res.status(400).json({ ok: false, error: "missing_urls" });

  const app = (body.app || "video").trim();
  const endpoint = (body.endpoint || "fal").trim();
  const prompt = (body.prompt || "").trim();

  // DB enum yüzünden senin aldığın hata: "COMPLETED" yok.
  // Biz burada "ready" yazıyoruz (sistemin /api/jobs/status normalize'ı da genelde "ready" döndürüyor).
  const status = "ready";

  const imported: Array<{ job_id: string; url: string }> = [];

  // Basit dedupe: aynı URL daha önce output olarak yazıldıysa atla (isteğe göre)
  // Bu query'yi kendi schema'na göre uyarlayabilirsin.
  const existing = await db.query(
    `select url from outputs where url = any($1::text[])`,
    [urls]
  );
  const existingSet = new Set((existing?.rows || []).map((r: any) => r.url));

  for (const url of urls) {
    if (existingSet.has(url)) continue;

    const job_id = randomUUID();

    // jobs tablonun kolon isimlerini kendi şemana göre düzelt:
    // Örnek kolonlar: id, user_uuid, app, provider, status, prompt, meta, created_at
    await db.query(
      `insert into jobs (id, user_uuid, app, provider, status, prompt, meta)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        job_id,
        user.user_uuid,
        app,
        "fal",
        status,
        prompt || null,
        JSON.stringify({
          source: "import-fal-urls",
          endpoint,
          imported_at: new Date().toISOString(),
        }),
      ]
    );

    // outputs tablonu da kendi şemana göre düzelt:
    // Örnek kolonlar: id, job_id, type, url, meta, created_at
    await db.query(
      `insert into outputs (job_id, type, url, meta)
       values ($1, $2, $3, $4::jsonb)`,
      [
        job_id,
        "video",
        url,
        JSON.stringify({
          app,
          provider: "fal",
          endpoint,
          kind: "mp4",
        }),
      ]
    );

    imported.push({ job_id, url });
  }

  return res.status(200).json({ ok: true, app, imported, skipped: urls.length - imported.length });
}
