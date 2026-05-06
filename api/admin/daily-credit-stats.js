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

function safeInt(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
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

function createBucket(key, label) {
  return {
    key,
    label,
    spent_credits: 0,
    refund_credits: 0,
    net_credits: 0,
    transaction_count: 0
  };
}

function buildBuckets() {
  return {
    music: createBucket("music", "AI Müzik Üret"),
    cover: createBucket("cover", "AI Kapak Üret"),
    atmo: createBucket("atmo", "AI Atmosfer Video"),
    lipsync: createBucket("lipsync", "AI Dudak Senkron"),
    "cartoon:character": createBucket("cartoon:character", "AI Çocuk Çizgifilm — Karakter Yarat"),
    "cartoon:basic": createBucket("cartoon:basic", "AI Çocuk Çizgifilm — Basit Mod"),
    "cartoon:story": createBucket("cartoon:story", "AI Çocuk Çizgifilm — Hikaye Modu"),
    "cartoon:studio_export": createBucket("cartoon:studio_export", "AI Çocuk Çizgifilm — Montaj Stüdyosu"),
    photofx: createBucket("photofx", "AI Foto Efekt Video Clip"),
    video: createBucket("video", "AI Resimden Video Üret")
  };
}

function includesAny(haystack, needles) {
  const text = String(haystack || "").toLowerCase();
  return needles.some((item) => text.includes(String(item).toLowerCase()));
}

function resolveModuleKey(appInput, actionInput, reasonInput) {
  const app = String(appInput || "").toLowerCase();
  const action = String(actionInput || "").toLowerCase();
  const reason = String(reasonInput || "").toLowerCase();
  const text = `${app} ${action} ${reason}`.trim();

  if (includesAny(text, ["music", "muzik", "müzik"])) {
    return "music";
  }

  if (includesAny(text, ["cover", "kapak"])) {
    return "cover";
  }

  if (includesAny(text, ["atmo", "atmosfer", "atmosphere"])) {
    return "atmo";
  }
  if (includesAny(text, ["lipsync", "lip sync", "dudak", "dudak senkron"])) {
  return "lipsync";
}

  if (includesAny(text, ["photofx", "photo fx", "foto efekt", "photo_effect", "photo-effect"])) {
    return "photofx";
  }

  if (
    includesAny(text, ["runway", "image to video", "text to video", "text-to-video", "image-to-video"]) ||
    (
      includesAny(text, ["video"]) &&
      !includesAny(text, ["atmo", "atmosfer", "photofx", "foto efekt", "cartoon", "çizgifilm", "cizgifilm"])
    )
  ) {
    return "video";
  }

  if (includesAny(text, ["cartoon", "çizgifilm", "cizgifilm", "studio_export", "story", "basic", "character", "karakter", "hikaye", "basit", "montaj"])) {
    if (includesAny(text, ["studio_export", "studio export", "export-create", "export create", "montaj", "share-ready", "paylasmaya hazir", "paylaşmaya hazır"])) {
      return "cartoon:studio_export";
    }

    if (includesAny(text, ["character", "karakter"])) {
      return "cartoon:character";
    }

    if (includesAny(text, ["basic", "basit"])) {
      return "cartoon:basic";
    }

    if (includesAny(text, ["story", "hikaye"])) {
      return "cartoon:story";
    }
  }

  return null;
}

function aggregateRows(rows) {
  const buckets = buildBuckets();

  const totals = {
    spent_credits: 0,
    refund_credits: 0,
    net_credits: 0,
    transaction_count: 0
  };

  let unmatched_count = 0;

  for (const row of Array.isArray(rows) ? rows : []) {
    const kind = String(row?.kind || "").toLowerCase();
    const amount = safeInt(row?.amount);
    const moduleKey = resolveModuleKey(row?.app, row?.action, row?.reason);

    if (!moduleKey || !buckets[moduleKey]) {
      unmatched_count += 1;
      continue;
    }

    const bucket = buckets[moduleKey];
    bucket.transaction_count += 1;
    totals.transaction_count += 1;

    if (kind === "consume") {
      bucket.spent_credits += amount;
      totals.spent_credits += amount;
    } else if (kind === "refund") {
      bucket.refund_credits += amount;
      totals.refund_credits += amount;
    } else {
      unmatched_count += 1;
      bucket.transaction_count -= 1;
      totals.transaction_count -= 1;
      continue;
    }

    bucket.net_credits = bucket.spent_credits - bucket.refund_credits;
  }

  totals.net_credits = totals.spent_credits - totals.refund_credits;

  const modules = [
    buckets.music,
    buckets.cover,
    buckets.atmo,
    buckets["cartoon:character"],
    buckets["cartoon:basic"],
    buckets["cartoon:story"],
    buckets["cartoon:studio_export"],
    buckets.photofx,
    buckets.video
  ];

  return {
    modules,
    totals,
    unmatched_count
  };
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

    const sql = neon(conn);

    const rows = await sql`
      select
        id,
        app,
        action,
        kind,
        amount,
        status,
        reason,
        created_at
      from credit_transactions
      where status = 'applied'
        and created_at >= ${start}::timestamptz
        and created_at <= ${end}::timestamptz
      order by created_at desc
    `;

    const summary = aggregateRows(rows);

    return safeJson(res, 200, {
      ok: true,
      date,
      modules: summary.modules,
      totals: summary.totals,
      matched_transaction_count: summary.totals.transaction_count,
      unmatched_transaction_count: summary.unmatched_count
    });
  } catch (e) {
    console.error("admin/daily-credit-stats failed:", e);
    return safeJson(res, 500, {
      ok: false,
      error: "daily_credit_stats_failed",
      message: String(e?.message || e)
    });
  }
};
