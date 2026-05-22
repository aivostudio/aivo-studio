import crypto from "node:crypto";
import kvMod from "../_kv.js";

const kv = kvMod?.default || kvMod || {};
const kvSetJson = kv.kvSetJson;

function makeId(prefix) {
  return [
    prefix,
    Date.now(),
    crypto.randomBytes(8).toString("hex")
  ].join("_");
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "method_not_allowed"
      });
    }

    const body = req.body || {};

    const userId = String(body.user_id || body.userId || body.email || "").trim().toLowerCase();
    const email = String(body.email || "").trim().toLowerCase();
    const plan = String(body.plan || "").trim().toLowerCase();

    const PLAN_MAP = {
      baslangic: {
        productId: "tr.aivo.credits.25",
        credits: 25
      },
      standart: {
        productId: "tr.aivo.credits.100",
        credits: 100
      },
      pro: {
        productId: "tr.aivo.credits.200",
        credits: 200
      },
      studyo: {
        productId: "tr.aivo.credits.500",
        credits: 500
      }
    };

    const selected = PLAN_MAP[plan];

    if (!userId || !email || !email.includes("@")) {
      return res.status(400).json({
        ok: false,
        error: "missing_user"
      });
    }

    if (!selected) {
      return res.status(400).json({
        ok: false,
        error: "invalid_plan",
        allowed: Object.keys(PLAN_MAP)
      });
    }

    if (typeof kvSetJson !== "function") {
      return res.status(500).json({
        ok: false,
        error: "kv_not_ready"
      });
    }

    const purchaseId = makeId("play_purchase");

    await kvSetJson(
      "play_billing:init:" + purchaseId,
      {
        provider: "google_play_billing",
        purchase_id: purchaseId,
        user_id: userId,
        email,
        plan,
        productId: selected.productId,
        credits: selected.credits,
        status: "initialized",
        createdAt: new Date().toISOString()
      },
      { ex: 60 * 60 * 24 }
    );

    return res.status(200).json({
      ok: true,
      provider: "google_play_billing",
      purchase_id: purchaseId,
      productId: selected.productId,
      credits: selected.credits
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "play_billing_init_failed",
      detail: err && err.message ? err.message : "Unknown error"
    });
  }
}
