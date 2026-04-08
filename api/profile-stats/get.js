const { neon } = require("@neondatabase/serverless");

function emptyStats() {
  return {
    music: 0,
    cover: 0,
    atmo: 0,
    cartoon: 0,
    photofx: 0,
    imageToVideo: 0,
    video: 0,
    spent: 0,
    total: null,
    lastCredits: null,
    seen: {},
    updatedAt: 0,
  };
}

function toSafeInt(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const protocol =
      req.headers["x-forwarded-proto"] ||
      (req.headers.host && req.headers.host.includes("localhost") ? "http" : "https");

    const host = req.headers.host;
    if (!host) {
      return res.status(400).json({ ok: false, error: "missing_host" });
    }

    const authRes = await fetch(`${protocol}://${host}/api/auth/me`, {
      method: "GET",
      headers: {
        cookie: req.headers.cookie || "",
        accept: "application/json",
      },
    });

    const authJson = await authRes.json().catch(() => null);
    console.log("[PROFILE_STATS_UPSERT][AUTH_JSON_FULL]", JSON.stringify(authJson, null, 2));

    if (!authRes.ok || !authJson?.ok) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const userId =
      authJson?.user?.id ||
      authJson?.user_id ||
      authJson?.id ||
      authJson?.user?.user_id ||
      null;

    const email =
      authJson?.user?.email ||
      authJson?.email ||
      null;

    if (!userId) {
      return res.status(401).json({ ok: false, error: "missing_user_id" });
    }

    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ ok: false, error: "missing_database_url" });
    }

    const sql = neon(process.env.DATABASE_URL);

    const rows = await sql`
      select
        user_id,
        music,
        cover,
        atmo,
        cartoon,
        photofx,
        image_to_video,
        video,
        spent,
        total,
        last_credits,
        seen_json,
        updated_at
      from profile_stats
      where user_id = ${userId}::uuid
      limit 1
    `;

    const row = rows[0];
    const base = emptyStats();

    if (!row) {
      return res.status(200).json({
        ok: true,
        email,
        user_id: userId,
        stats: base,
      });
    }

    return res.status(200).json({
      ok: true,
      email,
      user_id: userId,
      stats: {
        music: toSafeInt(row.music),
        cover: toSafeInt(row.cover),
        atmo: toSafeInt(row.atmo),
        cartoon: toSafeInt(row.cartoon),
        photofx: toSafeInt(row.photofx),
        imageToVideo: toSafeInt(row.image_to_video),
        video: toSafeInt(row.video),
        spent: toSafeInt(row.spent),
        total: row.total == null ? null : toSafeInt(row.total),
        lastCredits: row.last_credits == null ? null : toSafeInt(row.last_credits),
        seen:
          row.seen_json && typeof row.seen_json === "object"
            ? row.seen_json
            : {},
        updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : 0,
      },
    });
  } catch (err) {
    console.error("[profile-stats/get] error", err);
    return res.status(500).json({
      ok: false,
      error: "profile_stats_get_failed",
    });
  }
};
