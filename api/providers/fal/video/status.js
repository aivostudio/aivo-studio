// /api/providers/fal/video/status.js  (CommonJS)
// ✅ FIX (Atmosfer odaklı, diğer modüllere dokunmaz):
// 1) "status endpoint" KURMAYIZ. Varsa direkt status_url/response_url kullanırız (create response’tan).
// 2) status_url yoksa: (opsiyonel) job_id ile DB’den meta.provider_response.raw.status_url çekmeye çalışırız.
// 3) Fal status call: önce GET deneriz; 405/404 gibi durumda POST fallback deneriz.
// 4) Normalize output: status + video_url + outputs[] (PPE/import ready)

const { neon } = require("@neondatabase/serverless");

// küçük helper
function pick(obj, paths) {
  for (const p of paths) {
    const parts = p.split(".");
    let cur = obj;
    let ok = true;
    for (const k of parts) {
      if (!cur || typeof cur !== "object" || !(k in cur)) {
        ok = false;
        break;
      }
      cur = cur[k];
    }
    if (ok && cur != null) return cur;
  }
  return null;
}

function normalizeStatus(rawStatus, videoUrl) {
  const st = String(rawStatus || "").toUpperCase();

  if (videoUrl) return "COMPLETED";

  if (st === "COMPLETED" || st === "COMPLETE" || st === "SUCCEEDED" || st === "READY" || st === "DONE")
    return "COMPLETED";

  if (st === "IN_PROGRESS" || st === "PROCESSING" || st === "RUNNING" || st === "STARTED")
    return "RUNNING";

  if (st === "IN_QUEUE" || st === "QUEUED" || st === "PENDING")
    return "IN_QUEUE";

  if (st === "FAILED" || st === "ERROR" || st === "CANCELED" || st === "CANCELLED")
    return "FAILED";

  return "UNKNOWN";
}

function extractVideoUrl(falJson) {
  // Fal cevapları farklı şekillerde gelebiliyor; en yaygın alanları tarıyoruz
  return (
    pick(falJson, [
      "video.url",
      "output.video.url",
      "output.url",
      "data.video.url",
      "data.output.video.url",
      "result.video.url",
      "result.output.video.url",
    ]) ||
    (Array.isArray(falJson?.outputs) ? (falJson.outputs.find(x => x?.url)?.url || null) : null) ||
    null
  );
}

