const { neon } = require("@neondatabase/serverless");
const authModule = require("../_lib/auth.js");
const kvMod = require("../_kv.js");

const requireAuth =
  authModule?.requireAuth ||
  authModule?.default?.requireAuth;

function safeText(value) {
  return String(value == null ? "" : value).trim();
}

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function resolveDate(value) {
  return isValidDate(value)
    ? String(value)
    : new Date().toISOString().slice(0, 10);
}

function dayFromValue(value) {
  if (value == null || value === "") return "";

  const numeric = Number(value);
  const date = Number.isFinite(numeric) && numeric > 0
    ? new Date(numeric)
    : new Date(String(value));

  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function normalizePage(value) {
  try {
    const raw = String(value || "/").trim();
    const withoutOrigin = raw.replace(/^https?:\/\/[^/]+/i, "");
    return withoutOrigin.split("?")[0] || "/";
  } catch (_) {
    return String(value || "/");
  }
}

async function restKv(command) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) return null;

  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify([command])
  });

  if (!response.ok) throw new Error("kv_request_failed");

  const data = await response.json();
  return Array.isArray(data) ? data[0] : data;
}

function parsePairs(value) {
  const arr = Array.isArray(value) ? value : [];
  const rows = [];

  for (let i = 0; i < arr.length; i += 2) {
    const page = String(arr[i] || "/");
    const hits = Number(arr[i + 1] || 0);
    if (hits > 0) rows.push({ page, hits });
  }

  return rows;
}

function parseUsersList(value) {
  let raw = value;

  if (raw && typeof raw === "object" && "result" in raw) {
    raw = raw.result;
  }

  if (typeof raw === "string") {
    try { raw = JSON.parse(raw); } catch (_) { raw = []; }
  }

  return Array.isArray(raw) ? raw : [];
}

async function countRegistrations(date) {
  const kv = kvMod?.default || kvMod || {};
  const redis = kv.getRedis?.() || kv.redis || null;
  const kvGetJson = kv.kvGetJson;

  if (!redis || typeof kvGetJson !== "function") {
    const usersResponse = await restKv(["GET", "users:list"]).catch(() => null);
    const users = parseUsersList(usersResponse);
    return users.filter((user) => {
      const created = user?.createdAt ?? user?.created ?? null;
      return dayFromValue(created) === date;
    }).length;
  }

  const byEmail = new Map();

  function addUser(user, fallbackEmail) {
    if (!user || typeof user !== "object") return;

    const email = safeText(user.email || fallbackEmail).toLowerCase();
    if (!email || !email.includes("@")) return;

    const prev = byEmail.get(email) || {};
    byEmail.set(email, {
      ...prev,
      ...user,
      email,
      createdAt: user.createdAt || user.created || prev.createdAt || prev.created || null,
      created: user.created || prev.created || null
    });
  }

  const list = await kvGetJson("users:list").catch(() => []);
  if (Array.isArray(list)) {
    for (const user of list) addUser(user, "");
  }

  async function scanPattern(pattern) {
    let cursor = "0";

    do {
      const reply = await redis.scan(cursor, { match: pattern, count: 1000 });
      cursor = String(reply?.[0] ?? reply?.cursor ?? "0");

      const keys =
        Array.isArray(reply?.[1]) ? reply[1] :
        Array.isArray(reply?.keys) ? reply.keys :
        [];

      for (const key of keys) {
        const user = await kvGetJson(key).catch(() => null);
        if (!user) continue;

        const fallbackEmail = String(key || "")
          .replace(/^user:/, "")
          .replace(/^users:/, "");

        addUser(user, fallbackEmail);
      }
    } while (cursor !== "0" && byEmail.size < 10000);
  }

  await scanPattern("user:*");
  await scanPattern("users:*");

  return Array.from(byEmail.values()).filter((user) => {
    const created = user?.createdAt ?? user?.created ?? null;
    return dayFromValue(created) === date;
  }).length;
}

