/* =========================================================
   ✅ STORE.JS — STRIPE FINALIZER + TOAST (TEK OTORİTE / FINAL)
   ---------------------------------------------------------
   - Toast: global toast()/showToast() burada kurulur
   - Stripe dönüşü: ?stripe=success&session_id=...
   - Verify: /api/stripe/verify-session (POST, GET fallback)
   - Apply: AIVO_STORE_V1.applyPurchase(...)
   - Idempotent: aynı session 1 kez işlenir
   ========================================================= */
(function AIVO_STORE_StripeFinalizer_WithToast() {
  "use strict";

  // -------------------------------------------------
  // 0) TOAST (GLOBAL) — yoksa kur
  // -------------------------------------------------
  (function ensureToast() {
    if (typeof window.toast === "function") {
      // showToast yoksa alias ver
      if (typeof window.showToast !== "function") window.showToast = window.toast;
      return;
    }

    function ensure() {
      var c = document.getElementById("aivo-toast");
      if (c) return c;

      var style = document.createElement("style");
      style.id = "aivo-toast-style";
      style.textContent =
        "#aivo-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:999999;display:flex;flex-direction:column;gap:10px;pointer-events:none}" +
        "#aivo-toast .t{min-width:280px;max-width:560px;padding:12px 14px;border-radius:14px;font:600 14px/1.25 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial;color:#fff;box-shadow:0 18px 40px rgba(0,0,0,.35);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.14);opacity:0;transform:translateY(10px);transition:opacity .18s ease,transform .18s ease}" +
        "#aivo-toast .t.ok{background:linear-gradient(90deg,rgba(124,92,255,.92),rgba(255,120,180,.90))}" +
        "#aivo-toast .t.error{background:linear-gradient(90deg,rgba(255,80,120,.92),rgba(255,140,80,.90))}" +
        "#aivo-toast .t.show{opacity:1;transform:translateY(0)}";
      document.head.appendChild(style);

      c = document.createElement("div");
      c.id = "aivo-toast";
      document.body.appendChild(c);
      return c;
    }

   window.legacyToast = function (msg, type) {

      try {
        var c = ensure();
        c.innerHTML = ""; // 🔒 tek toast

        var el = document.createElement("div");
        el.className = "t " + (type === "error" ? "error" : "ok");
        el.textContent = String(msg || "");
        c.appendChild(el);

        requestAnimationFrame(function () { el.classList.add("show"); });

        setTimeout(function () {
          el.classList.remove("show");
          setTimeout(function () {
            if (el && el.parentNode) el.parentNode.removeChild(el);
          }, 220);
        }, 2400);
      } catch (_) {}
    };

  window.showToast = window.legacyToast;

  })();

  // -------------------------------------------------
  // 1) STRIPE CONTEXT — sadece gerçek dönüşte çalış
  // -------------------------------------------------
  try {
    if (window.__AIVO_STORE_STRIPE_FINALIZER_INSTALLED__) return;
    window.__AIVO_STORE_STRIPE_FINALIZER_INSTALLED__ = true;

    var url = new URL(window.location.href);

    var stripeFlag = url.searchParams.get("stripe"); // success / cancel
    var sessionId = url.searchParams.get("session_id");

    // sadece success + session_id varsa çalış
    if (stripeFlag !== "success" || !sessionId) return;

    sessionId = String(sessionId || "").trim();
    if (!sessionId) return;

    // -------------------------------------------------
    // 2) IDEMPOTENCY
    // -------------------------------------------------
    var DONE_KEY = "AIVO_STRIPE_DONE_" + sessionId;
    try {
      if (localStorage.getItem(DONE_KEY) === "1") {
        // URL temizle
        url.searchParams.delete("stripe");
        url.searchParams.delete("session_id");
        history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
        return;
      }
    } catch (_) {}

    // -------------------------------------------------
    // 3) STORE HAZIR MI?
    // -------------------------------------------------
    if (!window.AIVO_STORE_V1 || typeof window.AIVO_STORE_V1.applyPurchase !== "function") {
      // Store daha yüklenmeden tetiklenirse sessiz çıkabilir;
      // ama bu blok zaten store.js içinde olduğu için genelde buraya düşmez.
      try { window.showToast("Store yüklenemedi.", "error"); } catch (_) {}
      return;
    }

    // -------------------------------------------------
    // 4) VERIFY SESSION (POST -> GET fallback)
    // -------------------------------------------------
    function verifySession(sid) {
      return (async function () {
        // POST
        try {
          var r1 = await fetch("/api/stripe/verify-session", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({ session_id: sid })
          });
          var j1 = await r1.json().catch(function(){ return null; });
          if (r1.ok && j1 && j1.ok === true) return j1;
        } catch (_) {}

        // GET fallback
        try {
          var r2 = await fetch("/api/stripe/verify-session?session_id=" + encodeURIComponent(sid), {
            method: "GET",
            headers: { "Accept": "application/json" }
          });
          var j2 = await r2.json().catch(function(){ return null; });
          return j2;
        } catch (_) {
          return null;
        }
      })();
    }

    // -------------------------------------------------
    // 5) RUN
    // -------------------------------------------------
    (async function run() {
      var data = await verifySession(sessionId);

      if (!data || data.ok !== true) {
        try { window.showToast("Ödeme doğrulanamadı.", "error"); } catch (_) {}
        return;
      }

      // credits/pack/order_id beklenen alanlar
      var credits = Number(data.credits || 0) || 0;
      var pack =
        (data.pack ? String(data.pack) : "") ||
        (credits >= 500 ? "2999" :
         credits >= 150 ? "899"  :
         credits >= 60  ? "399"  :
         credits >= 25  ? "199"  : "custom");

      var orderId = String(data.order_id || ("stripe_" + sessionId));

      var result = null;
      try {
        result = window.AIVO_STORE_V1.applyPurchase({
          order_id: orderId,
          pack: pack,
          credits: credits
        });
      } catch (e) {
        result = null;
      }

      if (!result || result.ok !== true) {
        try { window.showToast("Kredi eklenemedi.", "error"); } catch (_) {}
        return;
      }

      // idempotency set
      try { localStorage.setItem(DONE_KEY, "1"); } catch (_) {}

      // UI sync (varsa)
      try { if (typeof window.AIVO_STORE_V1.syncCreditsUI === "function") window.AIVO_STORE_V1.syncCreditsUI(); } catch (_) {}

      // ✅ SUCCESS TOAST
      try {
        var added = Number(result.added || credits || 0) || 0;
        window.toast.success("Kredi yüklendi", "+" + added + " kredi yüklendi 🎉");

      } catch (_) {}

      // URL temizle
      try {
        url.searchParams.delete("stripe");
        url.searchParams.delete("session_id");
        history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
      } catch (_) {}
    })();

  } catch (err) {
    try { window.showToast("Stripe finalizer hata verdi.", "error"); } catch (_) {}
    console.warn("[STORE STRIPE FINALIZER] crash", err);
  }
})();


