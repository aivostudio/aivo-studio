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

function mapModuleLabel(app, action, reason) {
  const text = `${app || ""} ${action || ""} ${reason || ""}`.toLowerCase();

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
        ct.id as transaction_id,
        ct.user_id as email,
        ct.app as transaction_app,
        ct.action as action,
        ct.kind as kind,
        ct.amount as amount,
        ct.status as transaction_status,
        ct.reason as reason,
        ct.job_id as job_id,
        ct.provider_job_id as provider_job_id,
        ct.meta as transaction_meta,
        ct.created_at as transaction_created_at,

        j.id as real_job_id,
        j.user_id as job_user_id,
        j.app as job_app,
        j.type as job_type,
        j.provider as provider,
        j.status as job_status,
        j.prompt as prompt,
        j.meta as job_meta,
        j.outputs as outputs,
        j.error as job_error,
        j.created_at as job_created_at,
        j.updated_at as job_updated_at
      from credit_transactions ct
      left join jobs j
        on ct.job_id is not null
        and j.id::text = ct.job_id
      where ct.status = 'applied'
        and ct.created_at >= ${start}::timestamptz
        and ct.created_at <= ${end}::timestamptz
        and (${emailFilter}::text is null or lower(ct.user_id) = lower(${emailFilter}::text))
        and (${appFilter}::text is null or lower(ct.app) = lower(${appFilter}::text))
      order by ct.created_at desc
      limit ${limit}
    `;

    const items = rows.map((row) => {
      const outputs = normalizeJson(row.outputs, []);
      const jobMeta = normalizeJson(row.job_meta, {});
      const transactionMeta = normalizeJson(row.transaction_meta, {});
      const outputUrl = pickOutputUrl(outputs, jobMeta);

      return {
        transaction_id: row.transaction_id || null,
        date: row.transaction_created_at || null,
        email: row.email || row.job_user_id || null,
        app: row.job_app || row.transaction_app || null,
        module_label: mapModuleLabel(row.job_app || row.transaction_app, row.action, row.reason),
        action: row.action || null,
        kind: row.kind || null,
        amount: Number(row.amount || 0),
        transaction_status: row.transaction_status || null,
        reason: row.reason || null,

        job_id: row.real_job_id || row.job_id || null,
        provider_job_id: row.provider_job_id || null,
        provider: row.provider || null,
        job_type: row.job_type || null,
        job_status: row.job_status || null,
        prompt: row.prompt || null,
        output_url: outputUrl,
        outputs,
        job_meta: jobMeta,
        transaction_meta: transactionMeta,
        job_error: row.job_error || null,
        job_created_at: row.job_created_at || null,
        job_updated_at: row.job_updated_at || null
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

        acc.transaction_count += 1;
        return acc;
      },
      {
        spent_credits: 0,
        refund_credits: 0,
        net_credits: 0,
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
