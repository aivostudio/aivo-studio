const { neon } = require("@neondatabase/serverless");

function toSafeInt(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function toNullableInt(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.floor(n));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
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

    if (!authRes.ok || !authJson?.ok) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const userId =
      authJson?.user?.id ||
      authJson?.user_id ||
      authJson?.id ||
      authJson?.user?.user_id ||
      null;

    if (!userId) {
      return res.status(401).json({ ok: false, error: "missing_user_id" });
    }

    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ ok: false, error: "missing_database_url" });
    }

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : (req.body || {});

    const stats = body.stats || {};

    const music = toSafeInt(stats.music);
    const cover = toSafeInt(stats.cover);
    const atmo = toSafeInt(stats.atmo);
    const cartoon = toSafeInt(stats.cartoon);
    const photofx = toSafeInt(stats.photofx);
    const imageToVideo = toSafeInt(stats.imageToVideo);
    const video = toSafeInt(stats.video);
    const spent = toSafeInt(stats.spent);
    const total = toNullableInt(stats.total);
    const lastCredits = toNullableInt(stats.lastCredits);
    const seen = stats.seen && typeof stats.seen === "object" ? stats.seen : {};

    const sql = neon(process.env.DATABASE_URL);

    await sql`
      insert into profile_stats (
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
      )
      values (
        ${userId}::uuid,
        ${music},
        ${cover},
        ${atmo},
        ${cartoon},
        ${photofx},
        ${imageToVideo},
        ${video},
        ${spent},
        ${total},
        ${lastCredits},
        ${JSON.stringify(seen)}::jsonb,
        now()
      )
      on conflict (user_id)
      do update set
        music = excluded.music,
        cover = excluded.cover,
        atmo = excluded.atmo,
        cartoon = excluded.cartoon,
        photofx = excluded.photofx,
        image_to_video = excluded.image_to_video,
        video = excluded.video,
        spent = excluded.spent,
        total = excluded.total,
        last_credits = excluded.last_credits,
        seen_json = excluded.seen_json,
        updated_at = now()
    `;

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[profile-stats/upsert] error", err);
    return res.status(500).json({
      ok: false,
      error: "profile_stats_upsert_failed",
    });
  }
};
