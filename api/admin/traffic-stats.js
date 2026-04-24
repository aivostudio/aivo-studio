export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const KV_URL = process.env.KV_REST_API_URL;
    const KV_TOKEN = process.env.KV_REST_API_TOKEN;

    if (!KV_URL || !KV_TOKEN) {
      return res.status(200).json({
        ok: false,
        error: "kv_env_missing",
        today: {
          day: getDay(0),
          hits: 0,
          unique: 0
        },
        total: 0,
        last7Days: [],
        topPages: []
      });
    }

    const today = getDay(0);

    const total = await kvCmd(KV_URL, KV_TOKEN, ["GET", "traffic:total"]);
    const todayHits = await kvCmd(KV_URL, KV_TOKEN, ["GET", `traffic:day:${today}:hits`]);
    const todayUnique = await kvCmd(KV_URL, KV_TOKEN, ["SCARD", `traffic:day:${today}:unique`]);

    const last7Days = [];

    for (let i = 6; i >= 0; i--) {
      const day = getDay(i);
      const hits = await kvCmd(KV_URL, KV_TOKEN, ["GET", `traffic:day:${day}:hits`]);
      const unique = await kvCmd(KV_URL, KV_TOKEN, ["SCARD", `traffic:day:${day}:unique`]);

      last7Days.push({
        day,
        hits: Number(hits?.result || 0),
        unique: Number(unique?.result || 0)
      });
    }

    const pages = await kvCmd(KV_URL, KV_TOKEN, [
      "ZREVRANGE",
      `traffic:day:${today}:pages`,
      "0",
      "9",
      "WITHSCORES"
    ]);

    const rawPages = Array.isArray(pages?.result) ? pages.result : [];
    const topPages = [];

    for (let i = 0; i < rawPages.length; i += 2) {
      topPages.push({
        page: rawPages[i],
        hits: Number(rawPages[i + 1] || 0)
      });
    }

    return res.status(200).json({
      ok: true,
      today: {
        day: today,
        hits: Number(todayHits?.result || 0),
        unique: Number(todayUnique?.result || 0)
      },
      total: Number(total?.result || 0),
      last7Days,
      topPages
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      error: "traffic_stats_failed",
      today: {
        day: getDay(0),
        hits: 0,
        unique: 0
      },
      total: 0,
      last7Days: [],
      topPages: []
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

  const data = await r.json();
  return Array.isArray(data) ? data[0] : data;
}

function getDay(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - Number(daysAgo || 0));
  return d.toISOString().slice(0, 10);
}
