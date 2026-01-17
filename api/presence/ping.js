// api/presence/ping.js
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const body = req.body || {};
    const email = String(body.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "email_required" });
    }

    const kvmod = await import("../_kv.js");
    const kv = kvmod.default || kvmod;

    // 90 sn TTL: son 90 sn ping atan “online” sayılır
    const key = "presence:" + email;
    await kv.kvSetJson(key, { email, ts: Date.now() }, { ex: 90 });

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "presence_ping_failed", message: err?.message || String(err) });
  }
}
