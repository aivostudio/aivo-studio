import kvMod from "../_kv.js";

const kv = kvMod?.default || kvMod || {};
const kvGet = kv.kvGet;

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({
        ok: false,
        error: "method_not_allowed"
      });
    }

    const email = String(req.query?.email || "").trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return res.status(400).json({
        ok: false,
        error: "missing_email"
      });
    }

    if (typeof kvGet !== "function") {
      return res.status(500).json({
        ok: false,
        error: "kv_not_ready"
      });
    }

    const raw = await kvGet(`credits:${email}`).catch(() => null);
    const credits = Number(raw) || 0;

    return res.status(200).json({
      ok: true,
      email,
      credits
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "play_credits_get_failed",
      detail: err && err.message ? err.message : "Unknown error"
    });
  }
}
