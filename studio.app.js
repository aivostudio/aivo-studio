/* =========================================================
   studio.app.js — AIVO APP (PROD MINIMAL) — REVISED (2026-01-04d)
   - Legacy studio.js frozen; spend/consume burada yapılır
   - Credit source of truth: /api/credits/consume + /api/credits/get
   - Email resolver: AIVO_AUTH -> body[data-email] -> localStorage -> store -> UI text
   - Job UI: AIVO_JOBS.add preferred; if AIVO_JOBS late, queue + flush
   - Click capture: Müzik Üret butonunu kesin yakalar
   - In-flight lock: tek tık = tek işlem (spam/çift tık engel)
   ========================================================= */

(function () {
  "use strict";

  window.AIVO_APP = window.AIVO_APP || {};
  window.__aivoJobSeq = window.__aivoJobSeq || 0;

  var CREDIT_KEY = "aivo_credits";
  var CREDIT_SHADOW_KEY = "aivo_credits_shadow";
  var EMAIL_KEY = "aivo_user_email";

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
    try { if (typeof window.callCreditsUIRefresh === "function") window.callCreditsUIRefresh(); } catch (_) {}
    try { if (window.AIVO_CREDITS_UI && typeof window.AIVO_CREDITS_UI.refresh === "function") window.AIVO_CREDITS_UI.refresh(); } catch (_) {}
    try { if (typeof window.AIVO_SYNC_CREDITS_UI === "function") window.AIVO_SYNC_CREDITS_UI(); } catch (_) {}
  }

  function openPricingSafe() {
    try { if (typeof window.openPricingIfPossible === "function") window.openPricingIfPossible(); } catch (_) {}
  }

  function toInt(v) {
    var n = parseInt(String(v), 10);
    return isNaN(n) ? 0 : n;
  }

  function val(sel) {
    var el = document.querySelector(sel);
    return el ? String(el.value || "").trim() : "";
  }

  function normEmail(x) {
    var s = String(x || "").trim().toLowerCase();
    return s && s.includes("@") ? s : "";
  }

  // ---------------------------
  // Email resolver (CRITICAL)
  // ---------------------------
  function resolveEmailSafe() {
    // 0) AIVO_AUTH global
    try {
      if (window.AIVO_AUTH && window.AIVO_AUTH.email) {
        var e0 = normEmail(window.AIVO_AUTH.email);
        if (e0) return e0;
      }
    } catch (_) {}

    // 0.1) body[data-email]
    try {
      var be = document.body && document.body.getAttribute && document.body.getAttribute("data-email");
      var e01 = normEmail(be);
      if (e01) return e01;
    } catch (_) {}

    // 1) localStorage direct
    try {
      var e1 = normEmail(localStorage.getItem(EMAIL_KEY));
      if (e1) return e1;
    } catch (_) {}

    // 1.1) localStorage aivo_user json
    try {
      var raw = localStorage.getItem("aivo_user");
      if (raw) {
        var j = JSON.parse(raw);
        var e11 = normEmail(j && (j.email || j.user_email));
        if (e11) return e11;
      }
    } catch (_) {}

    // 2) store getUser()
    try {
      if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.getUser === "function") {
        var u = window.AIVO_STORE_V1.getUser();
        var e2 = normEmail(u && u.email);
        if (e2) return e2;
      }
    } catch (_) {}

    // 3) UI text fallback (topbar email)
    try {
      var el = document.getElementById("topUserEmail") || document.querySelector("[data-user-email]") || null;
      if (el) {
        var e3 = normEmail(el.textContent || "");
        if (e3) return e3;
      }
    } catch (_) {}

    return "";
  }

  function publishEmail(email) {
    var em = normEmail(email);
    if (!em) return false;

    // Make it visible for everyone
    try { window.AIVO_AUTH = window.AIVO_AUTH || {}; window.AIVO_AUTH.email = em; } catch (_) {}
    try { document.body && document.body.setAttribute && document.body.setAttribute("data-email", em); } catch (_) {}
    try { localStorage.setItem(EMAIL_KEY, em); } catch (_) {}
    try { localStorage.setItem("aivo_user", JSON.stringify({ email: em })); } catch (_) {}
    try {
      if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.setUser === "function") {
        window.AIVO_STORE_V1.setUser({ email: em });
      }
    } catch (_) {}

    return true;
  }

  // ---------------------------
  // Credits helpers (keep UI consistent)
  // ---------------------------
  function setLocalCreditsMirrors(n) {
    var v = Math.max(0, toInt(n));
    try { localStorage.setItem(CREDIT_KEY, String(v)); } catch (_) {}
    try { localStorage.setItem(CREDIT_SHADOW_KEY, String(v)); } catch (_) {}
    try {
      if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.setCredits === "function") {
        window.AIVO_STORE_V1.setCredits(v);
      }
    } catch (_) {}
  }

  async function fetchCreditsFromServer(email) {
    var em = normEmail(email);
    if (!em) return null;

    try {
      var r = await fetch("/api/credits/get?email=" + encodeURIComponent(em), { cache: "no-store" });
      var j = await r.json();
      if (j && j.ok && typeof j.credits === "number") return j.credits;
    } catch (_) {}
    return null;
  }

  async function consumeOnServer(email, amount, meta) {
    var em = normEmail(email);
    var amt = Math.max(1, toInt(amount));
    if (!em) return { ok: false, error: "email_required" };

    try {
      var r = await fetch("/api/credits/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          email: em,
          cost: amt, // ✅ backend contract: cost
          reason: (meta && meta.reason) ? String(meta.reason) : "studio_generate",
          job_type: (meta && meta.job_type) ? String(meta.job_type) : "music"
        })
      });

      var j = await r.json().catch(function () { return null; });
      if (!r.ok) {
        return { ok: false, status: r.status, error: (j && j.error) ? j.error : ("http_" + r.status), raw: j };
      }

      // Expect { ok:true, credits?:number }
      if (j && j.ok) return j;
      return { ok: false, error: "bad_response", raw: j };
    } catch (e) {
      return { ok: false, error: "network_error", detail: String(e) };
    }
  }

  // ---------------------------
  // Jobs: queue if late
  // ---------------------------
  window.__AIVO_PENDING_JOBS__ = window.__AIVO_PENDING_JOBS__ || [];

  function tryFlushPendingJobs() {
    if (!window.AIVO_JOBS || typeof window.AIVO_JOBS.add !== "function") return false;
    var q = window.__AIVO_PENDING_JOBS__;
    if (!Array.isArray(q) || !q.length) return true;

    var left = [];
    for (var i = 0; i < q.length; i++) {
      try { window.AIVO_JOBS.add(q[i]); }
      catch (e) { left.push(q[i]); }
    }
    window.__AIVO_PENDING_JOBS__ = left;
    return left.length === 0;
  }

  setInterval(function () {
    try { tryFlushPendingJobs(); } catch (_) {}
  }, 500);

  function addJobSafe(job) {
    // If AIVO_JOBS is not ready, queue it
    if (!window.AIVO_JOBS || typeof window.AIVO_JOBS.add !== "function") {
      window.__AIVO_PENDING_JOBS__.push(job);
      console.warn("[AIVO_APP] AIVO_JOBS not ready; queued job:", job.job_id);
      return { ok: true, via: "queued" };
    }

    try {
      window.AIVO_JOBS.add(job);
      return { ok: true, via: "add" };
    } catch (e) {
      console.warn("[AIVO_APP] AIVO_JOBS.add failed", e);
      // fallback: queue
      window.__AIVO_PENDING_JOBS__.push(job);
      return { ok: true, via: "queued_after_fail" };
    }
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

      return { ok: true, job_id: jid, via: r.via };
    } catch (e) {
      console.error("[AIVO_APP] generateMusic error", e);
      return { ok: false, error: String(e) };
    }
  };

  // ---------------------------
  // Bind click (capture) + In-flight lock
  // ---------------------------
  var BIND_VER = "2026-01-04d";
  if (window.__aivoGenerateBound === BIND_VER) return;
  window.__aivoGenerateBound = BIND_VER;

  document.addEventListener("click", async function (e) {
    var btn = e.target && e.target.closest && e.target.closest(
      "#musicGenerateBtn, [data-generate='music'], [data-generate^='music'], button[data-action='music']"
    );
    if (!btn) return;

    // capture: legacy bypass intentionally
    e.preventDefault();
    e.stopImmediatePropagation();

    // === IN-FLIGHT LOCK (tek tık = tek işlem) ===
    if (window.__aivoMusicInFlight) return;
    window.__aivoMusicInFlight = true;

    try {
      btn.setAttribute("aria-busy", "true");
      btn.disabled = true;

      // COST (default 5)
      var COST = 5;
      try {
        var dc = btn.getAttribute("data-credit-cost");
        if (dc != null && dc !== "") COST = Math.max(1, Number(dc) || COST);
      } catch (_) {}

      // 1) resolve email
      var email = resolveEmailSafe();
      if (!email) {
        toastSafe("Oturum email'i okunamadı. (consume için gerekli)", "error");
        openPricingSafe();
        console.warn("[AIVO_APP] email missing; cannot consume");
        return;
      }
      publishEmail(email);

      console.log("[AIVO_APP] CLICK", { cost: COST, email: email });

      // 2) consume on server
      var consumeRes = await consumeOnServer(email, COST, { reason: "music_generate", job_type: "music" });
      console.log("[AIVO_APP] CONSUME RES", consumeRes);

      if (!consumeRes || consumeRes.ok !== true) {
        // If server says insufficient -> pricing
        if (consumeRes && (consumeRes.error === "insufficient_credits" || consumeRes.error === "not_enough_credits")) {
          toastSafe("Yetersiz kredi. Kredi satın alman gerekiyor.", "error");
          openPricingSafe();
          return;
        }

        toastSafe("Kredi harcanamadı: " + String((consumeRes && consumeRes.error) || "unknown"), "error");
        return;
      }

      // 3) refresh credits from response or GET
      var nextCredits = (typeof consumeRes.credits === "number") ? consumeRes.credits : null;
      if (nextCredits == null) nextCredits = await fetchCreditsFromServer(email);

      if (typeof nextCredits === "number") {
        setLocalCreditsMirrors(nextCredits);
        refreshCreditsUI();
      } else {
        refreshCreditsUI();
      }

      toastSafe("İşlem başlatıldı. " + COST + " kredi harcandı.", "ok");

      // 4) create UI job
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
    } finally {
      // === IN-FLIGHT UNLOCK ===
      window.__aivoMusicInFlight = false;
      try { btn.removeAttribute("aria-busy"); } catch (_) {}
      try { btn.disabled = false; } catch (_) {}
    }
  }, true);

  // ---------------------------
  // Boot log
  // ---------------------------
  console.log("[AIVO_APP] studio.app.js loaded", {
    bind: window.__aivoGenerateBound,
    email: resolveEmailSafe() || null,
    hasJobs: !!window.AIVO_JOBS,
    jobsKeys: window.AIVO_JOBS ? Object.keys(window.AIVO_JOBS) : null
  });

})();
/* =========================================================
   SM-PACK ROUTE ALIAS PATCH (SAFE)
   - Put this at the VERY BOTTOM of studio.app.js
   - Normalizes page ids (sm-pack-a -> sm-pack)
   - Works with existing router (switchPage / AIVO_APP.*)
   ========================================================= */
