/* =========================================================
   AIVO STORE v1 — SINGLE SOURCE OF TRUTH
   - Credits only
   - Purchase apply only
   - NO selectedPack
   ========================================================= */

(function () {
  "use strict";
  if (window.AIVO_STORE_V1) return;

  const KEY = "aivo_store_v1";

  /* ================= HELPERS ================= */

  function toInt(v) {
    v = Number(v);
    return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  }

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { v: 1, credits: 0 };
      const s = JSON.parse(raw);
      return {
        v: 1,
        credits: toInt(s.credits),
      };
    } catch {
      return { v: 1, credits: 0 };
    }
  }

  function write(s) {
    localStorage.setItem(KEY, JSON.stringify(s));
    return s;
  }

  function emitCreditsChanged(credits) {
    try {
      window.dispatchEvent(
        new CustomEvent("aivo:credits-changed", {
          detail: { credits: toInt(credits) },
        })
      );
    } catch (_) {}
  }

  /* ================= PUBLIC CREDIT API ================= */

  function getCredits() {
    return read().credits;
  }

  function setCredits(v) {
    const s = read();
    s.credits = toInt(v);
    write(s);
    emitCreditsChanged(s.credits);
    return s.credits;
  }

  function addCredits(delta) {
    const s = read();
    s.credits = toInt(s.credits + toInt(delta));
    write(s);
    emitCreditsChanged(s.credits);
    return s.credits;
  }

  function consumeCredits(delta) {
    const s = read();
    delta = toInt(delta);
    if (s.credits < delta) return false;
    s.credits -= delta;
    write(s);
    emitCreditsChanged(s.credits);
    return true;
  }

  /* ================= PACK DEFINITIONS ================= */

  const PACKS = {
    "199":  { price: 199,  credits: 25  },
    "399":  { price: 399,  credits: 60  },
    "899":  { price: 899,  credits: 150 },
    "2999": { price: 2999, credits: 500 }
  };

  /* ================= PURCHASE APPLY ================= */
  // success callback’te çağrılacak
  // payload = { pack: "199", credits?, order_id? }

  function applyPurchase(payload) {
    payload = payload || {};

    const packKey = String(payload.pack || "").trim();
    const orderId = String(payload.order_id || payload.orderId || "").trim();

    let creditsToAdd = toInt(payload.credits);

    // credits backend’den gelmediyse PACKS’ten al
    if (!creditsToAdd) {
      const p = PACKS[packKey];
      if (!p) {
        return { ok: false, reason: "unknown_pack", packKey };
      }
      creditsToAdd = p.credits;
    }

    // Çifte yazımı engelle
    if (orderId) {
      const lockKey = "AIVO_PURCHASE_APPLIED_" + orderId;
      if (localStorage.getItem(lockKey) === "1") {
        return { ok: false, reason: "already_applied", orderId };
      }
      localStorage.setItem(lockKey, "1");
    }

    const after = addCredits(creditsToAdd);
    return { ok: true, added: creditsToAdd, credits: after, orderId };
  }

  /* ================= EXPORT ================= */

  window.AIVO_STORE_V1 = {
    getCredits,
    setCredits,
    addCredits,
    consumeCredits,
    applyPurchase,
  };

})();
