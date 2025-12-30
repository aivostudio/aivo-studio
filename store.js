/* =========================================================
   store.js — AIVO STORE V1 (TEK OTORİTE)
   - credits (single source)
   - selectedPack (199/399/899/2999)
   - applyPurchase (idempotent)
   ========================================================= */
(function () {
  "use strict";
  if (window.AIVO_STORE_V1) return;

  var KEY = "aivo_store_v1";
  var MIGRATED_FLAG = "aivo_store_v1_migrated";

  // Paket eşlemesi (fiyat anahtarı -> kredi)
  var PACKS = {
    "199":  { price: 199,  credits: 25  },
    "399":  { price: 399,  credits: 60  },
    "899":  { price: 899,  credits: 150 },
    "2999": { price: 2999, credits: 500 }
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
      s.credits = toInt(s.credits);
      s.selectedPack = s.selectedPack == null ? null : safeStr(s.selectedPack);
      return s;
    } catch (_) {
      return { v: 1, credits: 0, selectedPack: null };
    }
  }

  function write(s) {
    localStorage.setItem(KEY, JSON.stringify(s));
    return s;
  }

  /* ================= MIGRATION (LEGACY) =================
     Eski anahtarlar varsa krediyi içeri al.
  ======================================================= */

  function migrateOnce() {
    if (localStorage.getItem(MIGRATED_FLAG) === "1") return;

    var s = read();

    // Eski krediler (varsa)
    var legacy =
      localStorage.getItem("aivo_credits") ??
      localStorage.getItem("AIVO_CREDITS") ??
      localStorage.getItem("credits");

    if (legacy != null && !s.credits) {
      s.credits = toInt(legacy);
    }

    // Eski selected pack (varsa)
    var legacyPack =
      localStorage.getItem("aivo_selected_pack") ??
      localStorage.getItem("AIVO_SELECTED_PACK");

    if (legacyPack && !s.selectedPack) {
      s.selectedPack = safeStr(legacyPack);
    }

    write(s);
    localStorage.setItem(MIGRATED_FLAG, "1");
  }

  /* ================= EVENTS ================= */

  function emit(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (_) {}
  }

  function emitCreditsChanged(credits) {
    emit("aivo:credits-changed", { credits: toInt(credits) });
  }

  function emitPackChanged(pack) {
    emit("aivo:pack-changed", { pack: pack || null });
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

  /* ================= SELECTED PACK API ================= */

  function setSelectedPack(pack) {
    pack = safeStr(pack);
    var s = read();

    // sadece tanımlı pack'lere izin verelim (backend ile aynı liste)
    if (!PACKS[pack]) {
      s.selectedPack = null;
      write(s);
      emitPackChanged(null);
      return null;
    }

    s.selectedPack = pack;
    write(s);

    // legacy mirror (istersen kaldırırsın)
    try { localStorage.setItem("AIVO_SELECTED_PACK", pack); } catch (_) {}
    try { localStorage.setItem("aivo_selected_pack", pack); } catch (_) {}

    emitPackChanged(pack);
    return pack;
  }

  function getSelectedPack() {
    var s = read();
    var p = s.selectedPack ? safeStr(s.selectedPack) : "";
    return PACKS[p] ? p : null;
  }

  function clearSelectedPack() {
    var s = read();
    s.selectedPack = null;
    write(s);
    emitPackChanged(null);
    return null;
  }

  /* ================= INVOICES (LOCAL) =================
     Satın alma olunca invoice kaydı üretir (localStorage)
  ===================================================== */

  var INVOICE_KEY = "aivo_invoices_v1";

  function readInvoices() {
    try {
      var raw = localStorage.getItem(INVOICE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }

  function writeInvoices(arr) {
    try { localStorage.setItem(INVOICE_KEY, JSON.stringify(arr || [])); } catch (_) {}
    return arr || [];
  }

  function addInvoice(inv) {
    var list = readInvoices();

    // idempotent: aynı order_id tekrar eklenmesin
    if (inv && inv.order_id) {
      var exists = list.some(function (x) {
        return x && x.order_id === inv.order_id;
      });
      if (exists) return list;
    }

    list.unshift(inv);
    writeInvoices(list);

    try {
      window.dispatchEvent(
        new CustomEvent("aivo:invoices-changed", { detail: { invoices: list } })
      );
    } catch (_) {}

    return list;
  }

  /* ================= PURCHASE APPLY (IDEMPOTENT) =================
     Checkout dönüşlerinde TEK yerden kredi ekleme
  ================================================================ */

  function applyPurchase(payload) {
    payload = payload || {};

    var orderId = safeStr(payload.order_id || payload.orderId || payload.oid);
    var packKey = safeStr(payload.pack || payload.pack_key || payload.price);
    var creditsFromServer = toInt(payload.credits);

    // 1) server kredisi geldiyse onu baz al
    var add = creditsFromServer;

    // 2) yoksa mapping'den bul
    if (!add) {
      if (!PACKS[packKey]) {
        return { ok: false, reason: "unknown_pack", packKey: packKey, allowed: Object.keys(PACKS) };
      }
      add = toInt(PACKS[packKey].credits);
    }

    // 3) idempotency (order/session bazlı)
    if (orderId) {
      var lockKey = "AIVO_PURCHASE_APPLIED_" + orderId;
      if (localStorage.getItem(lockKey) === "1") {
        return { ok: false, reason: "already_applied", orderId: orderId };
      }
      localStorage.setItem(lockKey, "1");
    }

    var after = addCredits(add);

    // ✅ invoice kaydı (stripe / paytr fark etmez; applyPurchase nereden çağrılırsa çağrılsın çalışır)
    addInvoice({
      order_id: orderId || ("local_" + Date.now()),
      provider: safeStr(payload.provider || payload.gateway || "stripe"), // "stripe" | "paytr"
      type: "purchase",
      pack: packKey,
      amount_try: PACKS[packKey] ? PACKS[packKey].price : toInt(packKey),
      credits: add,
      created_at: new Date().toISOString(),
      status: "paid"
    });

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

    // packs
    setSelectedPack: setSelectedPack,
    getSelectedPack: getSelectedPack,
    clearSelectedPack: clearSelectedPack,

    // purchase
    applyPurchase: applyPurchase,

    // ✅ invoices (PUBLIC)
    listInvoices: function () { return readInvoices(); },
    addInvoice: function (inv) { return addInvoice(inv); }, // istersen dışarı da aç
    clearInvoices: function () { writeInvoices([]); return []; },

    // debug
    _readInvoices: readInvoices,
    _read: read,
    _write: write,
    _packs: PACKS
  };

})();
