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
/* =========================================================
   SM-PACK — HOVER = SELECT (delegated, reliable)
   - CSS değil, JS ile yapılır
   - Sayfa sonradan açılıyor olsa bile çalışır
   ========================================================= */
(function () {
  if (window.__aivoSMPackHoverBound) return;
  window.__aivoSMPackHoverBound = true;

  function setActive(list, el) {
    list.forEach(x => x.classList.remove("is-active"));
    el.classList.add("is-active");
  }

  // Tema hover
  document.addEventListener("mousemove", function (e) {
    const themeBtn = e.target.closest(".page-sm-pack [data-smpack-theme]");
    if (themeBtn) {
      const page = themeBtn.closest(".page-sm-pack");
      if (!page) return;
      const all = page.querySelectorAll("[data-smpack-theme]");
      setActive(all, themeBtn);
      return;
    }

    const pillBtn = e.target.closest(".page-sm-pack .smpack-pill");
    if (pillBtn) {
      const page = pillBtn.closest(".page-sm-pack");
      if (!page) return;
      const all = page.querySelectorAll(".smpack-pill");
      setActive(all, pillBtn);
      return;
    }
  }, { passive: true });
})();
/* =========================================================
   VIRAL HOOK — UI + MOCK JOB (SAFE)
   - Hover = seç (click de çalışır)
   - Hook Üret -> sağ panelde job kartı + 3 varyasyon
   ========================================================= */
