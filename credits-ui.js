/* =========================================================
   AIVO — CREDITS UI SYNC (SERVER SOURCE OF TRUTH)
   - Source of truth: /api/credits/get?email=...
   - Updates store if available (AIVO_STORE_V1.setCredits)
   - Updates UI targets: #topCreditCount + #creditCount
   - Listens: aivo:credits-changed
   ========================================================= */

(function () {
  "use strict";

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

  function writeCreditsToTargets(v) {
    var n = String(Number(v) || 0);
    var ok = false;

    var el1 = document.getElementById("topCreditCount");
    if (el1) { el1.textContent = n; ok = true; }

    var el2 = document.getElementById("creditCount");
    if (el2) { el2.textContent = n; ok = true; }

    return ok;
  }

  function setStoreCreditsIfPossible(credits) {
    try {
      if (window.AIVO_STORE_V1) {
        // setCredits varsa kullan (yoksa problem değil)
        if (typeof window.AIVO_STORE_V1.setCredits === "function") {
          window.AIVO_STORE_V1.setCredits(Number(credits) || 0);
          return true;
        }
      }
    } catch (_) {}
    return false;
  }

  function dispatchCreditsChanged(credits) {
    try {
      window.dispatchEvent(new CustomEvent("aivo:credits-changed", {
        detail: { credits: Number(credits) || 0 }
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

      var credits = Number(j.credits) || 0;

      // 1) Store'u güncelle (varsa)
      var storeOk = setStoreCreditsIfPossible(credits);

      // 2) UI yaz (store güncellenmese bile)
      writeCreditsToTargets(credits);

      // 3) Event bas (diğer modüller yakalasın)
      dispatchCreditsChanged(credits);

      // Debug için (istersen sonra kaldırırız)
      // console.log("[AIVO] credits refreshed:", { reason: reason || "unknown", email: email, credits: credits, storeOk: storeOk });

      return { ok: true, email: email, credits: credits, storeOk: storeOk };
    } catch (e) {
      return { ok: false, error: "FETCH_ERROR", message: String(e && e.message ? e.message : e) };
    }
  }

  function syncOnceFromStoreIfReady() {
    try {
      if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.getCredits === "function") {
        var c = Number(window.AIVO_STORE_V1.getCredits() || 0);
        writeCreditsToTargets(c);
        return true;
      }
    } catch (_) {}
    return false;
  }

  function boot() {
    // 0) Önce store'dan hızlı bir paint (varsa)
    syncOnceFromStoreIfReady();

    // 1) Mutlaka server'dan refresh (gerçek kaynak)
    refreshFromServer("boot");

    // 2) Event ile anlık güncelle (ör. spend/consume sonrası)
    window.addEventListener("aivo:credits-changed", function (e) {
      var c = e && e.detail ? e.detail.credits : null;
      if (typeof c === "number") writeCreditsToTargets(c);
      else syncOnceFromStoreIfReady();
    });

    // 3) Sayfa görünür olunca tekrar server refresh (Safari tab discard vb.)
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) {
        refreshFromServer("visibility");
      }
    });
  }

  // dışarıdan manuel test için
  window.AIVO_REFRESH_CREDITS = function () {
    return refreshFromServer("manual");
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
