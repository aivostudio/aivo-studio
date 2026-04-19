// /api/garanti/callback.js
// Kullanıcının browser dönüş noktası
// Amaç: browser'dan gelen sonucu al, notify'ye server-side forward et, sonra checkout'a yönlendir

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const oid = String(
      body.oid ||
      body.order_id ||
      body.merchant_oid ||
      body.OrderId ||
      body.orderid ||
      ""
    ).trim();

    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : String(process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

    if (!base) {
      const qs = new URLSearchParams();
      qs.set("garanti", "fail");
      if (oid) qs.set("oid", oid);
      return res.redirect(`/checkout.html?${qs.toString()}`);
    }

    const notifyRes = await fetch(`${base}/api/garanti/notify`, {
      method: "POST",
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

    const qs = new URLSearchParams();
    qs.set("garanti", notifyRes.ok ? "ok" : "fail");
    if (oid) qs.set("oid", oid);
    return res.redirect(`/checkout.html?${qs.toString()}`);
  } catch (_) {
    const qs = new URLSearchParams();
    qs.set("garanti", "fail");
    return res.redirect(`/checkout.html?${qs.toString()}`);
  }
}