(function bindViralHookOnce(){
  if (window.__aivoViralHookBound) return;
  window.__aivoViralHookBound = true;

  function qs(root, sel){ return (root || document).querySelector(sel); }
  function qsa(root, sel){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function showToast(msg){
    // Eğer sende global toast sistemi varsa onu kullanır; yoksa alert
    if (window.AIVO_APP && typeof window.AIVO_APP.toast === "function"){
      window.AIVO_APP.toast(msg);
      return;
    }
    alert(msg);
  }

  function getActivePage(){
    return qs(document, '.page.page-viral-hook[data-page="viral-hook"]');
  }

  function setActiveChoice(pageEl, value){
    var cards = qsa(pageEl, ".choice-card[data-hook-style]");
    cards.forEach(function(c){ c.classList.remove("is-active"); });
    var target = cards.find(function(c){ return c.getAttribute("data-hook-style") === value; });
    if (target) target.classList.add("is-active");
    pageEl.setAttribute("data-hook-style", value);
  }

  function getSelectedStyle(pageEl){
    var v = pageEl.getAttribute("data-hook-style");
    if (v) return v;
    // fallback: ilk is-active veya ilk kart
    var active = qs(pageEl, ".choice-card.is-active[data-hook-style]");
    if (active) return active.getAttribute("data-hook-style");
    var first = qs(pageEl, ".choice-card[data-hook-style]");
    return first ? first.getAttribute("data-hook-style") : "viral";
  }

  function buildHookTexts(style, brief){
    // Basit, profesyonel mock cümleler (sonra gerçek modele bağlanacak)
    var base = String(brief || "").trim();
    if (!base) base = "Kısa bir ürün/mesaj";

    var map = {
      viral: [
        "Bunu bilmiyorsan 3 saniyede kaybedersin: " + base,
        "Herkes bunu yanlış yapıyor… " + base,
        "Dur! Şunu dene: " + base
      ],
      "eğlenceli": [
        "Tam “benlik” bir şey: " + base,
        "Şaka değil… " + base,
        "Bir bak, gülümsetecek: " + base
      ],
      duygusal: [
        "Bazen tek cümle yeter… " + base,
        "Kalbe dokunan kısmı şu: " + base,
        "Dinle, çünkü tanıdık gelecek: " + base
      ],
      marka: [
        "Bugün bunu tanıtıyoruz: " + base,
        "Yeni çıktı: " + base + " — kaçırma.",
        "Kısa, net: " + base
      ]
    };

    return map[style] || map.viral;
  }

  function createRightJob(pageEl, brief, style){
    var rightPanel = qs(pageEl, ".right-panel");
    var list = qs(rightPanel, ".right-list");
    if (!list) return null;

    var empty = qs(rightPanel, ".right-empty");
    if (empty) empty.style.display = "none";

    var texts = buildHookTexts(style, brief);

    var job = document.createElement("div");
    job.className = "right-job";

    job.innerHTML = ''
      + '<div class="right-job__top">'
      + '  <div>'
      + '    <div class="right-job__title">Viral Hook</div>'
      + '    <div class="card-subtitle" style="opacity:.85;margin-top:2px;">3 varyasyon</div>'
      + '  </div>'
      + '  <div class="right-job__status" data-job-status>Üretiliyor</div>'
      + '</div>'
      + '<div class="right-job__line" data-line="1">'
      + '  <div class="right-job__badge">1</div>'
      + '  <div class="right-job__text">' + escapeHtml(texts[0]) + '</div>'
      + '  <div class="right-job__state is-doing" data-state>Üretiliyor</div>'
      + '</div>'
      + '<div class="right-job__line" data-line="2">'
      + '  <div class="right-job__badge">2</div>'
      + '  <div class="right-job__text">' + escapeHtml(texts[1]) + '</div>'
      + '  <div class="right-job__state" data-state>Bekliyor</div>'
      + '</div>'
      + '<div class="right-job__line" data-line="3">'
      + '  <div class="right-job__badge">3</div>'
      + '  <div class="right-job__text">' + escapeHtml(texts[2]) + '</div>'
      + '  <div class="right-job__state" data-state>Bekliyor</div>'
      + '</div>';

    // en üste ekleyelim
    list.insertBefore(job, list.firstChild);

    // sağ paneli görünür “scroll”
    try { list.scrollTop = 0; } catch(e){}

    return job;
  }

  function escapeHtml(s){
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function runMock(jobEl){
    if (!jobEl) return;

    var status = qs(jobEl, "[data-job-status]");
    var l1 = qs(jobEl, '[data-line="1"] [data-state]');
    var l2 = qs(jobEl, '[data-line="2"] [data-state]');
    var l3 = qs(jobEl, '[data-line="3"] [data-state]');

    function setDoing(el){
      if (!el) return;
      el.textContent = "Üretiliyor";
      el.classList.add("is-doing");
      el.classList.remove("is-done");
    }
    function setDone(el){
      if (!el) return;
      el.textContent = "Hazır";
      el.classList.remove("is-doing");
      el.classList.add("is-done");
    }

    setDoing(l1);

    setTimeout(function(){
      setDone(l1);
      setDoing(l2);
    }, 900);

    setTimeout(function(){
      setDone(l2);
      setDoing(l3);
    }, 1800);

    setTimeout(function(){
      setDone(l3);
      if (status) status.textContent = "Tamamlandı";
    }, 2700);
  }

  // Delegated events
  document.addEventListener("mouseover", function(e){
    var pageEl = getActivePage();
    if (!pageEl) return;

    var card = e.target.closest('.page-viral-hook .choice-card[data-hook-style]');
    if (!card) return;

    // hover ile seç
    var val = card.getAttribute("data-hook-style");
    setActiveChoice(pageEl, val);
  }, true);

  document.addEventListener("click", function(e){
    var pageEl = getActivePage();
    if (!pageEl) return;

    // click ile de seç
    var card = e.target.closest('.page-viral-hook .choice-card[data-hook-style]');
    if (card){
      var val = card.getAttribute("data-hook-style");
      setActiveChoice(pageEl, val);
      return;
    }

    // Hook Üret
    var btn = e.target.closest('.page-viral-hook .hook-generate');
    if (!btn) return;

    var input = qs(pageEl, '.input');
    var brief = input ? String(input.value || "").trim() : "";
    if (!brief){
      showToast("Konu / Ürün / Mesaj alanını 1 cümle doldur.");
      if (input) input.focus();
      return;
    }

    var style = getSelectedStyle(pageEl);
    var job = createRightJob(pageEl, brief, style);
    runMock(job);
  }, true);

})();
/* =========================================================
   SM PACK — UI + JOB (V1)
   - Hover ile seçim (mouseenter -> active)
   - Paketi Oluştur: sağ panelde job kartı + 4 adım akışı
   ========================================================= */
(function smPackV1(){
  if (window.__aivoSmPackBound) return;
  window.__aivoSmPackBound = true;

  const PAGE_SEL = '.page-sm-pack';

  function q(root, sel){ return (root || document).querySelector(sel); }
  function qa(root, sel){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function getActiveTheme(page){
    const a = q(page, '[data-sm-theme].is-active');
    return a ? a.getAttribute('data-sm-theme') : '';
  }
  function getActivePlatform(page){
    const a = q(page, '[data-sm-platform].is-active');
    return a ? a.getAttribute('data-sm-platform') : '';
  }

  function setActive(groupEls, el){
    groupEls.forEach(x => x.classList.remove('is-active'));
    el.classList.add('is-active');
  }

  // Sağ panel listesi (mevcut yapına uyumlu)
  function getRightList(){
    // sayfaya özel right-panel varsa önce onu bul
    const page = q(document, PAGE_SEL);
    if (page){
      const list = q(page, '.right-list');
      if (list) return list;
    }
    // genel fallback
    return q(document, '.right-list');
  }

  function createJobCard(title){
    const list = getRightList();
    if (!list) return null;

    // "empty" varsa gizle
    const empty = q(list, '.right-empty');
    if (empty) empty.style.display = 'none';

    const id = 'sm_' + Date.now().toString(36) + '_' + Math.floor(Math.random()*9999);

    const card = document.createElement('div');
    card.className = 'job-card job-card--sm';
    card.setAttribute('data-job-id', id);

    card.innerHTML = `
      <div class="job-card__head">
        <div class="job-card__title">${title}</div>
        <div class="job-card__badge">SM PACK</div>
      </div>
      <div class="job-card__meta">
        <span class="job-pill job-pill--run">Üretiliyor</span>
        <span class="job-card__time">${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
      </div>
      <div class="job-steps">
        <div class="job-step is-doing" data-step="1">1) Müzik (8–12 sn) hazırlanıyor…</div>
        <div class="job-step" data-step="2">2) Video loop hazırlanıyor…</div>
        <div class="job-step" data-step="3">3) Kapak hazırlanıyor…</div>
        <div class="job-step" data-step="4">4) Caption/hashtag hazırlanıyor…</div>
      </div>
      <div class="job-card__done" style="display:none;">Tamamlandı</div>
    `;

    list.prepend(card);
    return card;
  }

  function advanceStep(card, stepNo){
    const steps = qa(card, '.job-step');
    steps.forEach(s => s.classList.remove('is-doing','is-done'));

    const doneMax = stepNo - 1;
    steps.forEach(s => {
      const n = parseInt(s.getAttribute('data-step'), 10);
      if (n <= doneMax) s.classList.add('is-done');
    });

    const current = q(card, `.job-step[data-step="${stepNo}"]`);
    if (current) current.classList.add('is-doing');
  }

  function finishJob(card){
    const steps = qa(card, '.job-step');
    steps.forEach(s => s.classList.remove('is-doing'));
    steps.forEach(s => s.classList.add('is-done'));

    const pill = q(card, '.job-pill');
    if (pill){
      pill.classList.remove('job-pill--run');
      pill.classList.add('job-pill--ok');
      pill.textContent = 'Hazır';
    }
    const done = q(card, '.job-card__done');
    if (done) done.style.display = 'block';
  }

  function runFakePipeline(card){
    // 4 satır “Üretiliyor → Hazır”
    advanceStep(card, 1);
    setTimeout(() => advanceStep(card, 2), 900);
    setTimeout(() => advanceStep(card, 3), 1800);
    setTimeout(() => advanceStep(card, 4), 2700);
    setTimeout(() => finishJob(card), 3600);
  }

  // Delegated events
  document.addEventListener('mouseenter', function(e){
    const page = e.target.closest(PAGE_SEL);
    if (!page) return;

    const theme = e.target.closest('[data-sm-theme]');
    if (theme){
      const all = qa(page, '[data-sm-theme]');
      setActive(all, theme);
      return;
    }

    const plat = e.target.closest('[data-sm-platform]');
    if (plat){
      const all = qa(page, '[data-sm-platform]');
      setActive(all, plat);
      return;
    }
  }, true);

  document.addEventListener('click', function(e){
    const page = e.target.closest(PAGE_SEL);
    if (!page) return;

    const btn = e.target.closest('[data-sm-generate]');
    if (!btn) return;

    const theme = getActiveTheme(page) || 'viral';
    const platform = getActivePlatform(page) || 'tiktok';

    const card = createJobCard(`Sosyal Medya Paketi • ${theme.toUpperCase()} • ${platform}`);
    if (!card) return;

    runFakePipeline(card);

    // (İleride) gerçek entegrasyon notu:
    // - Job type: SM_PACK
    // - (İstersen) 8 kredi tüketimi
    // - studio.jobs.js polling ile “result” düşürme
  });
})();
/* =========================================================
   SIDEBAR — Instant Open on Touch (iOS-stable)
   Strategy:
   - touchend (iOS) + pointerup (modern) => trigger
   - dispatch real MouseEvent('click') to reuse existing click routing
   - ghost-click / double-fire guard
   ========================================================= */
(function bindSidebarInstantOpenOnce(){
  if (window.__aivoSidebarInstantOpenBound) return;
  window.__aivoSidebarInstantOpenBound = true;

  function findBtn(t){
    return (t && t.closest) ? t.closest(".sidebar .sidebar-link[data-page-link]") : null;
  }

  function fireClick(el){
    if (!el) return;

    // iOS’ta el.click() bazen güvenilmez; gerçek event daha stabil
    try{
      var ev = new MouseEvent("click", { bubbles:true, cancelable:true, view: window });
      el.dispatchEvent(ev);
    }catch(_){
      try { el.click(); } catch(__) {}
    }
  }

  var lastFireAt = 0;
  var lastEl = null;

  function shouldBlockClick(el){
    return (lastEl === el && (Date.now() - lastFireAt) < 800);
  }

  // iOS: touchend daha stabil
  document.addEventListener("touchend", function(e){
    var el = findBtn(e.target);
    if (!el) return;

    lastEl = el;
    lastFireAt = Date.now();

    // touchend’de ghost click riskini azaltmak için:
    e.preventDefault();
    e.stopPropagation();

    fireClick(el);
  }, { capture: true, passive: false });

  // Modern: pointerup (touch/pen)
  document.addEventListener("pointerup", function(e){
    if (e.pointerType !== "touch" && e.pointerType !== "pen") return;

    var el = findBtn(e.target);
    if (!el) return;

    lastEl = el;
    lastFireAt = Date.now();

    fireClick(el);
  }, { capture: true, passive: true });

  // Ghost/double click engelle
  document.addEventListener("click", function(e){
    var el = findBtn(e.target);
    if (!el) return;

    if (shouldBlockClick(el)){
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
})();
<script>
(function(){
  var input = document.getElementById('recordMp3Input');
  var nameEl = document.getElementById('recordUploadFileName');
  var box = document.getElementById('recordUploadBox');

  if(!input || !nameEl || !box) return;

  input.addEventListener('change', function(){
    var f = input.files && input.files[0];
    if(!f) { nameEl.style.display = 'none'; nameEl.textContent = ''; return; }
    nameEl.textContent = 'Seçilen: ' + f.name;
    nameEl.style.display = 'block';
  });

  // drag UI (dosyayı label üstüne sürükleyince)
  ['dragenter','dragover'].forEach(function(ev){
    box.addEventListener(ev, function(e){
      e.preventDefault();
      box.classList.add('is-dragover');
    });
  });

  ['dragleave','drop'].forEach(function(ev){
    box.addEventListener(ev, function(e){
      e.preventDefault();
      box.classList.remove('is-dragover');
    });
  });

  // drop ile input’a dosyayı set et (tarayıcı izin veriyorsa)
  box.addEventListener('drop', function(e){
    var dt = e.dataTransfer;
    if(dt && dt.files && dt.files.length){
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles:true }));
    }
  });
})();

/* =========================================================
   COVER — Style Cards + Presets (ACTIVE STABLE)
   ========================================================= */
(function bindCoverStyleUX_v2(){
  if (window.__aivoCoverStyleUXBoundV2) return;
  window.__aivoCoverStyleUXBoundV2 = true;

  function qs(sel, root){ return (root || document).querySelector(sel); }
  function qsa(sel, root){ return Array.from((root || document).querySelectorAll(sel)); }

  function normalizeTR(s){
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function isCoverActive(){
    return !!qs('.page.page-cover.is-active, .page-cover.is-active, .page-cover[data-page="cover"]');
  }

  function getPromptEl(){
    return qs('#coverPrompt') || qs('.page-cover textarea');
  }

  function setPrompt(text){
    var el = getPromptEl();
    if (!el) return;
    el.value = text || "";
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.focus();
  }

  function setActiveCard(card){
    qsa('.page-cover .style-card').forEach(function(b){ b.classList.remove('is-active'); });
    if (card) card.classList.add('is-active');
  }

  function trySelectStylePill(styleName){
    if (!styleName) return false;

    var target = normalizeTR(styleName);
    var pills = qsa('.page-cover .style-grid .style-pill');

    var hit = pills.find(function(btn){
      return normalizeTR(btn.textContent) === target;
    });

    if (hit && typeof hit.click === "function"){
      hit.click();
      return true;
    }
    return false;
  }

  document.addEventListener('click', function(e){
    if (!isCoverActive()) return;

    var card = e.target.closest('.page-cover .style-card');
    if (card){
      e.preventDefault();

      // 1) active her zaman set (kalıcı)
      setActiveCard(card);

      // 2) prompt bas
      var prompt = card.getAttribute('data-prompt') || "";
      if (prompt) setPrompt(prompt);

      // 3) pill seçmeyi dene ama başarısızsa active bozma
      var style = card.getAttribute('data-style') || "";
      trySelectStylePill(style);

      return;
    }

    var chip = e.target.closest('.page-cover .cover-presets .preset-chip');
    if (chip){
      e.preventDefault();

      var p = chip.getAttribute('data-prompt') || "";
      if (p) setPrompt(p);

      // preset istersen style da seçebilir
      var s = chip.getAttribute('data-style') || "";
      if (s) trySelectStylePill(s);

      return;
    }
  }, true);
})();


