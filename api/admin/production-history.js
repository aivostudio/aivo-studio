const { neon } = require("@neondatabase/serverless");
const authModule = require("../_lib/auth.js");

const requireAuth =
  authModule?.requireAuth ||
  authModule?.default?.requireAuth;

function pickConn() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    ""
  );
}

function safeText(v) {
  const s = String(v == null ? "" : v).trim();
  return s || null;
}

function safeInt(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback || 0;
  return Math.trunc(n);
}

function safeJson(res, code, obj) {
  return res.status(code).json(obj);
}

function isValidDateOnly(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
}

function resolveDateRange(dateStr) {
  const base = isValidDateOnly(dateStr)
    ? String(dateStr)
    : new Date().toISOString().slice(0, 10);

  const start = `${base}T00:00:00.000Z`;
  const end = `${base}T23:59:59.999Z`;

  return {
    date: base,
    start,
    end
  };
}

function normalizeJson(value, fallback) {
  if (value == null) return fallback;

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(String(value));
  } catch (_) {
    return fallback;
  }
}

function pickOutputUrl(outputs, meta) {
  const outputList = Array.isArray(outputs) ? outputs : [];
  const metaObj = meta && typeof meta === "object" ? meta : {};

  const directMetaUrl =
    safeText(metaObj.final_video_url) ||
    safeText(metaObj.preview_video_url) ||
    safeText(metaObj.muxed_url) ||
    safeText(metaObj.logo_overlay_url) ||
    safeText(metaObj.output_url) ||
    safeText(metaObj.result_url) ||
    safeText(metaObj.audio_url) ||
    safeText(metaObj.image_url) ||
    safeText(metaObj.url);

  if (directMetaUrl) return directMetaUrl;

  for (const item of outputList) {
    if (!item || typeof item !== "object") continue;

    const url =
      safeText(item.archive_url) ||
      safeText(item.url) ||
      safeText(item.raw_url) ||
      safeText(item.src) ||
      safeText(item.audio_url) ||
      safeText(item.video_url) ||
      safeText(item.image_url);

    if (url) return url;
  }

  return null;
}

function mapModuleLabel(app, type) {
  const text = `${app || ""} ${type || ""}`.toLowerCase();

  if (text.includes("music") || text.includes("müzik") || text.includes("muzik")) return "AI Müzik Üret";
  if (text.includes("cover") || text.includes("kapak")) return "AI Kapak Üret";
  if (text.includes("atmo") || text.includes("atmosfer")) return "AI Atmosfer Video";
  if (text.includes("lipsync") || text.includes("lip sync") || text.includes("dudak")) return "AI Dudak Senkron";
  if (text.includes("photofx") || text.includes("photo fx") || text.includes("foto efekt")) return "AI Foto Efekt Video Clip";
  if (text.includes("cartoon") || text.includes("çizgifilm") || text.includes("cizgifilm")) return "AI Çocuk Çizgifilm";
  if (text.includes("video") || text.includes("runway")) return "AI Resimden Video Üret";

  return safeText(app) || "Bilinmeyen Modül";
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    if (req.method !== "GET") {
      return safeJson(res, 405, {
        ok: false,
        error: "method_not_allowed"
      });
    }

    const conn = pickConn();
    if (!conn) {
      return safeJson(res, 500, {
        ok: false,
        error: "missing_db_env"
      });
    }

    if (typeof requireAuth !== "function") {
      return safeJson(res, 500, {
        ok: false,
        error: "require_auth_missing"
      });
    }

    try {
      await requireAuth(req);
    } catch (e) {
      return safeJson(res, 401, {
        ok: false,
        error: "unauthorized",
        message: String(e?.message || e)
      });
    }

    const dateParam = safeText(req.query?.date);
    const { date, start, end } = resolveDateRange(dateParam);

    const limitRaw = safeInt(req.query?.limit, 150);
    const limit = Math.max(1, Math.min(limitRaw || 150, 300));

    const emailFilter = safeText(req.query?.email);
    const appFilter = safeText(req.query?.app);

    const sql = neon(conn);

    const rows = await sql`
      select
        j.id as job_id,
        j.user_id as email,
        j.app as app,
        j.type as type,
        j.provider as provider,
        j.request_id as request_id,
        j.status as job_status,
        j.prompt as prompt,
        j.meta as job_meta,
        j.outputs as outputs,
        j.error as job_error,
        j.created_at as job_created_at,
        j.updated_at as job_updated_at,

        ct.id as transaction_id,
        ct.action as action,
        ct.kind as kind,
        ct.amount as amount,
        ct.status as transaction_status,
        ct.reason as reason,
        ct.provider_job_id as provider_job_id,
        ct.meta as transaction_meta,
        ct.created_at as transaction_created_at
      from jobs j
      left join credit_transactions ct
        on ct.job_id is not null
        and ct.job_id = j.id::text
        and ct.status = 'applied'
      where j.created_at >= ${start}::timestamptz
        and j.created_at <= ${end}::timestamptz
        and (${emailFilter}::text is null or lower(j.user_id) = lower(${emailFilter}::text))
        and (${appFilter}::text is null or lower(j.app) = lower(${appFilter}::text))
      order by j.created_at desc
      limit ${limit}
    `;

    const items = rows.map((row) => {
      const outputs = normalizeJson(row.outputs, []);
      const jobMeta = normalizeJson(row.job_meta, {});
      const transactionMeta = normalizeJson(row.transaction_meta, {});
      const outputUrl = pickOutputUrl(outputs, jobMeta);

      return {
        date: row.job_created_at || row.transaction_created_at || null,
        email: row.email || null,
        app: row.app || null,
        module_label: mapModuleLabel(row.app, row.type),
        type: row.type || null,
        prompt: row.prompt || null,

        job_id: row.job_id || null,
        provider: row.provider || null,
        request_id: row.request_id || null,
        provider_job_id: row.provider_job_id || null,
        job_status: row.job_status || null,
        output_url: outputUrl,
        outputs,
        job_meta: jobMeta,
        job_error: row.job_error || null,
        job_created_at: row.job_created_at || null,
        job_updated_at: row.job_updated_at || null,

        transaction_id: row.transaction_id || null,
        action: row.action || null,
        kind: row.kind || null,
        amount: Number(row.amount || 0),
        transaction_status: row.transaction_status || null,
        reason: row.reason || null,
        transaction_meta: transactionMeta,
        transaction_created_at: row.transaction_created_at || null
      };
    });

    const totals = items.reduce(
      (acc, item) => {
        if (item.kind === "consume") {
          acc.spent_credits += Number(item.amount || 0);
        }

        if (item.kind === "refund") {
          acc.refund_credits += Number(item.amount || 0);
        }

        acc.job_count += 1;

        if (item.transaction_id) {
          acc.transaction_count += 1;
        }

        return acc;
      },
      {
        spent_credits: 0,
        refund_credits: 0,
        net_credits: 0,
        job_count: 0,
        transaction_count: 0
      }
    );

    totals.net_credits = totals.spent_credits - totals.refund_credits;

    return safeJson(res, 200, {
      ok: true,
      date,
      limit,
      count: items.length,
      totals,
      items
    });
  } catch (e) {
    console.error("admin/production-history failed:", e);
    return safeJson(res, 500, {
      ok: false,
      error: "production_history_failed",
      message: String(e?.message || e)
    });
  }
};
