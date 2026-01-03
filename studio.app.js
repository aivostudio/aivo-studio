/* =========================================================
   studio.app.js — AIVO APP (DOM CREDIT + HARD BUTTON CATCH + JOB)
   - Credit source: DOM "Kredi 2010" (çünkü store/get yok, aivo_credits yok)
   - Updates UI immediately + stores shadow in localStorage for debug
   - Button catch: selector + text fallback ("Müzik Üret")
   - Flow: spend -> update UI -> AIVO_JOBS.add job
   ========================================================= */

(function () {
  "use strict";

  window.AIVO_APP = window.AIVO_APP || {};
  window.__aivoJobSeq = window.__aivoJobSeq || 0;

  // ---------------------------
  // Helpers
  // ---------------------------
  function toastSafe(msg, type) {
    try {
      if (typeof window.showToast === "function") window.showToast(msg, type || "ok");
      else console.log("[toast]", type || "ok", msg);
    } catch (e) {
      console.log("[toast-fallback]", type || "ok", msg);
    }
  }

  function toInt(v) {
    var n = parseInt(String(v), 10);
    return isNaN(n) ? 0 : n;
  }

  function val(sel) {
    var el = document.querySelector(sel);
    return el ? String(el.value || "").trim() : "";
  }

  // ---------------------------
  // Find "Kredi 2010" element in DOM
  // ---------------------------
  function findCreditNode() {
    // sağ üstteki kredi chip/button genelde button/span olur
    var nodes = document.querySelectorAll("button, a, div, span");
    for (var i = 0; i < nodes.length; i++) {
      var t = (nodes[i].textContent || "").trim();
      if (!t) continue;
      // "Kredi 2010" / "Kredi: 2010" / "Kredi 2.010" varyantları
      if (t.toLowerCase().indexOf("kredi") !== -1) {
        var m = t.match(/kredi[^0-9]*([0-9][0-9\.\,]{0,12})/i);
        if (m && m[1]) return nodes[i];
      }
    }
    return null;
  }

  function readCreditsFromDOM() {
    var el = findCreditNode();
    if (!el) return { ok: false, value: 0, el: null };

    var t = (el.textContent || "").trim();
    var m = t.match(/kredi[^0-9]*([0-9][0-9\.\,]{0,12})/i);
    if (!m || !m[1]) return { ok: false, value: 0, el: el };

    // 2.010 / 2,010 gibi formatları düzelt
    var cleaned = String(m[1]).replace(/[^\d]/g, "");
    var n = toInt(cleaned);
    return { ok: true, value: n, el: el };
  }

  function writeCreditsToDOM(el, next) {
    try {
      var nn = Math.max(0, next | 0);

      // mevcut metin içinde sayıyı replace etmeye çalış
      var t = (el.textContent || "");
      var replaced = t.replace(/(kredi[^0-9]*)([0-9][0-9\.\,]{0,12})/i, function (_, a) {
        return a + String(nn);
      });

      // eğer replace olmadıysa güvenli formatla yaz
      if (replaced === t) replaced = "Kredi " + String(nn);

      el.textContent = replaced;

      // shadow persist (debug)
      try { localStorage.setItem("aivo_credits_shadow", String(nn)); } catch (_) {}

      return true;
    } catch (_) {
      return false;
    }
  }

  // ---------------------------
  // Job add
  // ---------------------------
  function addJob(job) {
    if (!window.AIVO_JOBS) return { ok: false, error: "AIVO_JOBS_missing" };
    if (typeof window.AIVO_JOBS.add === "function") {
      window.AIVO_JOBS.add(job);
      return { ok: true, via: "add" };
    }
    if (typeof window.AIVO_JOBS.create === "function") {
      // backend create olabilir ama UI için add yoksa görünmeyebilir
      window.AIVO_JOBS.create(job.type || "job", job).then(function (r) {
        console.log("[AIVO_APP] create res", r);
      }).catch(function (e) {
        console.warn("[AIVO_APP] create err", e);
      });
      return { ok: true, via: "create" };
    }
    return { ok: false, error: "AIVO_JOBS_no_add_or_create" };
  }

  // ---------------------------
  // Button catcher (selector + text fallback)
  // ---------------------------
  function findGenerateButtonFromEvent(e) {
    var t = e.target;

    // 1) önce attribute/id selector
    var btn = t && t.closest && t.closest(
      "#musicGenerateBtn, [data-generate='music'], [data-generate^='music'], button[data-action='music']"
    );
    if (btn) return btn;

    // 2) fallback: tıklanan en yakın button içinde "Müzik Üret" metni
    btn = t && t.closest && t.closest("button");
    if (btn) {
      var txt = (btn.textContent || "").toLowerCase();
      if (txt.indexOf("müzik üret") !== -1 || txt.indexOf("muzik uret") !== -1) return btn;
    }

    // 3) fallback: tıklanan elemanın yakınındaki button’larda ara
    var wrap = t && t.closest && t.closest("div,section,main,form") || document;
    var buttons = wrap.querySelectorAll ? wrap.querySelectorAll("button") : [];
    for (var i = 0; i < buttons.length; i++) {
      var s = (buttons[i].textContent || "").toLowerCase();
      if (s.indexOf("müzik üret") !== -1 || s.indexOf("muzik uret") !== -1) return buttons[i];
    }

    return null;
  }

  // ---------------------------
  // Bind (versioned)
  // ---------------------------
  var BIND_VER = "2026-01-04-domcredit-v1";
  if (window.__aivoGenerateBound === BIND_VER) return;
  window.__aivoGenerateBound = BIND_VER;

  document.addEventListener("click", function (e) {
    var btn = findGenerateButtonFromEvent(e);
    if (!btn) return;

    console.log("[AIVO_APP] CLICK CAPTURED (btn)", btn);

    // legacy bypass (bilerek)
    e.preventDefault();
    e.stopImmediatePropagation();

    // COST default 5
    var COST = 5;
    try {
      var dc = btn.getAttribute && btn.getAttribute("data-credit-cost");
      if (dc != null && dc !== "") COST = Math.max(1, Number(dc) || COST);
    } catch (_) {}

    // read credits from DOM
    var cr = readCreditsFromDOM();
    console.log("[AIVO_APP] DOM CREDIT READ", cr);

    if (!cr.ok || !cr.el) {
      toastSafe("Kredi okunamadı (DOM). Kredi chip bulunamadı.", "error");
      return;
    }

    if ((cr.value | 0) < COST) {
      toastSafe("Yetersiz kredi. Kredi satın alman gerekiyor.", "error");
      try { if (typeof window.openPricingIfPossible === "function") window.openPricingIfPossible(); } catch (_) {}
      return;
    }

    // spend
    var after = (cr.value | 0) - COST;
    var okWrite = writeCreditsToDOM(cr.el, after);
    console.log("[AIVO_APP] DOM CREDIT WRITE", { from: cr.value, to: after, okWrite: okWrite });

    if (!okWrite) {
      toastSafe("Kredi düşürülemedi (DOM write).", "error");
      return;
    }

    toastSafe("İşlem başlatıldı. " + COST + " kredi harcandı.", "ok");

    // job add
    window.__aivoJobSeq += 1;
    var jid = "music--" + Date.now() + "--" + window.__aivoJobSeq;

    var prompt = val("#musicPrompt") || val("textarea[name='prompt']") || val("#prompt") || "";
    var mode = val("#musicMode") || "instrumental";

    var jr = addJob({ job_id: jid, type: "music", status: "queued", prompt: prompt, mode: mode });
    console.log("[AIVO_APP] JOB ADD", jr, "jid=", jid);

    if (!jr.ok) toastSafe("Job gösterilemedi: " + String(jr.error || "unknown"), "error");
  }, true);

  console.log("[AIVO_APP] loaded", {
    bind: window.__aivoGenerateBound,
    hasJobs: !!window.AIVO_JOBS,
    jobsKeys: window.AIVO_JOBS ? Object.keys(window.AIVO_JOBS) : null,
    storeHasGet: !!(window.AIVO_STORE_V1 && window.AIVO_STORE_V1.get)
  });
})();
