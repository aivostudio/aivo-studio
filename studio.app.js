/* =========================================================
   studio.app.js — AIVO APP (PROD CLEAN)
   - Single credit authority: /api/credits/get + /api/credits/consume
   - No localStorage auto-detect / no DOM hack (only UI refresh)
   - Click capture: Müzik Üret butonunu kesin yakalar (selector + text fallback)
   - Flow: consume (server) -> refresh UI -> add job pill
   - Jobs: prefers AIVO_JOBS.add
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

  function getEmailSafe() {
    // 1) auth/store user (if exists)
    try {
      if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.getUser === "function") {
        var u = window.AIVO_STORE_V1.getUser();
        if (u && u.email) return String(u.email).trim().toLowerCase();
      }
    } catch (_) {}

    // 2) body attr
    try {
      var be = document.body && document.body.getAttribute && document.body.getAttribute("data-email");
      if (be) return String(be).trim().toLowerCase();
    } catch (_) {}

    // 3) common localStorage user objects
    try {
      var raw =
        localStorage.getItem("aivo_user") ||
        localStorage.getItem("aivoUser") ||
        localStorage.getItem("user") ||
        localStorage.getItem("auth_user") ||
        "";
      if (raw) {
        var obj = JSON.parse(raw);
        if (obj && obj.email) return String(obj.email).trim().toLowerCase();
      }
    } catch (_) {}

    return "";
  }

  function normalizeCreditsResponse(data) {
    // Supports multiple backend shapes
    // Expected: { ok:true, credits:123 } OR { ok:true, balance:123 } OR { ok:true, remaining:123 } etc.
    var ok = !!(data && (data.ok === true || data.success === true));
    var credits =
      (data && (data.credits ?? data.credit ?? data.kredi ?? data.balance ?? data.remaining ?? data.after ?? data.new_credits ?? data.newCredits)) ??
      null;

    var n = credits == null ? null : toInt(credits);
    return { ok: ok, credits: n, raw: data };
  }

  // ---------------------------
  // Credits API
  // ---------------------------
  async function getCreditsServer(email) {
    var user = String(email || "").trim().toLowerCase();
    if (!user) return { ok: false, error: "email_missing" };

    var res = await fetch("/api/credits/get?email=" + encodeURIComponent(user), { method: "GET" });
    var data = await res.json().catch(function () { return null; });

    // If backend doesn't return ok flag, we still try to parse credits
    var norm = normalizeCreditsResponse(data || {});
    if (!norm.ok && norm.credits != null) norm.ok = true;
    return norm;
  }

  async function consumeCreditsServer(email, cost) {
    var user = String(email || "").trim().toLowerCase();
    var amount = Math.max(1, toInt(cost));

    if (!user) return { ok: false, error: "email_missing" };

    var res = await fetch("/api/credits/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user, amount: amount })
    });

    var data = await res.json().catch(function () { return null; });
    var norm = normalizeCreditsResponse(data || {});
    return norm;
  }

  // ---------------------------
  // Jobs
  // ---------------------------
  function addJobSafe(job) {
    if (!window.AIVO_JOBS) return { ok: false, error: "AIVO_JOBS_missing" };

    if (typeof window.AIVO_JOBS.add === "function") {
      try {
        window.AIVO_JOBS.add(job);
        return { ok: true, via: "add" };
      } catch (e) {
        console.warn("[AIVO_APP] AIVO_JOBS.add failed", e);
        return { ok: false, error: "AIVO_JOBS.add_failed" };
      }
    }

    if (typeof window.AIVO_JOBS.create === "function") {
      try {
        window.AIVO_JOBS.create(job.type || "job", job)
          .then(function (r) { console.log("[AIVO_APP] AIVO_JOBS.create res", r); })
          .catch(function (err) { console.warn("[AIVO_APP] AIVO_JOBS.create err", err); });
        return { ok: true, via: "create" };
      } catch (e2) {
        console.warn("[AIVO_APP] AIVO_JOBS.create failed", e2);
        return { ok: false, error: "AIVO_JOBS.create_failed" };
      }
    }

    return { ok: false, error: "AIVO_JOBS_no_api" };
  }

  window.AIVO_APP.generateMusic = async function (opts) {
    window.__aivoJobSeq += 1;
    var jid = "music--" + Date.now() + "--" + window.__aivoJobSeq;

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
  };

  // ---------------------------
  // Button catcher
  // ---------------------------
  function findGenerateButtonFromEvent(e) {
    var t = e.target;

    // strict selectors
    var btn = t && t.closest && t.closest("#musicGenerateBtn,[data-generate='music'],[data-generate^='music'],button[data-action='music']");
    if (btn) return btn;

    // text fallback
    btn = t && t.closest && t.closest("button");
    if (btn) {
      var txt = (btn.textContent || "").toLowerCase();
      if (txt.indexOf("müzik üret") !== -1 || txt.indexOf("muzik uret") !== -1) return btn;
    }
    return null;
  }

  // ---------------------------
  // Bind click (capture)
  // ---------------------------
  var BIND_VER = "2026-01-04-prod-clean-v1";
  if (window.__aivoGenerateBound === BIND_VER) return;
  window.__aivoGenerateBound = BIND_VER;

  document.addEventListener("click", async function (e) {
    var btn = findGenerateButtonFromEvent(e);
    if (!btn) return;

    console.log("[AIVO_APP] CLICK CAPTURED", { id: btn.id, className: btn.className });

    // legacy bypass
    e.preventDefault();
    e.stopImmediatePropagation();

    // cost
    var COST = 5;
    try {
      var dc = btn.getAttribute && btn.getAttribute("data-credit-cost");
      if (dc != null && dc !== "") COST = Math.max(1, Number(dc) || COST);
    } catch (_) {}

    // email
    var email = getEmailSafe();
    if (!email) {
      toastSafe("Oturum email'i okunamadı. (consume için gerekli)", "error");
      return;
    }

    // 1) Consume on server (single source of truth)
    var spend;
    try {
      spend = await consumeCreditsServer(email, COST);
    } catch (err) {
      console.warn("[AIVO_APP] consume error", err);
      toastSafe("Kredi harcama hatası. (network)", "error");
      return;
    }

    console.log("[AIVO_APP] CONSUME RES", spend);

    if (!spend.ok) {
      toastSafe("Yetersiz kredi. Kredi satın alman gerekiyor.", "error");
      openPricingSafe();
      return;
    }

    // 2) Refresh UI (server says ok; fetch latest to be safe)
    refreshCreditsUI();
    try {
      // optional hard sync
      var latest = await getCreditsServer(email);
      console.log("[AIVO_APP] GET CREDITS RES", latest);
      // credits-ui.js kendi kaynağından çekecek; burada sadece debug amaçlı log.
    } catch (_) {}

    toastSafe("İşlem başlatıldı. " + COST + " kredi harcandı.", "ok");

    // 3) Add job
    var prompt = val("#musicPrompt") || val("textarea[name='prompt']") || val("#prompt") || "";
    var mode = val("#musicMode") || "instrumental";
    var quality = val("#musicQuality") || "standard";
    var durationSec = Math.max(5, Number(val("#musicDuration") || "30") || 30);

    var res = await window.AIVO_APP.generateMusic({
      prompt: prompt,
      mode: mode,
      quality: quality,
      durationSec: durationSec
    });

    if (!res || res.ok !== true) {
      console.warn("[AIVO_APP] generateMusic failed", res);
      toastSafe("Job başlatılamadı: " + String((res && res.error) || "unknown"), "error");
    }
  }, true);

  console.log("[AIVO_APP] loaded", {
    bind: window.__aivoGenerateBound,
    hasJobs: !!window.AIVO_JOBS,
    jobsKeys: window.AIVO_JOBS ? Object.keys(window.AIVO_JOBS) : null
  });

})();
