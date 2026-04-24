export default async function handler(req, res) {
  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const KV_URL = process.env.KV_REST_API_URL;
    const KV_TOKEN = process.env.KV_REST_API_TOKEN;

    if (!KV_URL || !KV_TOKEN) {
      return res.status(200).json({
        ok: false,
        skipped: true,
        error: "kv_env_missing"
      });
    }

    const now = new Date();
    const day = now.toISOString().slice(0, 10);

    const body =
      req.method === "POST"
        ? typeof req.body === "object" && req.body
          ? req.body
          : {}
        : {};

    const page = String(body.page || req.query.page || req.headers.referer || "/")
      .trim()
      .slice(0, 300);

    const ua = String(req.headers["user-agent"] || "").slice(0, 300);
    const ip =
      String(
        req.headers["x-forwarded-for"] ||
          req.headers["x-real-ip"] ||
          req.socket?.remoteAddress ||
          ""
      )
        .split(",")[0]
        .trim() || "unknown";

    const visitorSeed = `${ip}|${ua}`;
    const visitorId = await sha256(visitorSeed);

    const keys = {
      total: "traffic:total",
      daily: `traffic:day:${day}:hits`,
      unique: `traffic:day:${day}:unique`,
      page: `traffic:day:${day}:page:${safeKey(page)}`
    };

    await kvCmd(KV_URL, KV_TOKEN, ["INCR", keys.total]);
    await kvCmd(KV_URL, KV_TOKEN, ["INCR", keys.daily]);
    await kvCmd(KV_URL, KV_TOKEN, ["SADD", keys.unique, visitorId]);
    await kvCmd(KV_URL, KV_TOKEN, ["INCR", keys.page]);

    await kvCmd(KV_URL, KV_TOKEN, [
      "ZINCRBY",
      `traffic:day:${day}:pages`,
      "1",
      page
    ]);

    await kvCmd(KV_URL, KV_TOKEN, [
      "EXPIRE",
      keys.unique,
      String(60 * 60 * 24 * 45)
    ]);

    await kvCmd(KV_URL, KV_TOKEN, [
      "EXPIRE",
      `traffic:day:${day}:pages`,
      String(60 * 60 * 24 * 45)
    ]);

    return res.status(200).json({
      ok: true,
      day,
      page
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      error: "traffic_hit_failed"
    });
  }
}

async function kvCmd(url, token, command) {
  const r = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify([command])
  });

  if (!r.ok) {
    throw new Error("kv_request_failed");
  }

  return r.json();
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function safeKey(value) {
  return String(value || "/")
    .toLowerCase()
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/[^a-z0-9/_-]+/gi, "_")
    .slice(0, 120);
}