async function fetchFalStatus({ url, falKey }) {
  // status_url zaten FULL URL olacak: https://queue.fal.run/.../status
  // endpoint'i asla encode etmiyoruz.
  const headers = {
    Authorization: `Key ${falKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  // 1) GET dene
  let r = await fetch(url, { method: "GET", headers });
  let text = await r.text().catch(() => "");
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (r.ok) return { ok: true, method: "GET", http_status: r.status, url, data };

  // 2) Bazı queue endpoint’leri POST isteyebiliyor -> fallback
  // (GET 405/404/400 vs geldiyse POST’la dene)
  const r2 = await fetch(url, { method: "POST", headers, body: "{}" });
  const text2 = await r2.text().catch(() => "");
  let data2;
  try { data2 = JSON.parse(text2); } catch { data2 = { raw: text2 }; }

  return { ok: r2.ok, method: "POST", http_status: r2.status, url, data: data2, first_try: { method: "GET", http_status: r.status, data } };
}

async function resolveStatusUrlFromDB(job_id) {
  const conn =
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED;

  if (!conn) return { ok: false, error: "missing_db_env" };

  const sql = neon(conn);

  const rows = await sql`
    select id, app, meta
    from jobs
    where id = ${job_id}::uuid
    limit 1
  `;

  if (!rows.length) return { ok: false, error: "job_not_found" };

  const meta = rows[0].meta || {};
  const status_url =
    pick(meta, [
      "provider_response.raw.status_url",
      "provider_response.status_url",
      "provider_response.raw.response_url",
      "provider_response.response_url",
      "status_url",
      "response_url",
    ]) || null;

  return { ok: true, status_url, meta, app: rows[0].app || null };
}

module.exports = async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store");

    // GET/POST ikisini de kabul edelim (panel bazen POST atabiliyor)
    const q = req.query || {};
    const b = req.body || {};

    const app = String(q.app || b.app || "").trim() || "atmo";

    // 1) Öncelik: direkt full status_url gelmişse onu kullan
    let status_url = String(q.status_url || b.status_url || q.response_url || b.response_url || "").trim();

    // 2) status_url yoksa: job_id ile DB’den çekmeyi dene
    const job_id = String(q.job_id || b.job_id || "").trim();
    let dbInfo = null;

    if (!status_url && job_id) {
      dbInfo = await resolveStatusUrlFromDB(job_id);
      if (dbInfo.ok && dbInfo.status_url) {
        status_url = String(dbInfo.status_url).trim();
      }
    }

    // 3) Hala yoksa: request_id verilmiş mi?
    // NOT: Bu fallback’i “en son” bırakıyoruz çünkü endpoint KURMAK burada en riskli şey.
    const request_id = String(q.request_id || b.request_id || "").trim();

    if (!status_url && !request_id) {
      return res.status(400).json({
        ok: false,
        error: "missing_status_url_or_request_id",
        hint: "Send status_url (recommended) or provide job_id (DB lookup) or request_id (fallback).",
        app,
      });
    }

    const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY;
    if (!FAL_KEY) {
      return res.status(500).json({ ok: false, error: "missing_fal_key" });
    }

    const attempts = [];

    // 4) Eğer status_url hala yoksa (fallback): endpoint üret (riskli)
    // Senin yaşadığın 404’lerin ana sebebi buydu; o yüzden sadece mecbur kalırsak çalıştırıyoruz.
    if (!status_url && request_id) {
      const candidates = [
        // bazı projelerde bu path tutuyor olabilir
        `https://queue.fal.run/fal-ai/kling-video/v3/pro/text-to-video/requests/${encodeURIComponent(request_id)}/status`,
        `https://queue.fal.run/fal-ai/kling-video/v3/standard/text-to-video/requests/${encodeURIComponent(request_id)}/status`,
        // bazı hesaplarda "v3/pro/text-to-video" yerine farklı route olabiliyor; en genel fallback:
        `https://queue.fal.run/fal-ai/kling-video/requests/${encodeURIComponent(request_id)}/status`,
      ];

      // sırayla dene: ilk OK olanı seç
      let best = null;
      for (const u of candidates) {
        const r = await fetchFalStatus({ url: u, falKey: FAL_KEY });
        attempts.push({ url: u, ok: r.ok, http_status: r.http_status, method: r.method });
        if (r.ok) {
          status_url = u;
          best = r;
          break;
        }
        best = r;
      }

      if (!best || !best.ok) {
        return res.status(200).json({
          ok: false,
          provider: "fal",
          error: "fal_status_error",
          app,
          request_id,
          status_url: null,
          attempts,
        });
      }

      // best zaten var; aşağıda tekrar fetch yapmayalım
      const fal = best.data || {};
      const video_url = extractVideoUrl(fal);
      const statusRaw =
        pick(fal, ["status", "data.status", "result.status", "state"]) || null;

      const status = normalizeStatus(statusRaw, video_url);

      const outputs = video_url
        ? [{ type: "video", url: video_url, meta: { app } }]
        : [];

      return res.status(200).json({
        ok: true,
        provider: "fal",
        app,
        request_id,
        status_url,
        status,
        video_url,
        outputs,
        fal,
        attempts,
        db: dbInfo && dbInfo.ok ? { ok: true } : undefined,
      });
    }

    // 5) status_url üzerinden fetch (asıl doğru yol)
    const rr = await fetchFalStatus({ url: status_url, falKey: FAL_KEY });
    attempts.push({ url: status_url, ok: rr.ok, http_status: rr.http_status, method: rr.method });

    if (!rr.ok) {
      return res.status(200).json({
        ok: false,
        provider: "fal",
        error: "fal_status_error",
        app,
        request_id: request_id || null,
        status_url,
        fal_status: rr.http_status,
        attempts,
        // debug için minimal
        raw_status: rr.data && rr.data.raw ? rr.data.raw : undefined,
      });
    }

    const fal = rr.data || {};
    const video_url = extractVideoUrl(fal);

    const statusRaw =
      pick(fal, ["status", "data.status", "result.status", "state"]) || null;

    const status = normalizeStatus(statusRaw, video_url);

    const outputs = video_url
      ? [{ type: "video", url: video_url, meta: { app } }]
      : [];

    return res.status(200).json({
      ok: true,
      provider: "fal",
      app,
      request_id: request_id || null,
      status_url,
      status,     // ✅ panel/jobs/status import için kritik
      video_url,
      outputs,    // ✅ PPE için hazır
      fal,        // raw (debug)
      attempts,
      db: dbInfo && dbInfo.ok ? { ok: true, app: dbInfo.app || null } : undefined,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: e?.message || String(e),
    });
  }
};
