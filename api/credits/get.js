// /api/credits/get.js
const kvMod = require("../_kv.js");
const kv = (kvMod && (kvMod.default || kvMod)) || {};
const kvGetJson = kv.kvGetJson;

function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  const parts = raw.split(";").map((s) => s.trim());
  for (const p of parts) {
    const i = p.indexOf("=");
    if (i > -1) {
      const k = p.slice(0, i);
      const v = p.slice(i + 1);
      if (k === name) return v;
    }
  }
  return "";
}

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : 0;
}

module.exports = async (req, res) => {
  try {
    if (typeof kvGetJson !== "function") {
      return res.status(503).json({ ok: false, error: "kv_not_available" });
    }

    // ✅ Session cookie (yeni + legacy)
    const sid =
      readCookie(req, "aivo_sess") ||
      readCookie(req, "aivo_session"); // legacy

    if (!sid) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    // ✅ KV session -> email
    const sess = await kvGetJson(`sess:${sid}`).catch(() => null);
    const email = String(sess && sess.email ? sess.email : "").trim().toLowerCase();

    if (!email) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    // ✅ Credits (verify-session bunu "credits:${email}" olarak yazıyor)
    const creditsRaw = await kvGetJson(`credits:${email}`).catch(() => null);
    const credits = toInt(creditsRaw);

    return res.status(200).json({ ok: true, email, credits });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
  }
};
