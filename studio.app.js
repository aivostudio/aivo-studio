/* =========================================================
   AIVO APP — CORE + BIND (CREDITS SPEND + JOB ADD)
   - Legacy spend bypass ediliyorsa kredi düşürme burada yapılır
   - Source order: AIVO_STORE_V1 -> AIVO_CREDITS_UI -> localStorage scan
   - Yeterliyse: spend -> refresh -> job
   - Job API: AIVO_JOBS.add (preferred) else AIVO_JOBS.create
   ========================================================= */
(function () {
  "use strict";

  window.AIVO_APP = window.AIVO_APP || {};
  window.__aivoJobSeq = window.__aivoJobSeq || 0;

  // ---------- helpers ----------
  function toastSafe(msg, type) {
    try {
      if (typeof window.showToast === "function") window.showToast(msg, type || "ok");
      else console.log("[toast]", type || "ok", msg);
    } catch (e) {
      console.log("[toast-fallback]", type || "ok", msg);
    }
  }

  function refreshCreditsUI() {
    try {
      if (typeof window.callCreditsUIRefresh === "function") window.callCreditsUIRefresh();
    } catch (_) {}
    try {
      if (window.AIVO_CREDITS_UI && typeof window.AIVO_CREDITS_UI.refresh === "function") window.AIVO_CREDITS_UI.refresh();
    } catch (_) {}
  }

  function openPricingSafe() {
    try {
      if (typeof window.openPricingIfPossible === "function") window.openPricingIfPossible();
    } catch (_) {}
  }

  function val(sel) {
    var el = document.querySelector(sel);
    return el ? String(el.value || "").trim() : "";
  }

  // ---------- credits source: STORE ----------
  function storeGetState() {
    try {
      return window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.get === "function" ? (window.AIVO_STORE_V1.get() || null) : null;
    } catch (_) { return null; }
  }

  function storeGetCredits() {
    try {
      var s = storeGetState();
      if (!s || typeof s !== "object") return null;

      // olası alan isimleri
      var c = null;
      if (s.credits != null) c = s.credits;
      else if (s.credit != null) c = s.credit;
      else if (s.kredi != null) c = s.kredi;
      else if (s.balance != null) c = s.balance;
      else if (s.user && s.user.credits != null) c = s.user.credits;
      else if (s.profile && s.profile.credits != null) c = s.profile.credits;

      var n = parseInt(c, 10);
      return Number.isFinite(n) ? n : null;
    } catch (_) { return null; }
  }

  function storeSetCredits(next) {
    try {
      if (!window.AIVO_STORE_V1) return false;
      var nn = Math.max(0, (next | 0));

      // patch varsa tercih
      if (typeof window.AIVO_STORE_V1.patch === "function") {
        window.AIVO_STORE_V1.patch({ credits: nn });
        return true;
      }

      // set varsa state'i güncelleyip bas
      if (typeof window.AIVO_STORE_V1.set === "function") {
        var s = storeGetState() || {};
        s.credits = nn; // tek kaynağa sabitle
        window.AIVO_STORE_V1.set(s);
        return true;
      }

      // custom setter varsa (bazı store'larda olabilir)
      if (typeof window.AIVO_STORE_V1.setCredits === "function") {
        window.AIVO_STORE_V1.setCredits(nn);
        return true;
      }

      return false;
    } catch (_) { return false; }
  }

  // ---------- credits source: CREDITS_UI (varsa) ----------
  function uiGetCredits() {
    try {
      if (window.AIVO_CREDITS_UI && typeof window.AIVO_CREDITS_UI.getCredits === "function") {
        var n = parseInt(window.AIVO_CREDITS_UI.getCredits(), 10);
        return Number.isFinite(n) ? n : null;
      }
    } catch (_) {}
    return null;
  }

  function uiSetCredits(next) {
    try {
      if (window.AIVO_CREDITS_UI && typeof window.AIVO_CREDITS_UI.setCredits === "function") {
        window.AIVO_CREDITS_UI.setCredits(Math.max(0, (next | 0)));
        return true;
      }
    } catch (_) {}
    return false;
  }

  // ---------- credits source: localStorage fallback ----------
  function scanCreditCandidates() {
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k) continue;

        var kk = String(k).toLowerCase();
        if (kk.indexOf("credit") === -1 && kk.indexOf("kredi") === -1) continue;

        var v = localStorage.getItem(k);
        if (v == null) continue;

        // düz sayı
        var n1 = parseInt(v, 10);
        if (Number.isFinite(n1)) {
          out.push({ key: k, value: n1, raw: v });
          continue;
        }

        // json içi sayı
        try {
          var obj = JSON.parse(v);
          if (obj && typeof obj === "object") {
            var maybe = null;
            if (obj.credits != null) maybe = obj.credits;
            else if (obj.credit != null) maybe = obj.credit;
            else if (obj.kredi != null) maybe = obj.kredi;
            else if (obj.balance != null) maybe = obj.balance;
            else if (obj.amount != null) maybe = obj.amount;

            if (maybe != null) {
              var n2 = parseInt(maybe, 10);
              if (Number.isFinite(n2)) out.push({ key: k, value: n2, raw: v, json: true });
            }
          }
        } catch (_) {}
      }
    } catch (_) {}
    return out;
  }

  function pickCreditKey() {
    var cands = scanCreditCandidates();
    if (!cands.length) return { key: "", value: 0, candidates: [] };
    cands.sort(function (a, b) { return (b.value || 0) - (a.value || 0); });
    return { key: cands[0].key, value: cands[0].value || 0, candidates: cands };
  }

  function writeCreditsToKey(key, newValue) {
    try {
      var nn = Math.max(0, (newValue | 0));
      var old = localStorage.getItem(key);

      // JSON ise içinden güncelle
      try {
        var obj = JSON.parse(old);
        if (obj && typeof obj === "object") {
          if (obj.credits != null) obj.credits = nn;
          else if (obj.credit != null) obj.credit = nn;
          else if (obj.kredi != null) obj.kredi = nn;
          else obj.credits = nn;
          localStorage.setItem(key, JSON.stringify(obj));
          return true;
        }
      } catch (_) {}

      localStorage.setItem(key, String(nn));
      return true;
    } catch (_) {
      return false;
    }
  }

  // unified read/write
  function readCredits() {
    var s = storeGetCredits();
    if (s != null) return { source: "store", value: s };

    var u = uiGetCredits();
    if (u != null) return { source: "ui", value: u };

    var pick = pickCreditKey();
    if (pick && pick.key) return { source: "ls", value: pick.value | 0, key: pick.key, pick: pick };

    return { source: "none", value: 0 };
  }

  function writeCredits(info, next) {
    if (!info) return false;
    if (info.source === "store") return storeSetCredits(next);
    if (info.source === "ui") return uiSetCredits(next);
    if (info.source === "ls") return writeCreditsToKey(info.key, next);
    return false;
  }

  // ---------- job add ----------
  function addJob(job) {
    if (!window.AIVO_JOBS) return { ok: false, error: "AIVO_JOBS_missing" };

    if (typeof window.AIVO_JOBS.add === "function") {
      window.AIVO_JOBS.add(job);
      return { ok: true, via: "add" };
    }
    if (typeof window.AIVO_JOBS.create === "function") {
      window.AIVO_JOBS.create(job);
      return { ok: true, via: "create" };
    }
    return { ok: false, error: "AIVO_JOBS_no_add_or_create" };
  }

  // ---------- bind (versioned) ----------
  var BIND_VER = "2026-01-04a";
  if (window.__aivoGenerateBound === BIND_VER) return;
  window.__aivoGenerateBound = BIND_VER;

  document.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest && e.target.closest(
      "#musicGenerateBtn, [data-generate='music'], [data-generate^='music']"
    );
    if (!btn) return;

    console.log("[AIVO_APP] CLICK CAPTURED", {
      id: btn.id,
      dataGenerate: btn.getAttribute("data-generate"),
      className: btn.className
    });

    // legacy bypass (bilerek)
    e.preventDefault();
    e.stopImmediatePropagation();

    // cost
    var COST = 5;
    try {
      var dc = btn.getAttribute("data-credit-cost");
      if (dc != null && dc !== "") COST = Math.max(1, Number(dc) || COST);
    } catch (_) {}

    // 1) credits read
    var info = readCredits();
    console.log("[AIVO_APP] CREDITS READ", info);

    if (info.source === "none") {
      toastSafe("Kredi kaynağı bulunamadı. (Store/UI/localStorage)", "error");
      openPricingSafe();
      return;
    }

    if ((info.value | 0) < COST) {
      toastSafe("Yetersiz kredi. Kredi satın alman gerekiyor.", "error");
      openPricingSafe();
      return;
    }

    // 2) spend
    var next = (info.value | 0) - COST;
    var okWrite = writeCredits(info, next);
    console.log("[AIVO_APP] CREDITS WRITE", { from: info.value, to: next, okWrite: okWrite, source: info.source });

    refreshCreditsUI();
    toastSafe("İşlem başlatıldı. " + COST + " kredi harcandı.", "ok");

    // 3) job
    window.__aivoJobSeq += 1;
    var rand = Math.random().toString(36).slice(2, 7);
    var jid = "music--" + Date.now() + "--" + window.__aivoJobSeq + "--" + rand;

    var prompt = val("#musicPrompt") || val("textarea[name='prompt']") || val("#prompt") || "";
    var mode = val("#musicMode") || "instrumental";

    var r = addJob({ job_id: jid, type: "music", status: "queued", prompt: prompt, mode: mode });
    console.log("[AIVO_APP] JOB RESULT", r, "jid=", jid);

    if (!r.ok) {
      toastSafe("Job eklenemedi: " + String(r.error || "unknown"), "error");
    }
  }, true);
})();
