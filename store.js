/* AIVO STORE v1 — isolated (SINGLE SOURCE OF TRUTH) */
(function () {
  "use strict";
  if (window.AIVO_STORE_V1) return;

  var KEY = "aivo_store_v1";

  function toInt(v) {
    v = Number(v);
    return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  }

  /* ================= CORE READ / WRITE ================= */

  function read() {
    var raw = localStorage.getItem(KEY);
    if (!raw) return { v: 1, credits: 0 };

    try {
      var s = JSON.parse(raw);
      if (!s || typeof s !== "object") return { v: 1, credits: 0 };
      s.credits = toInt(s.credits);
      return s;
    } catch {
      return { v: 1, credits: 0 };
    }
  }

  function write(s) {
    localStorage.setItem(KEY, JSON.stringify(s));
    return s;
  }

  /* ================= MIGRATION (LEGACY) ================= */

  function migrateOnce() {
    var flag = "aivo_store_v1_migrated";
    if (localStorage.getItem(flag) === "1") return;

    var legacy = localStorage.getItem("aivo_credits");
    if (legacy !== null) {
      var s = read();
      if (!s.credits) {
        s.credits = toInt(legacy);
        write(s);
      }
    }
    localStorage.setItem(flag, "1");
  }

  /* ================= EVENTS ================= */

  function emitCreditsChanged(credits) {
    try {
      window.dispatchEvent(
        new CustomEvent("aivo:credits-changed", {
          detail: { credits: toInt(credits) }
        })
      );
    } catch (_) {}
  }

  /* ================= PUBLIC API ================= */

  function getCredits() {
    return read().credits;
  }

  function setCredits(v) {
    var s = read();
    s.credits = toInt(v);
    write(s);
    emitCreditsChanged(s.credits);
    return s.credits;
  }

  function addCredits(delta) {
    delta = toInt(delta);
    var s = read();
    s.credits = toInt(s.credits + delta);
    write(s);
    emitCreditsChanged(s.credits);
    return s.credits;
  }

  function consumeCredits(delta) {
    delta = toInt(delta);
    var s = read();

    if (s.credits < delta) return false;

    s.credits = toInt(s.credits - delta);
    write(s);
    emitCreditsChanged(s.credits);
    return true;
  }

  function syncCreditsUI() {
    emitCreditsChanged(getCredits());
  }

  /* ================= INIT ================= */

  migrateOnce();

  /* ================= EXPORT ================= */

  window.AIVO_STORE_V1 = {
    getCredits: getCredits,
    setCredits: setCredits,
    addCredits: addCredits,
    consumeCredits: consumeCredits,
    syncCreditsUI: syncCreditsUI
  };
})();
