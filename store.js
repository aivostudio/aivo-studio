/* =========================================================
   AIVO STORE v1 — SINGLE SOURCE OF TRUTH (TEK OTORİTE)
   - credits + selectedPack + purchase apply (idempotent)
   - legacy credits migration
   ========================================================= */
(function () {
  "use strict";
  if (window.AIVO_STORE_V1) return;

  var KEY = "aivo_store_v1";
  var MIG_FLAG = "aivo_store_v1_migrated";

  // Pack → Credits (frontend gösterim / fallback için)
  var PACKS = {
    "199":  { credits: 25  },
    "399":  { credits: 60  },
    "899":  { credits: 150 },
    "2999": { credits: 500 }
  };

  function toInt(v) {
    v = Number(v);
    return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  }

  function safeStr(v) {
    return String(v == null ? "" : v).trim();
  }

  /* ================= CORE READ / WRITE ================= */

  function read() {
    var raw = localStorage.getItem(KEY);
    if (!raw) return { v: 1, credits: 0, selectedPack: null };

    try {
      var s = JSON.parse(raw);
      if (!s || typeof s !== "object") return { v: 1, credits: 0, selectedPack: null };
      s.v = 1;
      s.credits = toInt(s.credits);
      s.selectedPack = s.selectedPack ? safeStr(s.selectedPack) : null;
      return s;
    } catch (_) {
      return { v: 1, credits: 0, selectedPack: null };
    }
  }

  function write(s) {
    localStorage.setItem(KEY, JSON.stringify(s));
    return s;
  }

  /* ================= MIGRATION (LEGACY) ================= */

  function migrateOnce() {
    if (localStorage.getItem(MIG_FLAG) === "1") return;

    // Eski anahtarlar (sende geçmişte bunlar kullanıldı)
    var legacyKeys = ["aivo_credits", "AIVO_CREDITS", "credits"];
    var legacyVal = null;

    for (var i = 0; i < legacyKeys.length; i++) {
      var v = localStorage.getItem(legacyKeys[i]);
      if (v != null && v !== "") { legacyVal = v; break; }
    }

    if (legacyVal != null) {
      var s = read();
      if (!s.credits) {
        s.credits = toInt(legacyVal);
        write(s);
      }
    }

    localStorage.setItem(MIG_FLAG, "1");
  }

  /* ================= EVENTS ================= */

  function emitCreditsChanged(credits) {
    try {
      window.dispatchEvent(new CustomEvent("aivo:credits-changed", { detail: { credits: toInt(credits) } }));
    } catch (_) {}
  }

  function emitPackChanged(pack) {
    try {
      window.dispatchEvent(new CustomEvent("aivo:pack-changed", { detail: { pack: pack || null } }));
    } catch (_) {}
  }

  /* ================= CREDITS API ================= */

  function getCredits() {
    return read().credits;
  }

  function setCredits(v) {
    var s = read();
    s.credits = toInt(v);
    write(s);
    emitCreditsChanged(s.credits);

    // UI refresh hook’ların varsa
    try { window.callCreditsUIRefresh && window.callCreditsUIRefresh(); } catch (_) {}
    return s.credits;
  }

  function addCredits(delta) {
    delta = toInt(delta);
    var s = read();
    s.credits = toInt(s.credits + delta);
    write(s);
    emitCreditsChanged(s.credits);
    try { window.callCreditsUIRefresh && window.callCreditsUIRefresh(); } catch (_) {}
    return s.credits;
  }

  function consumeCredits(delta) {
    delta = toInt(delta);
    var s = read();
    if (s.credits < delta) return false;

    s.credits = toInt(s.credits - delta);
    write(s);
    emitCreditsChanged(s.credits);
    try { window.callCreditsUIRefresh && window.callCreditsUIRefresh(); } catch (_) {}
    return true;
  }

  function syncCreditsUI() {
    emitCreditsChanged(getCredits());
  }

  /* ================= PACK (SELECTED) API ================= */

  function getSelectedPack() {
    return read().selectedPack;
  }

  function setSelectedPack(pack) {
    pack = safeStr(pack);
    // sadece bilinen paketler
    if (!PACKS[pack]) {
      // bilinmeyen pack set etmeyelim
      var s0 = read();
      s0.selectedPack = null;
      write(s0);
      emitPackChanged(null);
      return null;
    }

    var s = read();
    s.selectedPack = pack;
    write(s);
    emitPackChanged(pack);
    return pack;
  }

  function clearSelectedPack() {
    var s = read();
    s.selectedPack = null;
    write(s);
    emitPackChanged(null);
  }

  /* ================= PURCHASE APPLY (IDEMPOTENT) =================
     checkout success sonrası tek sefer uygulanır:
     payload: { order_id, pack, credits }
  =============================================================== */

  function applyPurchase(payload) {
    payload = payload || {};
    var orderId = safeStr(payload.order_id || payload.orderId || payload.oid);
    var packKey = safeStr(payload.pack || payload.pack_key || payload.packKey);
    var creditsFromServer = toInt(payload.credits);

    // 1) credits server’dan geldiyse onu kullan
    var add = creditsFromServer;

    // 2) yoksa pack mapping’den hesapla
    if (!add) {
      if (!PACKS[packKey]) return { ok: false, reason: "unknown_pack", packKey: packKey };
      add = toInt(PACKS[packKey].credits);
    }

    // 3) çifte yazmayı engelle (order_id varsa)
    if (orderId) {
      var lockKey = "AIVO_PURCHASE_APPLIED_" + orderId;
      if (localStorage.getItem(lockKey) === "1") {
        return { ok: false, reason: "already_applied", orderId: orderId };
      }
      localStorage.setItem(lockKey, "1");
    }

    var after = addCredits(add);

    // başarılı ise selectedPack'i temizlemek mantıklı (isteğe bağlı ama pratik)
    try { clearSelectedPack(); } catch (_) {}

    return { ok: true, added: add, credits: after, orderId: orderId || null };
  }

  /* ================= INIT ================= */

  migrateOnce();

  /* ================= EXPORT ================= */

  window.AIVO_STORE_V1 = {
    // credits
    getCredits: getCredits,
    setCredits: setCredits,
    addCredits: addCredits,
    consumeCredits: consumeCredits,
    syncCreditsUI: syncCreditsUI,

    // pack
    getSelectedPack: getSelectedPack,
    setSelectedPack: setSelectedPack,
    clearSelectedPack: clearSelectedPack,

    // purchase
    applyPurchase: applyPurchase,

    // debug
    _read: read,
    _write: write,
    _packs: PACKS
  };
})();
