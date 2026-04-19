// /api/garanti/callback.js
// Kullanıcının browser dönüş noktası
// Amaç: browser'dan gelen form POST'u düzgün oku, notify'ye server-side forward et, sonra checkout'a yönlendir

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function readPost(req) {
  if (req.body && typeof req.body === "object") return req.body;

  const raw = await readRawBody(req);
  const ct = String(req.headers["content-type"] || "");

  if (ct.includes("application/json")) {
    try {
      return JSON.parse(raw || "{}");
    } catch (_) {
      return {};
    }
  }

  const params = new URLSearchParams(raw);
  const out = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

function pickOid(body) {
  return String(
    body.oid ||
    body.order_id ||
    body.merchant_oid ||
    body.OrderId ||
    body.orderid ||
    ""
  ).trim();
}

function redirectCheckout(res, state, oid) {
  const qs = new URLSearchParams();
  qs.set("garanti", state);
  if (oid) qs.set("oid", oid);
  return res.redirect(`/checkout.html?${qs.toString()}`);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const body = await readPost(req);
    const oid = pickOid(body);

    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : String(process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

    if (!base) {
      return redirectCheckout(res, "fail", oid);
    }

    const notifyRes = await fetch(`${base}/api/garanti/notify`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.GARANTI_NOTIFY_SECRET
          ? { "x-garanti-notify-secret": String(process.env.GARANTI_NOTIFY_SECRET) }
          : {}),
      },
      body: JSON.stringify(body),
    });

    const redirectedTo = notifyRes.headers.get("location");
    if (redirectedTo) {
      return res.redirect(redirectedTo);
    }

    return redirectCheckout(res, notifyRes.ok ? "ok" : "fail", oid);
  } catch (_) {
    return redirectCheckout(res, "fail", "");
  }
}
