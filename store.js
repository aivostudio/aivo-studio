/* =========================================================
   store.js — AIVO STORE V1 (TEK OTORİTE) — FINAL (WIPE SAFE)
   - credits (single source)
   - selectedPack (199/399/899/2999)
   - applyPurchase (idempotent)
   - invoices: backup/restore + wipe protection
   - ✅ store backup/restore + wipe protection (1 saat sonra sıfırlanma fix)
   ========================================================= */
(function () {
  "use strict";
  if (window.AIVO_STORE_V1) return;

  var KEY = "aivo_store_v1";
  var KEY_BAK = "aivo_store_v1_backup";            // ✅ NEW
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

  function nowISO() {
    try { return new Date().toISOString(); } catch (_) { return ""; }
  }

  function DEFAULT_STORE() {
    return { v: 1, credits: 0, selectedPack: null, ts: nowISO() };
  }

  function isObj(x) {
    return !!x && typeof x === "object";
  }

  function normalizeStore(s) {
    if (!isObj(s)) return DEFAULT_STORE();
    if (!("v" in s)) s.v = 1;

    s.credits = toInt(s.credits);
    s.selectedPack = s.selectedPack == null ? null : safeStr(s.selectedPack);
    if (s.selectedPack === "") s.selectedPack = null;

    // ts yoksa ekle
    if (!s.ts) s.ts = nowISO();
    return s;
  }

  function parseJSON(raw) {
    try { return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
  }

  function isDefaultLike(s) {
    // "tam default" görünümlü overwrite tespiti
    return isObj(s) && toInt(s.credits) === 0 && (s.selectedPack == null || safeStr(s.selectedPack) === "");
  }

  /* ================= CORE READ / WRITE (SAFE) ================= */

  function readRawKey(k) {
    try { return localStorage.getItem(k); } catch (_) { return null; }
  }

  function writeRawKey(k, v) {
    try { localStorage.setItem(k, v); } catch (_) {}
  }

  function read() {
    // 1) ana key
    var raw = readRawKey(KEY);
    var main = normalizeStore(parseJSON(raw));

    // 2) backup key
    var bakRaw = readRawKey(KEY_BAK);
    var bak = normalizeStore(parseJSON(bakRaw));

    // ✅ RECOVERY:
    // Ana key "default'a düşmüş" görünüyor ama backup doluysa geri yükle.
    // Bu, dışarıdaki başka script'in KEY'i ezmesi durumunu otomatik toparlar.
    if (isDefaultLike(main) && !isDefaultLike(bak) && bak.credits > 0) {
      // backup'ı geri yaz
      writeRawKey(KEY, JSON.stringify(bak));
      return bak;
    }

    return main;
  }

  // write(s, {force:true}) => bilinçli yazım (consumeCredits ile 0'a düşmek gibi)
  function write(s, opts) {
    opts = opts || {};
    var next = normalizeStore(s);
    next.ts = nowISO();

    var cur = normalizeStore(parseJSON(readRawKey(KEY)));

    // 🔒 WIPE PROTECTION:
    // DOLU store varken, dışarıdan "default" gibi bir payload ile overwrite'i engelle.
    // Ancak consumeCredits/setCredits gibi bilinçli (force) yazımlara izin ver.
    if (!opts.force) {
      if (!isDefaultLike(cur) && cur.credits > 0 && isDefaultLike(next)) {
        console.warn("[AIVO][STORE] write blocked: prevent default overwrite.");
        // ana key korunur, backup üzerinden de korunmuş olur
        return cur;
      }
    }

    var json = JSON.stringify(next);
    writeRawKey(KEY, json);
    writeRawKey(KEY_BAK, json); // ✅ backup her başarılı yazımda güncellenir
    return next;
  }

  /* ================= MIGRATION (LEGACY) =================
     Eski anahtarlar varsa krediyi içeri al.
     ✅ Değişiklik yoksa yazma (gereksiz overwrite’i azaltır)
  ======================================================= */

  function migrateOnce() {
    if (readRawKey(MIGRATED_FLAG) === "1") return;

    var before = read();
    var s = normalizeStore(before);

    // Eski krediler (varsa)
    var legacy =
      readRawKey("aivo_credits") ??
      readRawKey("AIVO_CREDITS") ??
      readRawKey("credits");

    if (legacy != null && !s.credits) {
      s.credits = toInt(legacy);
    }

    // Eski selected pack (varsa)
    var legacyPack =
      readRawKey("aivo_selected_pack") ??
      readRawKey("AIVO_SELECTED_PACK");

    if (legacyPack && !s.selectedPack) {
      s.selectedPack = safeStr(legacyPack);
    }

    // ✅ sadece değiştiyse yaz
    var beforeStr = JSON.stringify(normalizeStore(before));
    var afterStr  = JSON.stringify(normalizeStore(s));

    if (beforeStr !== afterStr) {
      write(s, { force: true });
    } else {
      // backup yoksa en azından bir kez oluştur
      if (!readRawKey(KEY_BAK)) {
        write(before, { force: true });
      }
    }

    writeRawKey(MIGRATED_FLAG, "1");
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
    write(s, { force: true }); // ✅ bilinçli yazım
    emitCreditsChanged(s.credits);
    return s.credits;
  }

  function addCredits(delta) {
    delta = toInt(delta);
    var s = read();
    s.credits = toInt(s.credits + delta);
    write(s, { force: true }); // ✅ bilinçli yazım
    emitCreditsChanged(s.credits);
    return s.credits;
  }

  function consumeCredits(delta) {
    delta = toInt(delta);
    var s = read();
    if (s.credits < delta) return false;
    s.credits = toInt(s.credits - delta);
    write(s, { force: true }); // ✅ bilinçli yazım (0'a düşebilir)
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
      write(s, { force: true });
      emitPackChanged(null);
      return null;
    }

    s.selectedPack = pack;
    write(s, { force: true });

    // legacy mirror (istersen kaldırırsın)
    try { writeRawKey("AIVO_SELECTED_PACK", pack); } catch (_) {}
    try { writeRawKey("aivo_selected_pack", pack); } catch (_) {}

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
    write(s, { force: true });
    emitPackChanged(null);
    return null;
  }

  /* ================= INVOICES (LOCAL) =================
     Satın alma olunca invoice kaydı üretir (localStorage)
     ✅ Koruma:
       - Backup key: aivo_invoices_v1_backup
       - Ana key boş/bozulmuşsa backup'tan geri yükle
       - Mevcut dolu veri varken [] overwrite engeli
  ===================================================== */

  var INVOICE_KEY = "aivo_invoices_v1";
  var INVOICE_BAK = "aivo_invoices_v1_backup";

  function _parseInvoices(raw) {
    try {
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }

  function readInvoices() {
    // 1) ana key
    var raw = null;
    try { raw = localStorage.getItem(INVOICE_KEY); } catch (_) { raw = null; }
    var arr = _parseInvoices(raw);

    // 2) boşsa backup'tan dön
    if (!Array.isArray(arr) || arr.length === 0) {
      var bakRaw = null;
      try { bakRaw = localStorage.getItem(INVOICE_BAK); } catch (_) { bakRaw = null; }
      var bak = _parseInvoices(bakRaw);

      if (Array.isArray(bak) && bak.length > 0) {
        // geri yükle
        try { localStorage.setItem(INVOICE_KEY, JSON.stringify(bak)); } catch (_) {}
        return bak;
      }
      return [];
    }

    return arr;
  }

  function writeInvoices(arr) {
    arr = Array.isArray(arr) ? arr : [];

    // 🔒 Wipe protection:
    // Mevcut listede kayıt varken, "[]" yazılmasını engelle (explicit clearInvoices hariç)
    var cur = readInvoices();
    if (cur.length > 0 && arr.length === 0) {
      console.warn("[AIVO][INVOICES] writeInvoices blocked: prevent empty overwrite.");
      return cur;
    }

    var json = JSON.stringify(arr);

    try { localStorage.setItem(INVOICE_KEY, json); } catch (_) {}
    try { localStorage.setItem(INVOICE_BAK, json); } catch (_) {}

    return arr;
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

  function clearInvoices() {
    // explicit wipe (kasıtlı temizleme)
    try { localStorage.setItem(INVOICE_KEY, "[]"); } catch (_) {}
    try { localStorage.setItem(INVOICE_BAK, "[]"); } catch (_) {}
    return [];
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
    addInvoice: function (inv) { return addInvoice(inv); },
    clearInvoices: function () { return clearInvoices(); },

    // debug
    _readInvoices: readInvoices,
    _read: read,
    _write: write,
    _packs: PACKS
  };

})();