async function countWebPaidOrders(date) {
  const kv = kvMod?.default || kvMod || {};
  const redis = kv.getRedis?.() || kv.redis || null;
  if (!redis) return 0;

  let cursor = "0";
  let total = 0;

  do {
    const reply = await redis.scan(cursor, { match: "invoices:*", count: 200 });
    cursor = String(reply?.[0] ?? reply?.cursor ?? "0");

    const keys =
      Array.isArray(reply?.[1]) ? reply[1] :
      Array.isArray(reply?.keys) ? reply.keys :
      [];

    for (const key of keys) {
      const type = safeText(await redis.type(key).catch(() => "none")).toLowerCase();
      let items = [];

      if (type === "list") {
        const rows = await redis.lrange(key, 0, 300).catch(() => []);
        items = (Array.isArray(rows) ? rows : []).map((row) => {
          try { return typeof row === "string" ? JSON.parse(row) : row; }
          catch (_) { return null; }
        }).filter(Boolean);
      } else if (type === "string") {
        const raw = await redis.get(key).catch(() => "[]");
        try {
          const parsed = typeof raw === "string" ? JSON.parse(raw || "[]") : raw;
          items = Array.isArray(parsed) ? parsed : [];
        } catch (_) {
          items = [];
        }
      }

      for (const item of items) {
        const status = safeText(item?.status).toLowerCase();
        const credits = Number(item?.credits || 0);
        const itemDay =
          dayFromValue(item?.created_at) ||
          dayFromValue(item?.ts);

        if (status === "paid" && credits > 0 && itemDay === date) {
          total += 1;
        }
      }
    }
  } while (cursor !== "0");

  return total;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    if (typeof requireAuth !== "function") {
      return res.status(500).json({ ok: false, error: "require_auth_missing" });
    }

    try {
      await requireAuth(req);
    } catch (error) {
      return res.status(401).json({
        ok: false,
        error: "unauthorized",
        message: String(error?.message || error)
      });
    }

    const date = resolveDate(req.query?.date);

    const pagesResponse = await restKv([
      "ZRANGE",
      `traffic:day:${date}:pages`,
      "0",
      "-1",
      "WITHSCORES"
    ]).catch(() => null);

    const pages = parsePairs(pagesResponse?.result);

    let landingViews = 0;
    let studioViews = 0;
    let creditsViews = 0;

    for (const item of pages) {
      const page = normalizePage(item.page).toLowerCase();
      const hits = Number(item.hits || 0);

      if (
        page === "/" ||
        page === "/index.html" ||
        page.includes("/index.mobile.html") ||
        page.includes("/index.ios.html") ||
        page.includes("/index.play.html")
      ) {
        landingViews += hits;
      }

      if (page.includes("studio.")) {
        studioViews += hits;
      }

      if (String(item.page || "").toLowerCase().includes("credits")) {
        creditsViews += hits;
      }
    }

    const registrations = await countRegistrations(date).catch(() => 0);

    let productionJobs = 0;
    let producers = 0;
    let firstProducers = 0;

    const conn =
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URL_UNPOOLED ||
      "";

    if (conn) {
      const sql = neon(conn);
      const start = `${date}T00:00:00.000Z`;
      const endDate = new Date(`${date}T00:00:00.000Z`);
      endDate.setUTCDate(endDate.getUTCDate() + 1);
      const end = endDate.toISOString();

      const totals = await sql`
        select
          count(*)::int as job_count,
          count(distinct lower(user_id))::int as producer_count
        from jobs
        where created_at >= ${start}::timestamptz
          and created_at < ${end}::timestamptz
      `;

      productionJobs = Number(totals?.[0]?.job_count || 0);
      producers = Number(totals?.[0]?.producer_count || 0);

      const firstRows = await sql`
        select count(*)::int as first_producer_count
        from (
          select lower(user_id) as user_id, min(created_at) as first_created_at
          from jobs
          where user_id is not null
          group by lower(user_id)
        ) first_jobs
        where first_created_at >= ${start}::timestamptz
          and first_created_at < ${end}::timestamptz
      `;

      firstProducers = Number(firstRows?.[0]?.first_producer_count || 0);
    }

    const webPaidOrders = await countWebPaidOrders(date).catch(() => 0);

    const pct = (value, base) =>
      base > 0 ? Number(((Number(value || 0) / base) * 100).toFixed(1)) : 0;

    return res.status(200).json({
      ok: true,
      date,
      funnel: {
        landing_views: landingViews,
        studio_views: studioViews,
        registrations,
        first_producers: firstProducers,
        producers,
        production_jobs: productionJobs,
        credits_views: creditsViews,
        web_paid_orders: webPaidOrders
      },
      conversion: {
        studio_from_landing_pct: pct(studioViews, landingViews),
        register_from_landing_pct: pct(registrations, landingViews),
        first_production_from_register_pct: pct(firstProducers, registrations),
        credits_from_studio_pct: pct(creditsViews, studioViews),
        web_paid_from_credits_pct: pct(webPaidOrders, creditsViews)
      },
      notes: {
        web_paid_orders: "Yalnız web/ödeme faturası kayıtlarıdır. iOS ve Google Play satış kartları ayrı kaynaklardan raporlanır."
      }
    });
  } catch (error) {
    console.error("admin/funnel-stats failed:", error);
    return res.status(500).json({
      ok: false,
      error: "funnel_stats_failed",
      message: String(error?.message || error)
    });
  }
};