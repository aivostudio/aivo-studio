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
        topPages: [],
        sourceSummary: [],
        deviceSummary: []
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

    const debugRowsResponse = await kvCmd(KV_URL, KV_TOKEN, [
      "LRANGE",
      `traffic:day:${today}:debug`,
      "0",
      "199"
    ]);

    const debugRows = Array.isArray(debugRowsResponse?.result)
      ? debugRowsResponse.result
      : [];

    const sourceCounts = new Map();
    const deviceCounts = new Map();

    for (const raw of debugRows) {
      let item = null;

      try {
        item = JSON.parse(String(raw || ""));
      } catch (_) {
        item = null;
      }

      if (!item || typeof item !== "object") continue;

      const sourceLabel = classifySource(item);
      const deviceLabel = classifyDeviceBrowser(item.ua);

      sourceCounts.set(sourceLabel, Number(sourceCounts.get(sourceLabel) || 0) + 1);
      deviceCounts.set(deviceLabel, Number(deviceCounts.get(deviceLabel) || 0) + 1);
    }

    const sourceSummary = sortedSummary(sourceCounts, 10);
    const deviceSummary = sortedSummary(deviceCounts, 10);

    if (sourceSummary.length) {
      topPages.push({ page: "──────── KAYNAK / REFERRER ────────", hits: 0 });

      sourceSummary.forEach((item) => {
        topPages.push({
          page: `Kaynak: ${item.label}`,
          hits: item.hits
        });
      });
    }

    if (deviceSummary.length) {
      topPages.push({ page: "──────── CİHAZ / BROWSER ────────", hits: 0 });

      deviceSummary.forEach((item) => {
        topPages.push({
          page: `Cihaz: ${item.label}`,
          hits: item.hits
        });
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
      topPages,
      sourceSummary,
      deviceSummary,
      debugSampleSize: debugRows.length
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
      topPages: [],
      sourceSummary: [],
      deviceSummary: []
    });
  }
}

function sortedSummary(map, limit) {
  return Array.from(map.entries())
    .map(([label, hits]) => ({ label, hits: Number(hits || 0) }))
    .sort((a, b) => b.hits - a.hits)
    .slice(0, limit);
}

function classifySource(item) {
  const ua = String(item?.ua || "");
  const referrer = String(item?.referrer || "").trim();

  if (isBotUa(ua)) return "Bot / crawler";

  if (/instagram/i.test(ua)) return "Instagram uygulaması";
  if (/FBAN|FBAV|FB_IAB|facebook/i.test(ua)) return "Facebook uygulaması";
  if (/TikTok/i.test(ua)) return "TikTok uygulaması";
  if (/Twitter|X\.com/i.test(ua)) return "X / Twitter uygulaması";

  if (!referrer) return "Direct / uygulama içi / referrer yok";

  try {
    const host = new URL(referrer).hostname.replace(/^www\./i, "").toLowerCase();

    if (host === "l.instagram.com" || host.endsWith("instagram.com")) return "Instagram";
    if (host === "l.facebook.com" || host === "lm.facebook.com" || host.endsWith("facebook.com")) return "Facebook";
    if (host.endsWith("google.com") || host.startsWith("google.")) return "Google";
    if (host === "youtu.be" || host.endsWith("youtube.com")) return "YouTube";
    if (host === "t.co" || host === "x.com" || host.endsWith("twitter.com")) return "X / Twitter";
    if (host.endsWith("bing.com")) return "Bing";
    if (host.endsWith("yandex.com") || host.endsWith("yandex.com.tr")) return "Yandex";
    if (host.endsWith("aivo.tr")) return "AIVO iç yönlendirme";

    return host || "Referrer var / tanımsız";
  } catch (_) {
    return "Referrer var / okunamadı";
  }
}

function classifyDeviceBrowser(uaValue) {
  const ua = String(uaValue || "");

  if (isBotUa(ua)) return "Bot / crawler";

  let device = "Masaüstü";
  if (/iPad|Tablet|Nexus 7|Nexus 10/i.test(ua)) device = "Tablet";
  else if (/Mobi|Android|iPhone|iPod/i.test(ua)) device = "Mobil";

  let browser = "Diğer";
  if (/Instagram/i.test(ua)) browser = "Instagram WebView";
  else if (/FBAN|FBAV|FB_IAB|facebook/i.test(ua)) browser = "Facebook WebView";
  else if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\//i.test(ua)) browser = "Opera";
  else if (/SamsungBrowser\//i.test(ua)) browser = "Samsung Internet";
  else if (/CriOS\//i.test(ua)) browser = "Chrome iOS";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/FxiOS\//i.test(ua)) browser = "Firefox iOS";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua)) browser = "Safari";

  return `${device} · ${browser}`;
}

function isBotUa(uaValue) {
  return /bot|crawler|spider|slurp|headless|facebookexternalhit|whatsapp|telegrambot|discordbot|preview|googleother|googlebot|bingbot|yandexbot|bytespider/i.test(
    String(uaValue || "")
  );
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
