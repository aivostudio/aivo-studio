/* =========================================================
   studio.app.js — AIVO APP (PROD MINIMAL)
   - Legacy studio.js frozen; spend/consume burada yapılır
   - Credit source: window.readCredits/writeCredits (if exists) else localStorage["aivo_credits"]
   - Click capture: Müzik Üret butonunu kesin yakalar
   - Flow: spend -> refresh UI -> add job
   - Job API: AIVO_JOBS.add preferred, fallback AIVO_JOBS.create
   ========================================================= */

(function () {
  "use strict";

  // ---------------------------
  // Globals
  // ---------------------------
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

  function toInt(v) {
    var n = parseInt(String(v), 10);
    return isNaN(n) ? 0 : n;
  }

  function val(sel) {
    var el = document.querySelector(sel);
    return el ? String(el.value || "").trim() : "";
  }

  // ---------------------------
  // Credits — Single Source
  // ---------------------------
  var CREDIT_KEY = "aivo_credits";

  function readCreditsSafe() {
    // 1) preferred: global readCredits()
    try {
      if (typeof window.readCredits === "function") return Math.max(0, toInt(window.readCredits()));
    } catch (_) {}

    // 2) fallback: localStorage aivo_credits
    try {
      return Math.max(0, toInt(localStorage.getItem(CREDIT_KEY) || "0"));
    } catch (_) {}

    return 0;
  }

  function writeCreditsSafe(next) {
    var n = Math.max(0, toInt(next));

    // 1) preferred: global writeCredits()
    try {
      if (typeof window.writeCredits === "function") {
        window.writeCredits(n);
        return true;
      }
    } catch (_) {}

    // 2) fallback: localStorage aivo_credits
    try {
      localStorage.setItem(CREDIT_KEY, String(n));
      return true;
    } catch (_) {}

    return false;
  }

  // ---------------------------
  // Job helpers
  // ---------------------------
  function addJobSafe(job) {
    if (!window.AIVO_JOBS) {
      console.warn("[AIVO_APP] AIVO_JOBS missing");
      return { ok: false, error: "AIVO_JOBS_missing" };
    }

    // prefer add (UI-local)
    if (typeof window.AIVO_JOBS.add === "function") {
      try {
        window.AIVO_JOBS.add(job);
        return { ok: true, via: "add" };
      } catch (e) {
        console.warn("[AIVO_APP] AIVO_JOBS.add failed", e);
        return { ok: false, error: "AIVO_JOBS.add_failed" };
      }
    }

    // fallback create (backend)
    if (typeof window.AIVO_JOBS.create === "function") {
      try {
        // create returns promise(json) - ama UI'da görünmesi için gene add gerekebilir
        window.AIVO_JOBS.create(job.type || "job", job).then(function (res) {
          console.log("[AIVO_APP] AIVO_JOBS.create res", res);
        }).catch(function (err) {
          console.warn("[AIVO_APP] AIVO_JOBS.create err", err);
        });
        return { ok: true, via: "create" };
      } catch (e2) {
        console.warn("[AIVO_APP] AIVO_JOBS.create failed", e2);
        return { ok: false, error: "AIVO_JOBS.create_failed" };
      }
    }

    return { ok: false, error: "AIVO_JOBS_no_add_or_create" };
  }

  // ---------------------------
  // Generate Music (UI job only)
  // ---------------------------
  window.AIVO_APP.generateMusic = async function (opts) {
    try {
      window.__aivoJobSeq += 1;
      var rand = Math.random().toString(36).slice(2, 7);
      var jid = "music--" + Date.now() + "--" + window.__aivoJobSeq + "--" + rand;

      var job = {
        job_id: jid,
        type: "music",
        status: "queued",
        prompt: (opts && opts.prompt) ? String(opts.prompt) : "",
        mode: (opts && opts.mode) ? String(opts.mode) : "instrumental",
        quality: (opts && opts.quality) ? String(opts.quality) : "standard",
        durationSec: (opts && opts.durationSec) ? (opts.durationSec | 0) : 30
      };

      var r = addJobSafe(job);
      console.log("[AIVO_APP] job add result:", r, "job_id:", jid);

      if (!r.ok) return { ok: false, error: r.error || "job_add_failed" };
      return { ok: true, job_id: jid };
    } catch (e) {
      console.error("[AIVO_APP] generateMusic error", e);
      return { ok: false, error: String(e) };
    }
  };

  // ---------------------------
  // Bind click (capture, versioned)
  // ---------------------------
  var BIND_VER = "2026-01-04b";
  if (window.__aivoGenerateBound === BIND_VER) return;
  window.__aivoGenerateBound = BIND_VER;

  document.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest && e.target.closest(
      "#musicGenerateBtn, [data-generate='music'], [data-generate^='music'], button[data-action='music']"
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

    // COST (default 5)
    var COST = 5;
    try {
      var dc = btn.getAttribute("data-credit-cost");
      if (dc != null && dc !== "") COST = Math.max(1, Number(dc) || COST);
    } catch (_) {}

    // 1) read credits
    var now = readCreditsSafe();
    console.log("[AIVO_APP] CREDITS NOW", now, "COST", COST, "key", CREDIT_KEY);

    if (now < COST) {
      toastSafe("Yetersiz kredi. Kredi satın alman gerekiyor.", "error");
      openPricingSafe();
      return;
    }

    // 2) spend
    var after = now - COST;
    var okWrite = writeCreditsSafe(after);
    console.log("[AIVO_APP] CREDIT WRITE", { from: now, to: after, okWrite: okWrite });

    if (!okWrite) {
      toastSafe("Kredi düşürülemedi (write failed).", "error");
      return;
    }

    refreshCreditsUI();
    toastSafe("İşlem başlatıldı. " + COST + " kredi harcandı.", "ok");

    // 3) job create (UI)
    var prompt = val("#musicPrompt") || val("textarea[name='prompt']") || val("#prompt") || "";
    var mode = val("#musicMode") || "instrumental";
    var quality = val("#musicQuality") || "standard";
    var durationSec = Math.max(5, Number(val("#musicDuration") || "30") || 30);

    window.AIVO_APP.generateMusic({
      prompt: prompt,
      mode: mode,
      quality: quality,
      durationSec: durationSec
    }).then(function (res) {
      if (!res || res.ok !== true) {
        console.warn("[AIVO_APP] generateMusic failed", res);
        toastSafe("Job başlatılamadı: " + String((res && res.error) || "unknown"), "error");
      }
    });
  }, true);

  // ---------------------------
  // Boot log
  // ---------------------------
  console.log("[AIVO_APP] studio.app.js loaded", {
    bind: window.__aivoGenerateBound,
    hasJobs: !!window.AIVO_JOBS,
    jobsKeys: window.AIVO_JOBS ? Object.keys(window.AIVO_JOBS) : null
  });

})();
