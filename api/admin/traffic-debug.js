// api/admin/traffic-debug.js

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({
        ok: false,
        error: "method_not_allowed"
      });
    }

    const KV_URL =
      process.env.KV_REST_API_URL ||
      process.env.UPSTASH_KV_REST_API_URL ||
      process.env.UPSTASH_REDIS_REST_URL ||
      process.env.UPSTASH_REDIS_REST_API_URL;

    const KV_TOKEN =
      process.env.KV_REST_API_TOKEN ||
      process.env.UPSTASH_KV_REST_API_TOKEN ||
      process.env.UPSTASH_REDIS_REST_TOKEN ||
      process.env.UPSTASH_REDIS_REST_API_TOKEN;

    if (!KV_URL || !KV_TOKEN) {
      return res.status(200).json({
        ok: false,
        error: "kv_env_missing"
      });
    }

    const day = String(req.query.day || new Date().toISOString().slice(0, 10))
      .trim()
      .slice(0, 10);

    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
    const key = `traffic:day:${day}:debug`;

    const r = await fetch(`${KV_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify([
        ["LRANGE", key, "0", String(limit - 1)]
      ])
    });

    if (!r.ok) {
      throw new Error("kv_request_failed");
    }

    const data = await r.json();
    const rawItems = Array.isArray(data?.[0]?.result) ? data[0].result : [];

    const items = rawItems.map((item) => {
      if (typeof item === "object" && item !== null) return item;

      try {
        return JSON.parse(String(item));
      } catch (_) {
        return {
          raw: String(item)
        };
      }
    });

    return res.status(200).json({
      ok: true,
      day,
      key,
      count: items.length,
      items
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      error: "traffic_debug_failed"
    });
  }
}
