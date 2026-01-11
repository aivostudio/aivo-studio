/* =========================================================
   AIVO — CREDITS UI SYNC (SERVER SOURCE OF TRUTH) — FINAL
   - Source of truth: /api/credits/get?email=...
   - NO TOAST here (toast only in payment flow with `added`)
   - Updates UI targets:
       #topCredits, #topCreditCount, #creditPillValue, #creditCount
     + [data-topbar-credits]
   - Updates store ONLY if AIVO_STORE_V1.setCredits exists
   - Emits: aivo:credits-updated { credits }
   - Public: window.AIVO_REFRESH_CREDITS()
   ========================================================= */

(function () {
  "use strict";

  // hard guard
  if (window.__AIVO_CREDITS_UI_LOADED__) return;
  window.__AIVO_CREDITS_UI_LOADED__ = true;

  function safeNum(v) {
    var n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function pickEmailFromClient() {
    try {
      var b = document.body;
      var bodyEmail = b && b.getAttribute ? (b.getAttribute("data-email") || "") : "";

      var lsEmail =
        localStorage.getItem("aivo_user_email") ||
        localStorage.getItem("user_email") ||
        localStorage.getItem("email") ||
        "";

      var e = String(bodyEmail || lsEmail || "").trim().toLowerCase();
      return e && e.indexOf("@") > 0 ? e : "";
    } catch (_) {
      return "";
    }
  }

  function writeCreditsToTargets(credits) {
    var n = String(safeNum(credits));

    var wrote = false;

    // common targets
    var el;

    el = document.querySelector("[data-topbar-credits]");
    if (el) { el.textContent = n; wrote = true; }

    el = document.getElementById("topCredits");
    if (el) { el.textContent = n; wrote = true; }

    el = document.getElementById("topCreditCount");
    if (el) { el.textContent = n; wrote = true; }

    el = document.getElementById("creditPillValue");
    if (el) { el.textContent = n; wrote = true; }

    el = document.getElementById("creditCount");
    if (el) { el.textContent = n; wrote = true; }

    return wrote;
  }

  function setStoreCreditsIfPossible(credits) {
    try {
      if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.setCredits === "function") {
        window.AIVO_STORE_V1.setCredits(safeNum(credits));
        return true;
      }
    } catch (_) {}
    return false;
  }

  function emitCreditsUpdated(credits) {
    try {
      window.dispatchEvent(new CustomEvent("aivo:credits-updated", {
        detail: { credits: safeNum(credits) }
      }));
    } catch (_) {}
  }

  async function refreshFromServer(reason) {
    var email = pickEmailFromClient();
    if (!email) return { ok: false, error: "NO_EMAIL" };

    try {
      var r = await fetch("/api/credits/get?email=" + encodeURIComponent(email), {
        method: "GET",
        cache: "no-store"
      });

      var txt = await r.text();
      var j = null;
      try { j = JSON.parse(txt); }
      catch { j = { ok: false, error: "NON_JSON", raw: txt }; }

      if (!r.ok || !j || !j.ok) {
        return { ok: false, error: "GET_FAILED", status: r.status, detail: j };
      }

      var credits = safeNum(j.credits);

      // 1) Store update (optional)
      var storeOk = setStoreCreditsIfPossible(credits);

      // 2) UI write
      writeCreditsToTargets(credits);

      // 3) notify
      emitCreditsUpdated(credits);

      return { ok: true, email: email, credits: credits, storeOk: storeOk, reason: reason || "unknown" };
    } catch (e) {
      return { ok: false, error: "FETCH_ERROR", message: String(e && e.message ? e.message : e) };
    }
  }

  function paintFromStoreFast() {
    try {
      if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.getCredits === "function") {
        var c = safeNum(window.AIVO_STORE_V1.getCredits());
        writeCreditsToTargets(c);
        return true;
      }
    } catch (_) {}
    return false;
  }

  function boot() {
    // fast paint (optional)
    paintFromStoreFast();

    // authoritative refresh
    refreshFromServer("boot");

    // when tab becomes visible (Safari discard vs.)
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) refreshFromServer("visibility");
    });
  }

  // manual trigger for debugging
  window.AIVO_REFRESH_CREDITS = function () {
    return refreshFromServer("manual");
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