(function () {
  "use strict";

  function normalizePage(p) {
    p = String(p || "").trim();
    // legacy / card aliases
    if (p === "sm-pack-a") return "sm-pack";
    if (p === "sm-pack") return "sm-pack";
    // future-proof: allow common variants
    if (p === "social-pack" || p === "social") return "sm-pack";
    return p;
  }

  function getPageFromURL() {
    try {
      var u = new URL(window.location.href);
      return u.searchParams.get("page") || "";
    } catch (_) {
      return "";
    }
  }

  function replacePageInURL(newPage) {
    try {
      var u = new URL(window.location.href);
      u.searchParams.set("page", newPage);
      window.history.replaceState(null, "", u.toString());
    } catch (_) {}
  }

  // 1) Normalize current URL on load (deep link)
  var urlPage = getPageFromURL();
  var normalized = normalizePage(urlPage);
  if (urlPage && normalized && urlPage !== normalized) {
    replacePageInURL(normalized);
  }

  // 2) Patch global switchers (without breaking existing logic)
  // A) window.switchPage
  if (typeof window.switchPage === "function" && !window.__aivoSwitchPageAliased) {
    window.__aivoSwitchPageAliased = true;
    var _origSwitchPage = window.switchPage;
    window.switchPage = function (pageId) {
      return _origSwitchPage.call(this, normalizePage(pageId));
    };
  }

  // B) window.AIVO_APP.* (common patterns)
  if (window.AIVO_APP && !window.__aivoAppPageAliased) {
    window.__aivoAppPageAliased = true;

    if (typeof window.AIVO_APP.switchPage === "function") {
      var _appSwitch = window.AIVO_APP.switchPage;
      window.AIVO_APP.switchPage = function (pageId) {
        return _appSwitch.call(this, normalizePage(pageId));
      };
    }

    if (typeof window.AIVO_APP.navigate === "function") {
      var _appNav = window.AIVO_APP.navigate;
      window.AIVO_APP.navigate = function (pageId) {
        return _appNav.call(this, normalizePage(pageId));
      };
    }
  }

  // 3) Normalize clicks (if any link carries an alias)
  // This is harmless even if your existing handler already exists.
  document.addEventListener(
    "click",
    function (e) {
      var el = e.target && e.target.closest ? e.target.closest("[data-page-link]") : null;
      if (!el) return;

      var raw = el.getAttribute("data-page-link");
      var n = normalizePage(raw);
      if (raw && n && raw !== n) {
        el.setAttribute("data-page-link", n);
      }
    },
    true
  );
})();
/* =========================================================
   SM-PACK — UI STATE (tema / platform)
   - Tek seçim
   - Sadece class toggle
   - Backend / kredi YOK
   ========================================================= */

(function () {
  // Sadece SM Pack sayfasında çalışsın
  const page = document.querySelector('.page-sm-pack');
  if (!page) return;

  let selectedTheme = 'viral';
  let selectedPlatform = 'tiktok';

  /* ---------- TEMA SEÇİMİ ---------- */
  const themeButtons = page.querySelectorAll('[data-smpack-theme]');
  themeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      themeButtons.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      selectedTheme = btn.getAttribute('data-smpack-theme');
    });
  });

  /* ---------- PLATFORM SEÇİMİ ---------- */
  const platformButtons = page.querySelectorAll('.smpack-pill');
  platformButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      platformButtons.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      selectedPlatform = btn.textContent.trim().toLowerCase();
    });
  });

  /* ---------- (ŞİMDİLİK) DEBUG ---------- */
  const generateBtn = page.querySelector('.smpack-generate');
  if (generateBtn) {
    generateBtn.addEventListener('click', () => {
      console.log('[SM-PACK]', {
        theme: selectedTheme,
        platform: selectedPlatform
      });
    });
  }
})();