/* =========================================================
   store.js — AIVO STORE V1 (TEK OTORİTE) — FINAL (WIPE SAFE)
   - credits (local cache, UI event source)
   - selectedPack (199/399/899/2999)
   - applyPurchase (idempotent - local)
   - invoices: backup/restore + wipe protection
   - store backup/restore + wipe protection
   ========================================================= */
(function () {
  "use strict";
  if (window.AIVO_STORE_V1) return;

  var KEY = "aivo_store_v1";
  var KEY_BAK = "aivo_store_v1_backup";
  var MIGRATED_FLAG = "aivo_store_v1_migrated";

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

  function parseJSON(raw) {
    try { return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
  }

  function normalizeStore(s) {
    if (!isObj(s)) return DEFAULT_STORE();
    if (!("v" in s)) s.v = 1;

    s.credits = toInt(s.credits);
    s.selectedPack = s.selectedPack == null ? null : safeStr(s.selectedPack);
    if (s.selectedPack === "") s.selectedPack = null;

    if (!s.ts) s.ts = nowISO();
    return s;
  }

  function isDefaultLike(s) {
    return isObj(s) && toInt(s.credits) === 0 && (s.selectedPack == null || safeStr(s.selectedPack) === "");
  }

  function readRawKey(k) {
    try { return localStorage.getItem(k); } catch (_) { return null; }
  }

  function writeRawKey(k, v) {
    try { localStorage.setItem(k, v); } catch (_) {}
  }

  function read() {
    var main = normalizeStore(parseJSON(readRawKey(KEY)));
    var bak = normalizeStore(parseJSON(readRawKey(KEY_BAK)));

    if (isDefaultLike(main) && !isDefaultLike(bak) && bak.credits > 0) {
      writeRawKey(KEY, JSON.stringify(bak));
      return bak;
    }
    return main;
  }

  function write(s, opts) {
    opts = opts || {};
    var next = normalizeStore(s);
    next.ts = nowISO();

    var cur = normalizeStore(parseJSON(readRawKey(KEY)));

    if (!opts.force) {
      if (!isDefaultLike(cur) && cur.credits > 0 && isDefaultLike(next)) {
        console.warn("[AIVO][STORE] write blocked: prevent default overwrite.");
        return cur;
      }
    }

    var json = JSON.stringify(next);
    writeRawKey(KEY, json);
    writeRawKey(KEY_BAK, json);
    return next;
  }

  function emit(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch (_) {}
  }

  function emitCreditsChanged(credits) {
    emit("aivo:credits-changed", { credits: toInt(credits) });
  }

  function emitPackChanged(pack) {
    emit("aivo:pack-changed", { pack: pack || null });
  }

  function safeSyncUI() {
    try { typeof window.syncCreditsUI === "function" && window.syncCreditsUI(); } catch (_) {}
  }

  /* ================= MIGRATION ================= */
  function migrateOnce() {
    if (readRawKey(MIGRATED_FLAG) === "1") return;

    var before = read();
    var s = normalizeStore(before);

    var legacy =
      readRawKey("aivo_credits") ??
      readRawKey("AIVO_CREDITS") ??
      readRawKey("credits");

    if (legacy != null && !s.credits) s.credits = toInt(legacy);

    var legacyPack =
      readRawKey("aivo_selected_pack") ??
      readRawKey("AIVO_SELECTED_PACK");

    if (legacyPack && !s.selectedPack) s.selectedPack = safeStr(legacyPack);

    var beforeStr = JSON.stringify(normalizeStore(before));
    var afterStr  = JSON.stringify(normalizeStore(s));

    if (beforeStr !== afterStr) {
      write(s, { force: true });
    } else {
      if (!readRawKey(KEY_BAK)) write(before, { force: true });
    }

    writeRawKey(MIGRATED_FLAG, "1");
  }

  /* ================= CREDITS API ================= */
  function getCredits() {
    return read().credits;
  }

  function setCredits(v) {
    var s = read();
    s.credits = toInt(v);
    write(s, { force: true });
    emitCreditsChanged(s.credits);
    safeSyncUI();
    return s.credits;
  }

  function addCredits(delta) {
    delta = toInt(delta);
    var s = read();
    s.credits = toInt(s.credits + delta);
    write(s, { force: true });
    emitCreditsChanged(s.credits);
    safeSyncUI();
    return s.credits;
  }

  function consumeCredits(delta) {
    delta = toInt(delta);
    var s = read();
    if (s.credits < delta) return false;
    s.credits = toInt(s.credits - delta);
    write(s, { force: true });
    emitCreditsChanged(s.credits);
    safeSyncUI();
    return true;
  }

  function syncCreditsUI() {
    emitCreditsChanged(getCredits());
    safeSyncUI();
  }

  /* ================= SELECTED PACK API ================= */
  function setSelectedPack(pack) {
    pack = safeStr(pack);
    var s = read();

    if (!PACKS[pack]) {
      s.selectedPack = null;
      write(s, { force: true });
      emitPackChanged(null);
      return null;
    }

    s.selectedPack = pack;
    write(s, { force: true });

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

  /* ================= INVOICES (LOCAL) ================= */
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
    var raw = null;
    try { raw = localStorage.getItem(INVOICE_KEY); } catch (_) { raw = null; }
    var arr = _parseInvoices(raw);

    if (!Array.isArray(arr) || arr.length === 0) {
      var bakRaw = null;
      try { bakRaw = localStorage.getItem(INVOICE_BAK); } catch (_) { bakRaw = null; }
      var bak = _parseInvoices(bakRaw);

      if (Array.isArray(bak) && bak.length > 0) {
        try { localStorage.setItem(INVOICE_KEY, JSON.stringify(bak)); } catch (_) {}
        return bak;
      }
      return [];
    }

    return arr;
  }

  function writeInvoices(arr, opts) {
    opts = opts || {};
    arr = Array.isArray(arr) ? arr : [];

    var cur = readInvoices();
    if (!opts.force && cur.length > 0 && arr.length === 0) {
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

    if (inv && inv.order_id) {
      var exists = list.some(function (x) { return x && x.order_id === inv.order_id; });
      if (exists) return list;
    }

    list.unshift(inv);
    writeInvoices(list, { force: true });

    try {
      window.dispatchEvent(new CustomEvent("aivo:invoices-changed", { detail: { invoices: list } }));
    } catch (_) {}

    return list;
  }

  function clearInvoices() {
    try { localStorage.setItem(INVOICE_KEY, "[]"); } catch (_) {}
    try { localStorage.setItem(INVOICE_BAK, "[]"); } catch (_) {}
    return [];
  }

  /* ================= PURCHASE APPLY (LOCAL IDEMPOTENT) ================= */
  function applyPurchase(payload) {
    payload = payload || {};

    var orderId = safeStr(payload.order_id || payload.orderId || payload.oid);
    var packKey = safeStr(payload.pack || payload.pack_key || payload.price);
    var creditsFromServer = toInt(payload.credits);

    var add = creditsFromServer;

    if (!add) {
      if (!PACKS[packKey]) {
        return { ok: false, reason: "unknown_pack", packKey: packKey, allowed: Object.keys(PACKS) };
      }
      add = toInt(PACKS[packKey].credits);
    }

    if (orderId) {
      var lockKey = "AIVO_PURCHASE_APPLIED_" + orderId;
      try {
        if (localStorage.getItem(lockKey) === "1") {
          return { ok: false, reason: "already_applied", orderId: orderId };
        }
        localStorage.setItem(lockKey, "1");
      } catch (_) {}
    }

    var after = addCredits(add);

    addInvoice({
      order_id: orderId || ("local_" + Date.now()),
      provider: safeStr(payload.provider || payload.gateway || "stripe"),
      type: "purchase",
      pack: packKey,
      amount_try: PACKS[packKey] ? PACKS[packKey].price : toInt(packKey),
      credits: add,
      created_at: new Date().toISOString(),
      status: "paid"
    });

    return { ok: true, added: add, credits: after, orderId: orderId || null };
  }

  migrateOnce();

  window.AIVO_STORE_V1 = {
    getCredits: getCredits,
    setCredits: setCredits,
    addCredits: addCredits,
    consumeCredits: consumeCredits,
    syncCreditsUI: syncCreditsUI,

    setSelectedPack: setSelectedPack,
    getSelectedPack: getSelectedPack,
    clearSelectedPack: clearSelectedPack,

    applyPurchase: applyPurchase,

    listInvoices: function () { return readInvoices(); },
    addInvoice: function (inv) { return addInvoice(inv); },
    clearInvoices: function () { return clearInvoices(); },

    _readInvoices: readInvoices,
    _read: read,
    _write: write,
    _packs: PACKS
  };
})();
