/* =========================================================
   store.js — AIVO STORE V2 (FAZ-2 FINAL)
   ---------------------------------------------------------
   KURALLAR (KESİN):
   - Kredinin TEK kaynağı BACKEND'dir
   - Frontend kredi HESAPLAMAZ, ARTIRMAZ, RESTORE ETMEZ
   - localStorage = sadece CACHE
   - Stripe / PayTR / satın alma burada YOK
   ========================================================= */

(function () {
  "use strict";
  if (window.AIVO_STORE_V2) return;

  const KEY = "aivo_store_v2";

  /* ================= HELPERS ================= */

  function toInt(v) {
    v = Number(v);
    return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  }

  function nowISO() {
    try { return new Date().toISOString(); } catch (_) { return ""; }
  }

  function safeJSON(raw) {
    try { return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
  }

  /* ================= STATE ================= */

  function defaultState() {
    return {
      credits: 0,
      ts: nowISO()
    };
  }

  function readState() {
    try {
      const raw = localStorage.getItem(KEY);
      const s = safeJSON(raw);
      if (!s || typeof s !== "object") return defaultState();
      return {
        credits: toInt(s.credits),
        ts: s.ts || nowISO()
      };
    } catch (_) {
      return defaultState();
    }
  }

  function writeState(next) {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        credits: toInt(next.credits),
        ts: nowISO()
      }));
    } catch (_) {}
  }

  /* ================= EVENTS ================= */

  function emitCredits(credits) {
    try {
      window.dispatchEvent(
        new CustomEvent("aivo:credits-changed", {
          detail: { credits: toInt(credits) }
        })
      );
    } catch (_) {}
  }

  /* ================= PUBLIC API ================= */

  /**
   * Backend'den okunan kredi UI'ya basılır
   * Bu fonksiyon SADECE server cevabı ile çağrılmalıdır
   */
  function setCreditsFromServer(value) {
    const credits = toInt(value);
    writeState({ credits });
    emitCredits(credits);
    return credits;
  }

  /**
   * UI / badge / paneller sadece buradan okur
   */
  function getCredits() {
    return readState().credits;
  }

  /**
   * Üretim sırasında (müzik/video) LOCAL düşüm
   * ⚠️ Bu bile tercihen backend ile sync edilmelidir
   */
  function consumeCreditsLocal(amount) {
    amount = toInt(amount);
    const s = readState();
    if (s.credits < amount) return false;

    const next = s.credits - amount;
    writeState({ credits: next });
    emitCredits(next);
    return true;
  }

  /**
   * Logout / login / refresh sırasında
   * Backend tekrar çağrıldığında overwrite edilir
   */
  function clearCache() {
    try { localStorage.removeItem(KEY); } catch (_) {}
  }

  /* ================= EXPORT ================= */

  window.AIVO_STORE_V2 = {
    // READ
    getCredits,

    // WRITE (SADECE BACKEND)
    setCreditsFromServer,

    // OPTIONAL (LOCAL CONSUME)
    consumeCreditsLocal,

    // UTILS
    clearCache,

    // DEBUG
    _read: readState
  };

})();
