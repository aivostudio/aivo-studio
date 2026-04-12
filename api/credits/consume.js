// /api/credits/consume.js
import kvMod from "../_kv.js";

/* =========================
   SESSION (TEK OTORİTE – KV)
   sess:{sid} -> { email: "...", ... }
   ========================= */
const kv = kvMod?.default || kvMod || {};
const kvGetJson = kv.kvGetJson;
const kvGet = kv.kvGet;
const kvSet = kv.kvSet;

async function getSession(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/aivo_sess=([^;]+)/);
  if (!match) return null;

  const sid = match[1];
  if (!sid || typeof kvGetJson !== "function") return null;

  const sess = await kvGetJson(`sess:${sid}`).catch(() => null);
  if (!sess || !sess.email) return null;

  return sess; // en az { email }
}

function isJson(req) {
  return String(req.headers["content-type"] || "")
    .toLowerCase()
    .includes("application/json");
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    if (!isJson(req)) {
      return res.status(415).json({ ok: false, error: "UNSUPPORTED_CONTENT_TYPE" });
    }

    // 🔐 AUTH
    const session = await getSession(req);
    if (!session) {
      return res.status(401).json({ ok: false, error: "unauthorized_no_cookie" });
    }

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : req.body || {};

    const need = Math.max(0, parseInt(body.cost, 10) || 0);
    const reason = body.reason || "unknown";

    const email = String(session.email).trim().toLowerCase();
    if (!email.includes("@")) {
      return res.status(401).json({ ok: false, error: "unauthorized_bad_session" });
    }

    const key = `credits:${email}`;

    if (typeof kvGet !== "function" || typeof kvSet !== "function") {
      return res.status(500).json({
        ok: false,
        error: "KV_HELPER_MISSING",
        detail: "kvGet/kvSet not found in api/_kv.js",
      });
    }

    const have = Number(await kvGet(key).catch(() => 0)) || 0;

    if (need <= 0) {
      return res.status(200).json({ ok: true, credits: have, reason });
    }

    if (have < need) {
      return res.status(402).json({
        ok: false,
        error: "insufficient_credits",
        credits: have,
        need,
      });
    }

    const next = have - need;
    await kvSet(key, next);

    return res.status(200).json({
      ok: true,
      credits: next,
      spent: need,
      reason,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: String(e?.message || e),
    });
  }
}
