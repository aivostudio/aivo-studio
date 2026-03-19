
// ===============================
// AIVO_JOBS — JOB BACKEND BRIDGE
// ===============================
window.AIVO_JOBS = window.AIVO_JOBS || {};

if (typeof window.AIVO_JOBS.upsert !== "function") {
  window.AIVO_JOBS.upsert = async function(job){
    console.log("[AIVO_JOBS] upsert:", job);

    const r = await fetch("/api/jobs/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: job.type || "video",
        params: job.params || job
      })
    });

    const j = await r.json().catch(() => ({}));
    console.log("[AIVO_JOBS] /api/jobs/create =>", r.status, j);
    return j;
  };
}
// =========================================================
// ✅ GLOBAL + BOOLEAN — Cover kredi tüketimi (TEK OTORİTE)
// =========================================================
window.consumeCoverCredits = async function (cost) {
  try {
    const res = await fetch("/api/credits/consume", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cost: Number(cost) || 0,
        reason: "cover_generate",
      }),
    });

    let data = null;
    try { data = await res.json(); } catch (_) {}

    if (!res.ok) return false;

    const credits =
      data?.credits ??
      data?.remaining ??
      data?.balance ??
      data?.credits?.remaining ??   // extra safety
      data?.data?.credits ??        // extra safety
      null;

    if (credits != null) {
      // ✅ Tek otorite: Store + UI
      try { window.AIVO_STORE_V1?.setCredits?.(Number(credits)); } catch (_) {}
      try { window.AIVO_STORE_V1?.syncCreditsUI?.(); } catch (_) {}
      try { window.refreshCreditsUI?.(); } catch (_) {}
      document.querySelector("#topCreditCount") && (document.querySelector("#topCreditCount").textContent = String(credits));

    }

    return true;
  } catch (e) {
    console.error("[consumeCoverCredits]", e);
    return false;
  }
};


/* 
 * ⚠️ TEMP DISABLED — DO NOT DELETE
 * Debug sonrası yeniden aktif edilecek
 */

/* ============================================================================
 * STRIPE CHECKOUT → STUDIO CREDIT APPLY (BOOT HANDLER)
 * ----------------------------------------------------------------------------
 * [TEMP DISABLED FOR DEBUG]
 * Bu blok şu an test/iz sürme için pasif.
 * Debug bitince tekrar aktif edeceğiz.
 * ==========================================================================

(function stripeSuccessCreditApply(){
  const p = new URLSearchParams(location.search);
  const ok = p.get("stripe") === "success";
  const session_id = p.get("session_id");
  if (!ok || !session_id) return;

  fetch("/api/stripe/verify-session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ session_id })
  })
  .then(r => r.json().then(j => ({ r, j })))
  .then(({ r, j }) => {
    console.log("[verify-session]", r.status, j);
    // kredi UI yenile (en basit)
    return fetch("/api/credits/get", { credentials: "include" });
  })
  .finally(() => {
    // tekrar çalışmasın
    history.replaceState({}, "", "/studio.html?stab=security");
  });
})();

*/
// ✅ SAFE STUB — legacy refreshCreditsUI bazı handler’larda çağrılıyor.
// Yoksa Safari ReferenceError ile bütün click akışı kırılıyor.
window.refreshCreditsUI = window.refreshCreditsUI || function () {
  try {
    // yeni sistem varsa onu kullan
    window.AIVO_STORE_V1?.syncCreditsUI?.();
  } catch (_) {}
};

// =========================================================
// AIVO — URL TOAST FLASH (storage'siz, kesin çözüm)
// studio.html?tf=success&tm=Girisiniz%20basarili
// =========================================================
(function AIVO_URL_TOAST_FLASH() {
  try {
    const u = new URL(window.location.href);
    const tf = u.searchParams.get("tf");
    const tm = u.searchParams.get("tm");
    if (!tf || !tm) return;

    const type = String(tf);
    const message = String(tm);

    let tries = 0;
    const MAX = 25; // ~1.25s

    const fire = () => {
      tries++;

      if (window.toast && typeof window.toast[type] === "function") {
        window.toast[type](decodeURIComponent(message));

        // URL'den temizle (tek seferlik)
        u.searchParams.delete("tf");
        u.searchParams.delete("tm");
        const qs = u.searchParams.toString();
        const clean = u.pathname + (qs ? "?" + qs : "");
        history.replaceState({}, "", clean);
        return;
      }

      if (tries < MAX) setTimeout(fire, 50);
    };

    fire();
  } catch (_) {}
})();

// ✅ AIVO_APP garanti (IIFE’den önce)
window.AIVO_APP = window.AIVO_APP || {};
 // =========================================================
  // ✅ AIVO_APP.generateCover — COVER EXPORT (TEK YER)
  // =========================================================

  window.AIVO_APP.generateCover = async function ({ prompt, cost = 6 } = {}) {
    const p = String(prompt || "").trim();
    if (!p) throw new Error("Prompt boş");

    
    // cover generate API
    const res = await fetch("/api/cover/generate", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: p }),
    });

    let data = null;
    try { data = await res.json(); } catch (_) {}

    if (!res.ok) {
      throw new Error(data?.error || "Cover generate failed");
    }

    return data; // { ok, imageUrl, prompt }
  };

/* =========================================================
   studio.app.js — AIVO APP (PROD MINIMAL) — REVISED (2026-01-04d)
   ========================================================= */

(function () {
  "use strict";

  window.AIVO_APP = window.AIVO_APP || {};
  window.__aivoJobSeq = window.__aivoJobSeq || 0;

  var CREDIT_KEY = "aivo_credits";
  var CREDIT_SHADOW_KEY = "aivo_credits_shadow";
  var EMAIL_KEY = "aivo_user_email";

  // Helpers
  // (toastSafe kaldırıldı — tek otorite: window.toast.*)


// ---------------------------
// Credit helpers
// ---------------------------
function getCreditCostFromText(text) {
  try {
    var m = String(text || "").match(/(\d+)\s*Kredi/i);
    return m ? parseInt(m[1], 10) : 0;
  } catch (_) {
    return 0;
  }
}

// ⬅️ BURADA redirectToPricing YOK (SİLİNDİ)



/* =========================
   CREDIT GATE — TEK OTORİTE
   (helpers + redirect + gate)
   ========================= */

// redirect helpers
function redirectToPricing(returnUrl) {
  try {
    var u = returnUrl || (location.pathname + location.search + location.hash);
    try { localStorage.setItem("aivo_return_after_pricing", u); } catch (_) {}
  } catch (_) {}
  location.href = "/fiyatlandirma.html";
}

function redirectToLogin(returnUrl) {
  try {
    var u = returnUrl || (location.pathname + location.search + location.hash);
    try { localStorage.setItem("aivo_return_after_login", u); } catch (_) {}

    try {
      if (typeof window.openAuthModal === "function") { window.openAuthModal("login"); return; }
      if (typeof window.openLoginModal === "function") { window.openLoginModal(); return; }
      if (typeof window.showAuthModal === "function") { window.showAuthModal("login"); return; }
    } catch (_) {}
   location.href = "/studio.v2.html?open=login";
  } catch (_) {
   location.href = "/studio.v2.html?open=login";
  }
}

function toInt(v) {
  var n = parseInt(String(v), 10);
  return isNaN(n) ? 0 : n;
}

/**
 * requireCreditsOrGo(cost, reasonLabel)
 */
async function requireCreditsOrGo(cost, reasonLabel) {
  try {
    var need = Math.max(0, toInt(cost));
    var reason = reasonLabel || "unknown";
    if (need <= 0) return true;

    var have = 0;
    try { have = toInt(localStorage.getItem("aivo_credits")); } catch (_) {}

    if (have < need) {
     
      redirectToPricing();
      return false;
    }

    var res = await fetch("/api/credits/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ cost: need, reason: reason })
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        try { window.toast?.error("Oturumun sona ermiş. Tekrar giriş yap."); } catch (_) {}
        redirectToLogin();
        return false;
      }
      try { window.toast?.error("Kredi düşümü başarısız. Tekrar dene."); } catch (_) {}
      return false;
    }

    var data = null;
    try { data = await res.json(); } catch (_) {}

    var newCredits = data?.credits ?? data?.remaining ?? data?.balance ?? null;
    try {
      localStorage.setItem(
        "aivo_credits",
        String(newCredits != null ? toInt(newCredits) : Math.max(0, have - need))
      );
    } catch (_) {}

    try { window.refreshCreditsUI?.(); } catch (_) {}
    return true;
  } catch (err) {
    try { console.error("requireCreditsOrGo error:", err); } catch (_) {}
    try { window.toast?.error("Kredi kontrolünde hata."); } catch (_) {}
    return false;
  }
}

try { window.requireCreditsOrGo = requireCreditsOrGo; } catch (_) {}

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
// 🔒 CREDIT HYDRATE — single source of truth
(async function hydrateCreditsOnce() {
  try {
    var r = await fetch("/api/credits/get", {
      credentials: "include",
      cache: "no-store"
    });

    var j = await r.json().catch(() => null);
    if (!j || !j.ok || typeof j.credits !== "number") return;

    // mirror everywhere
    try { localStorage.setItem("aivo_credits", String(j.credits)); } catch (_) {}
    try {
      if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.setCredits === "function") {
        window.AIVO_STORE_V1.setCredits(j.credits);
      }
    } catch (_) {}

    try {
      if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.syncCreditsUI === "function") {
        window.AIVO_STORE_V1.syncCreditsUI();
      }
    } catch (_) {}
  } catch (_) {}
})();

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
    console.log("[CONSUME]", email, amount);

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

// =========================================================
// MUSIC — PLAYER FIRST (NO JOBS)  ✅ REVIZE (TEMİZ)
// - UI: anında 2 kart basar (v1/v2)
// - Backend: /api/music/generate
// - Success: markReady (url yoksa markError)
// - Error: ikisini de markError
// =========================================================
window.AIVO_APP.generateMusic = async function (opts = {}) {
  try {
    const prompt = String(opts.prompt || "").trim();
    if (!prompt) {
      window.toast?.error?.("Prompt boş");
      return { ok: false, error: "prompt_empty" };
    }

    // 1️⃣ JOB CREATE (tek otorite)
    const jr = await fetch("/api/jobs/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "music" })
    });

    const j = await jr.json().catch(() => ({}));
    if (!jr.ok || !j.job_id) {
      throw new Error("job_create_failed");
    }

    const job_id = j.job_id;

    // 2️⃣ JOB → UI / Outputs (queued)
    window.AIVO_JOBS?.upsert?.({
      job_id,
      type: "music",
      status: "queued"
    });

    window.AIVO_OUTPUTS?.add?.({
      kind: "audio",
      job_id,
      status: "queued",
      title: "Müzik Üretimi"
    });

    // 3️⃣ BACKEND GENERATE (response’a BAĞLI DEĞİLİZ)
    fetch("/api/music/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_id,
        prompt
      })
    }).catch(() => {});

    return { ok: true, job_id };

  } catch (e) {
    console.error("[generateMusic]", e);
    window.toast?.error?.("Müzik başlatılamadı");
    return { ok: false, error: String(e) };
  }
};



// ✅ FIX: Global scope’ta await OLMAZ. Bu yüzden async wrapper’a aldık.
(async function __COVER_AFTER_RES_FIX__() {
  // ⚠️ Bu blok sadece “res” gerçekten globalde varsa çalışır.
  // Normalde cover akışı generateCoverReal içinde olmalı.
  if (typeof res === "undefined") return;

  const data = await res.json().catch(() => ({}));

  // En çok kullanılan cevap şekilleri
  const imageUrl =
    data.imageUrl ||
    data.image_url ||
    data.url ||
    (Array.isArray(data.urls) ? data.urls[0] : null) ||
    (Array.isArray(data.images) ? data.images[0] : null) ||
    null;

  if (!imageUrl) {
    toastErr("Kapak üretildi ama görsel URL gelmedi.");
    return;
  }

  // ✅ Gallery’ye bas
  pushToGallery(imageUrl);

  // ✅ Sağ panel / Jobs list’e bas (uzun bloktan aldığımız parça)
  const host =
    document.querySelector("[data-jobs-list], #jobsList, .jobs-list") || null;

  if (host) {
    const safePrompt = String(payload.prompt || "")
      .replace(/</g, "&lt;")
      .slice(0, 60);

    const item = document.createElement("button");
    item.className = "job-item";
    item.type = "button";
    item.innerHTML = `
      <div class="thumb"><img src="${imageUrl}" alt="cover"/></div>
      <div class="meta">
        <div class="title">Kapak</div>
        <div class="sub">${safePrompt}</div>
      </div>
    `;
    item.addEventListener("click", () => window.open(imageUrl, "_blank"));
    host.prepend(item);
  }

  // ✅ Tek başarı toast
  toastOk("Kapak oluşturuldu.");
})();


// ---------------------------
// Bind click (FINAL — UI trigger only)
// ---------------------------
var BIND_VER = "2026-01-04-final";
if (window.__aivoGenerateBound === BIND_VER) return;
window.__aivoGenerateBound = BIND_VER;

document.addEventListener("click", function (e) {
  var btn = e.target && e.target.closest && e.target.closest(
    "#musicGenerateBtn, [data-generate='music'], [data-generate^='music'], button[data-action='music']"
  );
  if (!btn) return;

  e.preventDefault();

  try {
    var prompt =
      (document.querySelector("#musicPrompt")?.value || "") ||
      (document.querySelector("textarea[name='prompt']")?.value || "") ||
      (document.querySelector("#prompt")?.value || "");

    var mode = document.querySelector("#musicMode")?.value || "instrumental";
    var quality = document.querySelector("#musicQuality")?.value || "standard";
    var durationSec = Math.max(
      5,
      Number(document.querySelector("#musicDuration")?.value || "30") || 30
    );

    // 🔒 TEK UI OTORİTESİ
    window.AIVO_APP.generateMusic({
      prompt: String(prompt || ""),
      mode,
      quality,
      durationSec
    });
  } catch (err) {
    console.error("[AIVO_APP] music click error", err);
  }
}, false);


// ---------------------------
// Boot log
// ---------------------------
console.log("[AIVO_APP] studio.app.js loaded", {
  bind: window.__aivoGenerateBound,
  email: resolveEmailSafe() || null,
  hasJobs: !!window.AIVO_JOBS,
  jobsKeys: window.AIVO_JOBS ? Object.keys(window.AIVO_JOBS) : null
});

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

  // showToast kaldırıldı
  // (tek toast otoritesi: window.toast.* — bu dosya toast üretmez)

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
    var active = qs(pageEl, ".choice-card.is-active[data-hook-style]");
    if (active) return active.getAttribute("data-hook-style");
    var first = qs(pageEl, ".choice-card[data-hook-style]");
    return first ? first.getAttribute("data-hook-style") : "viral";
  }

  function buildHookTexts(style, brief){
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

    list.insertBefore(job, list.firstChild);
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

document.addEventListener("mouseover", function(e){
  var pageEl = getActivePage();
  if (!pageEl) return;

  var card = e.target.closest('.page-viral-hook .choice-card[data-hook-style]');
  if (!card) return;

  var val = card.getAttribute("data-hook-style");
  setActiveChoice(pageEl, val);
}, true);

document.addEventListener("click", async function(e){

  var pageEl = getActivePage();
  if (!pageEl) return;

  var card = e.target.closest('.page-viral-hook .choice-card[data-hook-style]');
  if (card){
    var val = card.getAttribute("data-hook-style");
    setActiveChoice(pageEl, val);
    return;
  }

  var btn = e.target.closest('.page-viral-hook .hook-generate');
  if (!btn) return;

  var input = qs(pageEl, '.input');
  var brief = input ? String(input.value || "").trim() : "";

  if (!brief){
    window.toast?.error?.("Prompt boş. Viral Hook için kısa bir açıklama yaz."); // ⭐ EKLENDİ
    if (input) input.focus();
    return;
  }

if (!window.AIVO_STORE_V1 || typeof AIVO_STORE_V1.consumeCredits !== "function") {
  console.warn("[CREDITS] AIVO_STORE_V1 yok / consumeCredits yok");
  return;
}


 var ok = await AIVO_STORE_V1.consumeCredits(4);

  if (!ok) {
    window.toast?.error?.("Yetersiz kredi. Kredi satın alman gerekiyor.");
    if (typeof window.redirectToPricing === "function") {
      window.redirectToPricing();
    } else {
      var to = encodeURIComponent(location.pathname + location.search + location.hash);
      location.href = "/fiyatlandirma.html?from=studio&reason=insufficient_credit&to=" + to;
    }
    return;
  }

if (window.__AIVO_CREDITS_LOCKED__) return;

if (typeof AIVO_STORE_V1.syncCreditsUI === "function") {
  AIVO_STORE_V1.syncCreditsUI();
}


  window.toast?.success?.("Üretim başladı. 4 kredi düşüldü."); // ⭐ EKLENDİ

  var style = getSelectedStyle(pageEl);
  var job = createRightJob(pageEl, brief, style);
  runMock(job);
}, true);

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
   COVER — Style cards + Presets (stable)
   - Kart yazısı sorunu CSS ile çözülür
   - JS: seçili state kalır, prompt doldurur, bir kez bağlanır
   ========================================================= */
(function bindCoverUIOnce(){
  if (window.__aivoCoverUIBound) return;
  window.__aivoCoverUIBound = true;

  function qs(sel, root){ return (root || document).querySelector(sel); }
  function qsa(sel, root){ return Array.from((root || document).querySelectorAll(sel)); }

  function setActiveCard(card){
    if (!card) return;
    var wrap = card.closest(".cover-style-cards");
    if (!wrap) return;

    qsa(".style-card.is-active", wrap).forEach(function(el){ el.classList.remove("is-active"); });
    card.classList.add("is-active");
  }

  function setActivePreset(btn){
    var grid = btn.closest(".cover-presets-grid");
    if (!grid) return;
    qsa(".preset-chip.is-active", grid).forEach(function(el){ el.classList.remove("is-active"); });
    btn.classList.add("is-active");
  }

  function applyPromptAndStyle(promptText, styleName){
    var promptEl = qs("#coverPrompt");
    if (promptEl && typeof promptText === "string" && promptText.trim()){
      promptEl.value = promptText.trim();
      // input event tetikle (başka yerlerde dinleniyorsa)
      try { promptEl.dispatchEvent(new Event("input", { bubbles:true })); } catch(e){}
      promptEl.focus();
    }

    // Stil adına göre ilgili kartı aktif yap
    if (styleName){
      var card = qs('.cover-style-cards .style-card[data-style="' + CSS.escape(styleName) + '"]');
      if (card) setActiveCard(card);
    }
  }

  // Delegated click
  document.addEventListener("click", function(e){
    var styleBtn = e.target.closest(".cover-style-cards .style-card");
    if (styleBtn){
      e.preventDefault();
      // seçili kalsın
      setActiveCard(styleBtn);

      // data-prompt varsa prompt’a yaz
      var p = styleBtn.getAttribute("data-prompt") || "";
      var s = styleBtn.getAttribute("data-style") || "";
      if (p.trim()) applyPromptAndStyle(p, s);
      return;
    }

    var presetBtn = e.target.closest(".cover-presets .preset-chip");
    if (presetBtn){
      e.preventDefault();
      setActivePreset(presetBtn);

      var pp = presetBtn.getAttribute("data-prompt") || "";
      var ss = presetBtn.getAttribute("data-style") || "";
      applyPromptAndStyle(pp, ss);
      return;
    }
  }, true);

  // İlk yükte: ilk kartı default seç (istersen kaldır)
  document.addEventListener("DOMContentLoaded", function(){
    var first = qs(".cover-style-cards .style-card");
    if (first) first.classList.add("is-active");
  });
})();
/* =========================================================
   COVER — STYLE CARDS + PRESETS (TEK BLOK / STABLE)
   - Style karta tıkla: seçili kalır (.is-active)
   - Preset tıkla: style seçer + prompt doldurur
   ========================================================= */
(function bindCoverStyleOnce(){
  if (window.__aivoCoverStyleBound) return;
  window.__aivoCoverStyleBound = true;

  function qs(sel, root){ return (root || document).querySelector(sel); }
  function qsa(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function getPromptEl(){
    return (
      qs("#coverPrompt") ||
      qs("#coverDesc") ||
      qs("textarea[name='coverPrompt']") ||
      qs("textarea[name='prompt']") ||
      qs(".page-cover textarea") ||
      null
    );
  }

  function setActiveStyle(styleName){
    var root = qs(".page-cover") || document;

    qsa(".cover-style-cards .style-card", root).forEach(function(btn){
      var s = (btn.getAttribute("data-style") || "").trim();
      var on = (s === styleName);
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });

    var page = qs(".page-cover") || document.body;
    page.setAttribute("data-cover-style", styleName || "");
  }

  function applyPreset(btn){
    var styleName = (btn.getAttribute("data-style") || "").trim();
    var presetPrompt = (btn.getAttribute("data-prompt") || "").trim();

    if (styleName) setActiveStyle(styleName);

    var promptEl = getPromptEl();
    if (promptEl && presetPrompt) {
      var cur = (promptEl.value || "").trim();
      promptEl.value = cur ? (cur + "\n\n" + presetPrompt) : presetPrompt;
      try { promptEl.dispatchEvent(new Event("input", { bubbles:true })); } catch(_){}
      try { promptEl.focus(); } catch(_){}
    }
  }

  document.addEventListener("click", function(e){
    // Style card
    var styleBtn = e.target.closest(".page-cover .cover-style-cards .style-card");
    if (styleBtn) {
      e.preventDefault();
      var styleName = (styleBtn.getAttribute("data-style") || "").trim();
      if (styleName) setActiveStyle(styleName);
      return;
    }

    // Preset chip
    var presetBtn = e.target.closest(".page-cover .cover-presets .preset-chip");
    if (presetBtn) {
      e.preventDefault();
      applyPreset(presetBtn);
      return;
    }
  }, true);

  // Default: ilk kart seçili (istersen kaldır)
  document.addEventListener("DOMContentLoaded", function(){
    var first = qs(".page-cover .cover-style-cards .style-card");
    if (first){
      var styleName = (first.getAttribute("data-style") || "").trim();
      if (styleName) setActiveStyle(styleName);
    }
  });
})();
/* =========================================================
   SM PACK — GENERATE BUTTON BIND (FIX)
   - Supports: [data-generate-sm-pack] + .smpack-generate + [data-sm-generate]
   - Uses AIVO_APP.createJob/updateJobStatus/completeJob
   - Single bind guard
   ========================================================= */
(function bindSMPackGenerateOnce(){
  if (window.__aivoSMPackGenerateBound) return;
  window.__aivoSMPackGenerateBound = true;

  function safeText(s){
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function pickActive(page, attrName) {
    var active = page.querySelector("[" + attrName + "].is-active");
    if (active) return active.getAttribute(attrName) || "";
    var first = page.querySelector("[" + attrName + "]");
    return first ? (first.getAttribute(attrName) || "") : "";
  }

  function pickPlatform(page) {
    var a = page.querySelector(".smpack-pill.is-active");
    if (a) return (a.textContent || "").trim().toLowerCase();
    var f = page.querySelector(".smpack-pill");
    if (f) return (f.textContent || "").trim().toLowerCase();

    var ap = page.querySelector("[data-sm-platform].is-active");
    if (ap) return ap.getAttribute("data-sm-platform") || "";
    var fp = page.querySelector("[data-sm-platform]");
    return fp ? (fp.getAttribute("data-sm-platform") || "") : "";
  }

  function getMessage(page){
    var el =
      page.querySelector("[data-sm-pack-message]") ||
      page.querySelector("input[name='smPackMessage']") ||
      page.querySelector(".smpack-message") ||
      page.querySelector("input[type='text']");
    return el ? (el.value || "").trim() : "";
  }

// ---------------------------
// Toast (TEK OTORİTE)
// ---------------------------
function toast(msg, type) {
  try {
    var t = window.toast;

    if (!t || typeof t !== "object") {
      console.log("[toast]", type || "ok", msg);
      return;
    }

    var text =
      (typeof msg === "string")
        ? msg
        : (msg && (msg.message || msg.error)) || JSON.stringify(msg);

    var v =
      (type === "error") ? "error" :
      (type === "warn" || type === "warning") ? "warning" :
      (type === "info") ? "info" : "success";

    if (typeof t[v] === "function") {
      var title =
        (v === "error") ? "Hata" :
        (v === "warning") ? "Uyarı" :
        (v === "info") ? "Bilgi" : "Başarılı";
      return t[v](title, text);
    }

    console.log("[toast]", v, text);
  } catch (_) {
    console.log("[toast-fallback]", type || "ok", msg);
  }
}

document.addEventListener("click", function(e){
  var btn = e.target && e.target.closest && e.target.closest(
    "[data-generate-sm-pack], .smpack-generate, [data-sm-generate]"
  );
  if (!btn) return;

  var page = btn.closest(".page-sm-pack");
  if (!page) return;

  e.preventDefault();

 if (!window.AIVO_APP || typeof window.AIVO_APP.createJob !== "function") {
  // SM-PACK şu an mock akışta: AIVO_APP yoksa engelleme, sadece logla.
  console.warn("[SM-PACK] AIVO_APP missing (ignored - mock mode)");
  // İstersen burada toast da gösterme (çünkü ekstra toast istemiyoruz)
  // toast("Sistem hazır değil ...", "error");
  // return;  // <-- KALDIR
}


  // ✅ CREDIT GATE — SM PACK (TEK OTORİTE: job oluşmadan önce)
  // COST: 5
  if (!window.AIVO_STORE_V1 || typeof window.AIVO_STORE_V1.consumeCredits !== "function") {
    toast("Yetersiz kredi. Kredi satın alman gerekiyor.", "error");
    if (typeof window.redirectToPricing === "function") {
      window.redirectToPricing();
    } else {
      var to0 = encodeURIComponent(location.pathname + location.search + location.hash);
      location.href = "/fiyatlandirma.html?from=studio&reason=credit_store_missing&to=" + to0;
    }
    return;
  }

  var ok = window.AIVO_STORE_V1.consumeCredits(5);
  if (!ok) {
    toast("Yetersiz kredi. Kredi satın alman gerekiyor.", "error");
    if (typeof window.redirectToPricing === "function") {
      window.redirectToPricing();
    } else {
      var to1 = encodeURIComponent(location.pathname + location.search + location.hash);
      location.href = "/fiyatlandirma.html?from=studio&reason=insufficient_credit&to=" + to1;
    }
    return;
  }

  if (typeof window.AIVO_STORE_V1.syncCreditsUI === "function") {
    window.AIVO_STORE_V1.syncCreditsUI();
  }
 // ✅ CREDIT GATE — SM PACK (END)
  

if (document.querySelector('.page[data-page="sm-pack"].is-active') || document.querySelector('.page[data-page="sm-pack"][aria-hidden="false"]')) {
  console.warn("[studio.app] legacy SM-PACK disabled");
  return;
}


var theme =
  pickActive(page, "data-smpack-theme") ||
  pickActive(page, "data-sm-theme") ||
  "viral";


  var theme =
    pickActive(page, "data-smpack-theme") ||
    pickActive(page, "data-sm-theme") ||
    "viral";

  var platform = pickPlatform(page) || "tiktok";
  var message = getMessage(page) || "Mesaj";

  var j = window.AIVO_APP.createJob({
    type: "sm_pack",
    meta: { theme: theme, platform: platform, message: message }
  });

  window.AIVO_APP.updateJobStatus(j.job_id, "working");
  toast("SM Pack job oluşturuldu.", "ok");

  setTimeout(function(){ window.AIVO_APP.updateJobStatus(j.job_id, "step_music"); }, 600);
  setTimeout(function(){ window.AIVO_APP.updateJobStatus(j.job_id, "step_video"); }, 1200);
  setTimeout(function(){ window.AIVO_APP.updateJobStatus(j.job_id, "step_cover"); }, 1800);

  setTimeout(function(){
    var m = safeText(message);

    var items = [
      {
        kind: "caption",
        label: "Post Metni (V1)",
        text: "Bugün " + m + " için hızlı bir çözüm: 15 saniyede dene, farkı gör."
      },
      {
        kind: "caption",
        label: "Post Metni (V2)",
        text: "Herkes bunu yanlış yapıyor: " + m + " için en basit düzeltme burada."
      },
      {
        kind: "caption",
        label: "Post Metni (V3)",
        text: "Dur! Şunu dene: " + m + " — sonuçları yorumlara yaz."
      },
      {
        kind: "hashtags",
        label: "Hashtag Set",
        text: "#aivo #viral #tiktok #reels #shorts #trend"
      }
    ];

    window.AIVO_APP.completeJob(j.job_id, {
      ok: true,
      type: "sm_pack",
      theme: theme,
      platform: platform,
      message: message,
      items: items
    });
  }, 2600);

}, true);
})();

/* =========================================================
   OUTPUT RENDER — SM PACK (FINAL)
   - Aktif (görünen) sayfanın right-panel'ine basar
   - payload.items render eder (label + text)
   - Tek bind guard
   - Her satır için "Kopyala" butonu
   ========================================================= */
(function bindOutputsRendererOnce(){
  if (window.__aivoOutputsRendererBound) return;
  window.__aivoOutputsRendererBound = true;

  function escapeHtml(s){
    return String(s || "")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#39;");
  }

  function isVisible(el){
    if (!el) return false;
    if (el.offsetParent !== null) return true;
    var r = el.getBoundingClientRect();
    return (r.width > 0 && r.height > 0);
  }

  function getActivePage(){
    var p = document.querySelector(".page.is-active");
    if (p) return p;

    var pages = document.querySelectorAll(".page");
    for (var i=0;i<pages.length;i++){
      if (isVisible(pages[i])) return pages[i];
    }
    return null;
  }

  function getRightList(){
    var page = getActivePage();
    if (page){
      var list = page.querySelector(".right-panel .right-list");
      if (list) return list;
    }
    return document.querySelector(".right-panel .right-list");
  }

  function hideEmpty(list){
    if (!list) return;
    var empty = list.querySelector(".right-empty");
    if (empty) empty.style.display = "none";
  }

  function renderItemsCard(title, items){
    var card = document.createElement("div");
    card.className = "right-output-card";

    card.innerHTML = `
      <div class="right-output-head">
        <div>
          <div class="right-output-title">${escapeHtml(title)}</div>
          <div class="right-output-sub">Paket içeriği</div>
        </div>
        <div class="right-output-pill">Tamamlandı</div>
      </div>
      <div class="right-output-items"></div>
    `;

    var wrap = card.querySelector(".right-output-items");

    (items || []).forEach(function(it, idx){
      var label = (it && it.label) ? it.label : ("Öğe " + (idx + 1));
      var text  = (it && it.text) ? it.text : "";

      // data attribute için güvenli encode (HTML attribute kırılmasın)
      var dataCopy = encodeURIComponent(String(text || ""));

      var row = document.createElement("div");
      row.className = "right-output-row";
      row.innerHTML = `
        <div class="right-output-num">${idx + 1}</div>
        <div class="right-output-body">
          <div class="right-output-label">${escapeHtml(label)}</div>
          <div class="right-output-text">${escapeHtml(text)}</div>
        </div>
        <div class="right-output-actions">
          <div class="right-output-status">Hazır</div>
          <button class="right-copy-btn" type="button" data-copy="${dataCopy}">Kopyala</button>
        </div>
      `;
      wrap.appendChild(row);
    });

    return card;
  }

  function copyText(t){
    function ok(){
      try {
       window.toast.success("Kopyalandı", "Metin panoya kopyalandı.");

      } catch(_) {}
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(ok).catch(function(){});
      return;
    }

    // fallback
    try {
      var ta = document.createElement("textarea");
      ta.value = t;
      ta.setAttribute("readonly", "readonly");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      ok();
    } catch(_) {}
  }

  // Kopyala (delegated)
  document.addEventListener("click", function(e){
    var b = e.target && e.target.closest ? e.target.closest(".right-copy-btn") : null;
    if (!b) return;
    var raw = b.getAttribute("data-copy") || "";
    var text = "";
    try { text = decodeURIComponent(raw); } catch(_) { text = raw; }
    if (!text) return;
    e.preventDefault();
    copyText(text);
  }, true);

  // Job complete → render
  window.addEventListener("aivo:job:complete", function(ev){
    var d = ev && ev.detail ? ev.detail : {};
    var type = String(d.type || "");
    var payload = d.payload || {};

    // Şimdilik sadece SM PACK
    if (type !== "sm_pack") return;

    var items = payload.items;
    if (!Array.isArray(items) || items.length === 0) {
      console.warn("[SM_PACK] payload.items yok", payload);
      return;
    }

    var list = getRightList();
    if (!list) {
      console.warn("[SM_PACK] right-list bulunamadı");
      return;
    }

    hideEmpty(list);

    // aynı job_id iki kez geldiyse çift basma
    var jid = d.job_id ? String(d.job_id) : "";
    if (jid && list.querySelector('[data-job-card="' + jid + '"]')) return;

    var card = renderItemsCard("AI Sosyal Medya Paketi", items);
    if (jid) card.setAttribute("data-job-card", jid);

    list.prepend(card);
  });
})();
/* =========================================================
   VIRAL HOOK — SINGLE BIND + DEDUPE (FIX)
   - Aynı job_id için çift render'ı engeller
   - Tek bind guard (2 kez eklenirse çalışmaz)
   - aivo:job:complete event'inde viral_hook yakalar
   ========================================================= */
(function bindViralHookFixOnce(){
  // ✅ 1) Tek bind guard
  if (window.__aivoViralHookFixBound) return;
  window.__aivoViralHookFixBound = true;

  // ✅ 2) Global dedupe map (SM Pack ile de uyumlu kullanılır)
  window.__aivoRenderedJobs = window.__aivoRenderedJobs || {};

  function alreadyRendered(jobId){
    var jid = String(jobId || "");
    if (!jid) return false;
    if (window.__aivoRenderedJobs[jid]) return true;
    window.__aivoRenderedJobs[jid] = true;
    return false;
  }

  // ✅ 3) Hook çıktısını basan fonksiyon varsa onu çağırmayı dene
  //    (Senin projede isim farklı olabilir; burada güvenli fallback yaptım.)
  function tryRenderHook(detail){
    // Senin hook.js içinde bir render fonksiyonu varsa buraya bağla.
    // Örn: window.AIVO_HOOK_RENDER(detail) gibi.
    if (typeof window.AIVO_HOOK_RENDER === "function") {
      window.AIVO_HOOK_RENDER(detail);
      return true;
    }
    // Eğer hook.js zaten kendi listener’ı ile render ediyorsa,
    // bu blok sadece dedupe yapmış olur (render’a karışmaz).
    return false;
  }

  // ✅ 4) Event listener (capture)
  window.addEventListener("aivo:job:complete", function(ev){
    var d = ev && ev.detail ? ev.detail : {};
    var type = String(d.type || "");

    // sadece viral_hook
    if (type !== "viral_hook") return;

    var jid = d.job_id ? String(d.job_id) : "";

    // ✅ DEDUPE: aynı job_id ikinci kez gelirse dur
    if (jid && alreadyRendered(jid)) {
      console.warn("[VIRAL_HOOK] duplicate ignored:", jid);
      return;
    }

    // (Opsiyonel) chip/overlay çakışmasını azaltmak için:
    // Eğer DOM’da aynı job card / aynı hook kartı ikinci kez eklenmeye çalışıyorsa engeller.
    // (Kendi yapına göre selector değişebilir.)
    try {
      var list = document.querySelector(".right-panel .right-list");
      if (list && jid && list.querySelector('[data-job-card="' + jid + '"]')) {
        console.warn("[VIRAL_HOOK] DOM duplicate prevented:", jid);
        return;
      }
    } catch(_) {}

    // Render çağrısı (varsa)
    tryRenderHook(d);
  }, true);

})();
/* =========================================================
   AIVO DASHBOARD KPI FILL (SAFE)
   - KPI kartlarındaki data-kpi-* alanlarını doldurur
   - Kredi kaynağını 3 yoldan arar:
     1) window.AIVO_CREDITS / window.AIVO?.credits
     2) localStorage (credits / aivo_credits / aivo:credits)
     3) DOM (kredi yazan chip / sayaç elementleri)
   - Bulamazsa sessizce geçer (siteyi bozmaz)
   ========================================================= */
(function () {
  "use strict";

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function toInt(v) {
    var n = Number(String(v || "").replace(/[^\d]/g, ""));
    return isFinite(n) ? n : 0;
  }

  function setText(sel, val) {
    var el = qs(sel);
    if (!el) return false;
    el.textContent = (val === null || typeof val === "undefined") ? "—" : String(val);
    return true;
  }

  function setPill(sel, text) {
    var el = qs(sel);
    if (!el) return false;
    el.textContent = text || "—";
    return true;
  }

  function readCreditsFromGlobals() {
    try {
      if (typeof window.AIVO_CREDITS !== "undefined") return toInt(window.AIVO_CREDITS);
      if (window.AIVO && typeof window.AIVO.credits !== "undefined") return toInt(window.AIVO.credits);
      if (window.AIVO_APP && typeof window.AIVO_APP.credits !== "undefined") return toInt(window.AIVO_APP.credits);
    } catch (e) {}
    return null;
  }

  function readCreditsFromStorage() {
    try {
      var keys = ["credits", "aivo_credits", "aivo:credits", "AIVO_CREDITS"];
      for (var i = 0; i < keys.length; i++) {
        var v = localStorage.getItem(keys[i]);
        if (v !== null && v !== "") return toInt(v);
      }
    } catch (e) {}
    return null;
  }

  function readCreditsFromDOM() {
    // Sayfada "kredi" sayısı görünen bir yer varsa yakalamaya çalışır
    // (etiketler değişken olabileceği için geniş arar)
    var candidates = []

    // 1) data-credit / credit-count / credits
    candidates = candidates.concat(qsa("[data-credit], [data-credits], .credit, .credits, .credit-count, .credits-count"));

    // 2) İçinde "kredi" geçen chip/button/label
    candidates = candidates.concat(qsa("button, a, span, div").filter(function (el) {
      var t = (el.textContent || "").toLowerCase();
      return t.indexOf("kredi") !== -1 && /\d/.test(t);
    }));

    for (var i = 0; i < candidates.length; i++) {
      var t = (candidates[i].textContent || "").trim();
      var n = toInt(t);
      if (n > 0) return n;
    }
    return null;
  }

  function getCredits() {
    var n = readCreditsFromGlobals();
    if (n !== null && n >= 0) return n;

    n = readCreditsFromStorage();
    if (n !== null && n >= 0) return n;

    n = readCreditsFromDOM();
    if (n !== null && n >= 0) return n;

    return null;
  }

  function creditsState(n) {
    if (n === null) return { text: "—", cls: "" };
    if (n <= 0) return { text: "Bitti", cls: "is-low" };
    if (n <= 10) return { text: "Azaldı", cls: "is-warn" };
    return { text: "Yeterli", cls: "is-ok" };
  }

  function applyPillClass(pillEl, stateCls) {
    if (!pillEl) return;
    pillEl.classList.remove("is-ok", "is-warn", "is-low");
    if (stateCls) pillEl.classList.add(stateCls);
  }

  function fillDashboardKPI() {
    // Sadece dashboard page varsa çalış
    var page = qs('.page[data-page="dashboard"]');
    if (!page) return;

    // KREDİ
    var credits = getCredits();
    if (credits !== null) {
      qs("[data-kpi-credits]") && (qs("[data-kpi-credits]").textContent = String(credits));
      var st = creditsState(credits);
      var pill = qs("[data-kpi-credits-state]");
      if (pill) {
        pill.textContent = st.text;
        applyPillClass(pill, st.cls);
      }
    }

    // Bugün harcanan / son yükleme (şimdilik yoksa placeholder bırak)
    // İleride backend / log ile bağlarız.
    if (qs("[data-kpi-spent-today]") && qs("[data-kpi-spent-today]").textContent.trim() === "—") {
      // hesap yoksa 0 göster (daha iyi UX)
      qs("[data-kpi-spent-today]").textContent = "0";
    }
    if (qs("[data-kpi-last-topup]") && qs("[data-kpi-last-topup]").textContent.trim() === "—") {
      qs("[data-kpi-last-topup]").textContent = "—";
    }

    // BUGÜN ÜRETİLEN (jobs datası yoksa 0 göster)
    if (qs("[data-kpi-today-total]")) qs("[data-kpi-today-total]").textContent = "0";
    if (qs("[data-kpi-today-breakdown]")) {
      qs("[data-kpi-today-breakdown]").textContent = "Müzik: 0 • Video: 0 • Kapak: 0 • SM Pack: 0 • Hook: 0";
    }

    // SON İŞ (jobs datası yoksa “—” kalabilir; UX için “Henüz yok” diyelim)
    if (qs("[data-kpi-lastjob-status]")) qs("[data-kpi-lastjob-status]").textContent = "Henüz yok";
    if (qs("[data-kpi-lastjob-pill]")) qs("[data-kpi-lastjob-pill]").textContent = "—";
    if (qs("[data-kpi-lastjob-type]")) qs("[data-kpi-lastjob-type]").textContent = "—";
    if (qs("[data-kpi-lastjob-time]")) qs("[data-kpi-lastjob-time]").textContent = "—";

    // PAKET (şimdilik Basic varsay)
    if (qs("[data-kpi-plan]")) qs("[data-kpi-plan]").textContent = "Basic";
    if (qs("[data-kpi-plan-badge]")) qs("[data-kpi-plan-badge]").textContent = "Aktif";
    if (qs("[data-kpi-renewal]")) qs("[data-kpi-renewal]").textContent = "—";
    if (qs("[data-kpi-days-left]")) qs("[data-kpi-days-left]").textContent = "—";
  }

  // Dashboard’a geçişte de çalışsın diye birkaç kez güvenli dene
  function boot() {
    fillDashboardKPI();
    setTimeout(fillDashboardKPI, 250);
    setTimeout(fillDashboardKPI, 900);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // sayfa içi geçiş varsa (SPA), click sonrası da dene
  document.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest ? e.target.closest("[data-page-link]") : null;
    if (!btn) return;
    var target = btn.getAttribute("data-page-link");
    if (target === "dashboard") setTimeout(fillDashboardKPI, 120);
  });
})();


/* =========================================================
   AIVO_JOBS UPSERT FIX (GETTER LIST + setAll)
   - AIVO_JOBS.list = getter (set yok) -> direct mutate işe yaramaz
   - Çözüm: list'i oku -> clone -> upsert -> setAll(newList)
   ========================================================= */
(function(){
  "use strict";

  if (!window.AIVO_JOBS) return;

  var J = window.AIVO_JOBS;
  var hasSetAll = (typeof J.setAll === "function");
  var hasListGetter = false;

  try {
    var d = Object.getOwnPropertyDescriptor(J, "list");
    hasListGetter = !!(d && typeof d.get === "function");
  } catch(_) {}

  if (!hasSetAll || !hasListGetter) {
    console.warn("[AIVO_JOBS] upsert fix skipped (need list getter + setAll).", {
      hasSetAll: hasSetAll,
      hasListGetter: hasListGetter
    });
    return;
  }

  function normJob(job){
    job = job || {};
    var id = String(job.job_id || job.id || "");
    var type = String(job.type || job.kind || job.module || "job");
    var status = String(job.status || job.state || "queued");

    // created/time alanları farklı gelebilir; tekleştir
    var ts = job.ts || job.created_at || job.createdAt || Date.now();

    // job_id/id garanti
    return Object.assign({}, job, {
      job_id: id,
      id: id,
      type: type,
      status: status,
      ts: ts
    });
  }

  // Orijinali sakla (istersen debug için)
  var origUpsert = J.upsert;

  // ✅ Gerçek upsert: list getter'dan oku -> clone -> setAll
  J.upsert = function(job){
    var j = normJob(job);
    if (!j.job_id) return;

    var cur = [];
    try { cur = Array.isArray(J.list) ? J.list : []; } catch(_) { cur = []; }

    // clone
    var next = cur.slice();

    // find by job_id/id
    var idx = -1;
    for (var i=0;i<next.length;i++){
      var it = next[i];
      var itId = String((it && (it.job_id || it.id)) || "");
      if (itId === j.job_id) { idx = i; break; }
    }

    if (idx >= 0) {
      next[idx] = Object.assign({}, next[idx], j);
    } else {
      next.unshift(j);
    }

    // 🔥 Tek doğru yazma noktası
    J.setAll(next);

    return j;
  };

  // Bonus: bazen kod "add" diye çağırıyor olabilir -> upsert'e yönlendir
  if (typeof J.add !== "function") {
    J.add = function(job){ return J.upsert(job); };
  }

  console.log("[AIVO_JOBS] upsert fix active", {
    hadOrig: (typeof origUpsert === "function"),
    listIsGetter: true,
    hasSetAll: true
  });
})();

/* =========================================================
   GENERATE -> JOBS BRIDGE (COVER + VIDEO) — SINGLE BLOCK
   - cover/video butonlarına basınca AIVO_JOBS.upsert ile job yazar
   - AIVO_JOBS geç yüklenirse queue + flush
   - Mevcut music akışına karışmaz
   ========================================================= */
(function(){
  "use strict";

  // ---- guards
  if (window.__aivoGenBridgeBound) return;
  window.__aivoGenBridgeBound = true;

  // ---- helpers
  function uid(prefix){
    return prefix + "--" + Date.now() + "--" + Math.random().toString(36).slice(2,7);
  }
  function val(sel){
    try {
      var el = document.querySelector(sel);
      return el ? String(el.value || "").trim() : "";
    } catch(_) { return ""; }
  }

  // ---- queue if jobs not ready
  window.__AIVO_PENDING_JOBS__ = window.__AIVO_PENDING_JOBS__ || [];

  function jobsReady(){
    return (window.AIVO_JOBS && typeof window.AIVO_JOBS.upsert === "function");
  }

  function pushJob(job){
   if (!jobsReady()){
  // AIVO_JOBS bu sayfada yoksa queue/flush yapma (sonsuz kuyruk)
  console.warn("[GEN_BRIDGE] skipped (AIVO_JOBS missing):", job.job_id);
  return;
}

    try {
      window.AIVO_JOBS.upsert(job);
      // optional: bazı UI’lar add() bekliyor olabilir
      if (typeof window.AIVO_JOBS.add === "function") {
        // add zaten upsert'e map olabilir; sorun yok
      }
    } catch(e){
      console.warn("[GEN_BRIDGE] upsert failed, re-queued:", e);
      window.__AIVO_PENDING_JOBS__.push(job);
    }
  }

  function flush(){
    if (!jobsReady()) return;
    var q = window.__AIVO_PENDING_JOBS__;
    if (!Array.isArray(q) || !q.length) return;
    window.__AIVO_PENDING_JOBS__ = [];
    q.forEach(function(j){
      try { window.AIVO_JOBS.upsert(j); } catch(e){ window.__AIVO_PENDING_JOBS__.push(j); }
    });
  }

  // AIVO_JOBS geç geldiyse flush
  setInterval(flush, 400);

  // ---- core: create job object
  function makeJob(type){
    var now = Date.now();
    var job = {
      job_id: uid(type),
      id: null,
      type: type,
      status: "queued",
      ts: now,
      created_at: now
    };
    job.id = job.job_id;

    // payload (opsiyonel ama faydalı)
    if (type === "cover") {
      job.prompt = val("#coverPrompt") || val("textarea[name='coverPrompt']") || val(".page-cover textarea");
    }
    if (type === "video") {
      job.prompt = val("#videoPrompt") || val("textarea[name='videoPrompt']") || val(".page-video textarea");
    }
    return job;
  }

  // ---- click router (capture)
  document.addEventListener("click", function(e){
    var btn = e.target && e.target.closest ? e.target.closest(
      "#coverGenerateBtn, [data-generate='cover'], #videoGenerateBtn, [data-generate='video']"
    ) : null;
    if (!btn) return;

    var type =
      (btn.getAttribute("data-generate") || "").trim() ||
      (btn.id === "coverGenerateBtn" ? "cover" : (btn.id === "videoGenerateBtn" ? "video" : ""));

    if (type !== "cover" && type !== "video") return;

    // sadece job yazacağız; legacy davranışı bozmayalım diye stop etmiyoruz
    // ama çift handler sorunu varsa istersen burada stopImmediatePropagation ekleriz.

    var job = makeJob(type);
    pushJob(job);

    console.log("[GEN_BRIDGE] job written:", job.type, job.job_id);

  }, true);

  console.log("[GEN_BRIDGE] active");
})();
/* =========================================================
   PROFILE STATS — SINGLE BLOCK (SAFE SCOPE + SPENT + COUNTERS + PERSIST) v3
   - Persist: aivo_profile_stats_v1 (+ backup)
   - Spent/Total: AIVO_STORE_V1.getCredits() delta
   - Counters: fetch + XHR ile /api/* çağrılarını yakalar (JSON + FormData + URLSearchParams)
   - SAFE: Sadece "Kullanım istatistikleri" kartının İÇİNE yazar; kart bulunamazsa asla DOM'a dokunmaz
   ========================================================= */
(function(){
  "use strict";

  var KEY = "aivo_profile_stats_v1";
  var BK  = "aivo_profile_stats_bk_v1";

  function safeParse(s, fallback){ try { return JSON.parse(String(s||"")); } catch(e){ return fallback; } }
  function clampInt(n){ n = Number(n||0); if(!isFinite(n)) n=0; n=Math.floor(n); return n<0?0:n; }
  function loadRaw(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
  function saveRaw(k,v){ try { localStorage.setItem(k,v); } catch(e){} }

  function empty(){
    return { music:0, cover:0, video:0, spent:0, total:null, lastCredits:null, seen:{} };
  }
  function isAllZero(obj){
    if(!obj) return true;
    return !obj.music && !obj.cover && !obj.video && !obj.spent &&
      (!obj.seen || !Object.keys(obj.seen).length);
  }

  // ---- load + restore ----
  var main = safeParse(loadRaw(KEY), null);
  var bk   = safeParse(loadRaw(BK), null);
  var stats = empty();
  if (main && typeof main === "object") stats = Object.assign(stats, main);
  if (isAllZero(stats) && bk && typeof bk === "object" && !isAllZero(bk)) {
    stats = Object.assign(stats, bk);
    saveRaw(KEY, JSON.stringify(stats));
  }

  stats.music = clampInt(stats.music);
  stats.cover = clampInt(stats.cover);
  stats.video = clampInt(stats.video);
  stats.spent = clampInt(stats.spent);
  if (stats.total != null) stats.total = clampInt(stats.total);
  if (stats.lastCredits != null) stats.lastCredits = clampInt(stats.lastCredits);
  if (!stats.seen || typeof stats.seen !== "object") stats.seen = {};

  function persist(){
    var json = JSON.stringify(stats);
    saveRaw(KEY, json);
    saveRaw(BK,  json);
  }

  // ---- SAFE ROOT: sadece istatistik kartı ----
  function getStatsCardRoot(){
    // Başlık metni case-insensitive contains
    var nodes = document.querySelectorAll("h1,h2,h3,h4,div,span");
    for (var i=0;i<nodes.length;i++){
      var el = nodes[i];
      if (!el || !el.textContent) continue;
      var t = el.textContent.trim().toLowerCase();
      if (t === "kullanım istatistikleri" || t.indexOf("kullanım istatistikleri") !== -1) {
        // En yakın büyük kart/container
        var root = el.closest(".card, section, .panel, .aivo-card, .profile-card");
        if (root) return root;
      }
    }
    return null; // bulunamazsa asla yazma
  }

  function qs(sel, root){ try { return (root||document).querySelector(sel); } catch(e){ return null; } }
  function qsa(sel, root){ try { return Array.prototype.slice.call((root||document).querySelectorAll(sel)); } catch(e){ return []; } }

  function paintByLabel(root, label, value){
    label = String(label||"").toLowerCase();
    // sadece root içinde arıyoruz; root null ise çağrılmayacak
    var rows = qsa("button, .row, .stat-row, .usage-row, .line, .item, .pill, .chip-btn, .stat-pill", root);
    for (var i=0;i<rows.length;i++){
      var row = rows[i];
      var text = (row.textContent||"").toLowerCase();
      if (text.indexOf(label) === -1) continue;

      // Sağdaki değer: genelde son span/strong/div
      var val =
        qs("[data-value]", row) ||
        qs(".value", row) ||
        qs(".stat-value", row) ||
        qs("strong", row) ||
        (function(){
          var spans = row.querySelectorAll("span, div");
          return spans && spans.length ? spans[spans.length-1] : null;
        })();

      if (val) { val.textContent = String(value); return true; }
    }
    return false;
  }

  // ---- credits (spent/total) ----
  function readTotalCredits(){
    try {
      if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.getCredits === "function") {
        var v = window.AIVO_STORE_V1.getCredits();
        if (v != null) return clampInt(v);
      }
    } catch(e){}
    return (stats.total == null ? null : clampInt(stats.total));
  }

  function syncSpentFromCredits(){
    var now = readTotalCredits();
    if (now == null) return;
    stats.total = now;

    if (stats.lastCredits == null) {
      stats.lastCredits = now;
      persist();
      return;
    }

    var prev = clampInt(stats.lastCredits);
    if (now < prev) stats.spent += (prev - now);
    stats.lastCredits = now;
    persist();
  }

  // ---- body parse (JSON + string + FormData + URLSearchParams) ----
  function kindFromObject(obj){
    if (!obj || typeof obj !== "object") return "";
    var k = String(obj.kind || obj.type || obj.module || obj.product || "").toLowerCase();
    if (k === "music" || k === "müzik") return "music";
    if (k === "cover" || k === "kapak") return "cover";
    if (k === "video") return "video";
    return "";
  }

  function kindFromBody(body){
    try{
      if (!body) return "";

      // URLSearchParams
      if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
        return kindFromObject({
          kind: body.get("kind") || body.get("type") || body.get("module") || body.get("product")
        });
      }

      // FormData
      if (typeof FormData !== "undefined" && body instanceof FormData) {
        return kindFromObject({
          kind: body.get("kind") || body.get("type") || body.get("module") || body.get("product")
        });
      }

      // string JSON
      if (typeof body === "string") {
        var obj = safeParse(body, null);
        if (obj) return kindFromObject(obj);
      }

      // plain object
      if (typeof body === "object") return kindFromObject(body);

      return "";
    } catch(e){ return ""; }
  }

  function kindFromUrl(url){
    url = String(url||"").toLowerCase();
    if (url.indexOf("/api/music") !== -1) return "music";
    if (url.indexOf("/api/cover") !== -1) return "cover";
    if (url.indexOf("/api/video") !== -1) return "video";
    if (url.indexOf("/api/jobs/create") !== -1) return "job";
    return "";
  }

  function seen(jobId){
    jobId = String(jobId||"");
    if (!jobId) return false;
    if (stats.seen[jobId]) return true;
    stats.seen[jobId] = Date.now();
    return false;
  }

  function inc(kind, jobId){
    if (jobId && seen(jobId)) return;

    if (kind === "music") stats.music++;
    else if (kind === "cover") stats.cover++;
    else if (kind === "video") stats.video++;
    else return;

    persist();
    paint(); // UI güncelle
  }

  // ---- paint (SADECE kart içinde) ----
  function paint(){
    var root = getStatsCardRoot();
    if (!root) return; // güvenlik: kart bulunamazsa DOM'a dokunma

    syncSpentFromCredits();

    // data-attr varsa onları kullan
    var m = qs("[data-profile-stat-music]", root);
    var c = qs("[data-profile-stat-cover]", root);
    var v = qs("[data-profile-stat-video]", root);
    var s = qs("[data-profile-stat-spent]", root);
    var t = qs("[data-profile-stat-total]", root);

    if (m) m.textContent = String(stats.music); else paintByLabel(root, "müzik", stats.music);
    if (c) c.textContent = String(stats.cover); else paintByLabel(root, "kapak", stats.cover);

    // video bazen "Henüz yok" — sayı basıyoruz
    if (v) v.textContent = String(stats.video); else paintByLabel(root, "video", stats.video);

    if (s) s.textContent = String(stats.spent); else paintByLabel(root, "harcanan", stats.spent);

    var totalText = (stats.total == null ? "0" : String(stats.total));
    if (t) t.textContent = totalText; else paintByLabel(root, "toplam", totalText);
  }

  // ---- hook fetch ----
  function hookFetch(){
    if (window.__AIVO_STATS_FETCH_HOOK_V3__) return;
    window.__AIVO_STATS_FETCH_HOOK_V3__ = true;

    if (typeof window.fetch !== "function") return;
    var _fetch = window.fetch;

    window.fetch = function(input, init){
      var url = (typeof input === "string") ? input : (input && input.url) ? input.url : "";
      var body = init && init.body;

      var kBody = kindFromBody(body);
      var kUrl  = kindFromUrl(url);
      var kind  = kBody || kUrl;

      return _fetch.apply(this, arguments).then(function(res){
        try{
          var isInteresting = (kind === "music" || kind === "cover" || kind === "video" || String(url).toLowerCase().indexOf("/api/jobs/create") !== -1);
          if (!isInteresting) return res;

          var clone = res.clone();
          clone.json().then(function(data){
            var jobId = data && (data.job_id || data.id || (data.job && (data.job.job_id || data.job.id)));
            var finalKind = kind;

            // jobs/create ise kind body'den geliyordur; response'ta da gelebilir
            if (finalKind === "job") finalKind = kBody || kindFromObject(data) || kindFromUrl(url);

            if (finalKind === "music" || finalKind === "cover" || finalKind === "video") inc(finalKind, jobId || null);
          }).catch(function(){
            // json değilse bile en azından artır
            if (kind === "music" || kind === "cover" || kind === "video") inc(kind, null);
          });
        } catch(e){}
        return res;
      });
    };
  }

  // ---- hook XHR ----
  function hookXHR(){
    if (window.__AIVO_STATS_XHR_HOOK_V3__) return;
    window.__AIVO_STATS_XHR_HOOK_V3__ = true;

    if (!window.XMLHttpRequest) return;
    var XHR = window.XMLHttpRequest;
    var open = XHR.prototype.open;
    var send = XHR.prototype.send;

    XHR.prototype.open = function(method, url){
      this.__aivo_url = url;
      return open.apply(this, arguments);
    };

    XHR.prototype.send = function(body){
      var xhr = this;
      var url = xhr.__aivo_url || "";

      var kBody = kindFromBody(body);
      var kUrl  = kindFromUrl(url);
      var kind  = kBody || kUrl;

      function onLoad(){
        try{
          var low = String(url).toLowerCase();
          var isInteresting = (kind === "music" || kind === "cover" || kind === "video" || low.indexOf("/api/jobs/create") !== -1);
          if (!isInteresting) return;

          var text = "";
          try { text = xhr.responseText || ""; } catch(e){}
          var data = safeParse(text, null);
          var jobId = data && (data.job_id || data.id || (data.job && (data.job.job_id || data.job.id)));

          var finalKind = kind;
          if (finalKind === "job") finalKind = kBody || kindFromObject(data) || kindFromUrl(url);

          if (finalKind === "music" || finalKind === "cover" || finalKind === "video") inc(finalKind, jobId || null);
        } catch(e){}
      }

      xhr.addEventListener("load", onLoad);
      return send.apply(this, arguments);
    };
  }

  // ---- boot ----
  function boot(){
    persist();
    paint();

    hookFetch();
    hookXHR();

    // store geç dolabiliyor; total/spent için yumuşak polling
    if (!window.__AIVO_STATS_POLL_V3__) {
      window.__AIVO_STATS_POLL_V3__ = true;
      setInterval(paint, 1200);
    }

    window.addEventListener("beforeunload", function(){ try { persist(); } catch(e){} });

    console.log("[PROFILE_STATS_V3] loaded", {
      music:stats.music, cover:stats.cover, video:stats.video,
      spent:stats.spent, total:stats.total, lastCredits:stats.lastCredits
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

/* =========================================================
   STUDIO — OPEN PRICING VIA URL (SINGLE BLOCK / FINAL)
   Supports:
     /studio.html?open=pricing
     /studio.html?open=pricing&pack=standard
   Goal: Open the SAME pricing modal behavior as Studio's "Kredi Al"
   ========================================================= */
(function studioOpenPricingViaUrl_FINAL(){
  "use strict";
   if (true) return; // ✅ Studio'da pricing modal yok (tek commerce hub: /fiyatlandirma)


  // Hard-skip: aynı dosya 2 kez yüklenirse tekrar çalışmasın
  if (window.__AIVO_OPEN_PRICING_URL_BRIDGE__) return;
  window.__AIVO_OPEN_PRICING_URL_BRIDGE__ = true;

  function getQuery(){
    try { return new URL(window.location.href).searchParams; }
    catch(e){ return new URLSearchParams(window.location.search || ""); }
  }

  function normalizePack(p){
    p = (p || "").toString().trim().toLowerCase();
    if (!p) return "";
    // küçük normalize (istersen çoğaltırız)
    if (p === "standart") return "standard";
    if (p === "pro") return "pro";
    if (p === "mega") return "mega";
    if (p === "baslangic") return "starter";
    return p;
  }

  function lockScroll(){
    // Studio’daki “tam görünüm” farkını kapatan garanti lock
    document.documentElement.classList.add("modal-open");
    document.body.classList.add("modal-open");
    // bazı projelerde kullanılan alternatif lock
    document.body.classList.add("no-scroll");
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  }

  function tryCallRealOpen(pack){
    // 1) En ideal: senin kendi global fonksiyonun (varsa)
    if (typeof window.openPricingModal === "function") {
      window.openPricingModal({ pack });
      return true;
    }
    // 2) Bazı yapılarda AIVO namespace olur
    if (window.AIVO && typeof window.AIVO.openPricing === "function") {
      window.AIVO.openPricing({ pack });
      return true;
    }
    // 3) Başka olası isimler
    if (typeof window.openPricing === "function") {
      window.openPricing({ pack });
      return true;
    }
    return false;
  }

  function tryTriggerClick(){
    // Fallback: modalı açan buton/CTA tetikle
    const trigger = document.querySelector(
      '[data-action="open-pricing"], [data-open-pricing], #btnOpenPricing, #btnBuyCredits, .btn-credit-buy'
    );
    if (!trigger) return false;
    trigger.click();
    return true;
  }

  function openNow(){
    const qs = getQuery();
    const open = (qs.get("open") || "").toLowerCase();
    if (open !== "pricing") return;

    const pack = normalizePack(qs.get("pack") || "");

    // pack varsa sakla (modal açılınca okunabilir)
    if (pack) {
      try { sessionStorage.setItem("aivo_preselect_pack", pack); } catch(e){}
    }

    // Önce gerçek fonksiyon
    if (tryCallRealOpen(pack)) {
      lockScroll();
      return;
    }

    // Fonksiyon yoksa click fallback
    if (tryTriggerClick()) {
      lockScroll();
      return;
    }

    // Hiçbiri yoksa debug (kırmadan)
    console.warn("[AIVO] open=pricing: trigger/function not found. Add a trigger with [data-open-pricing] or expose window.openPricingModal().");
  }

  function boot(){
    try { openNow(); } catch (e) {
      console.warn("[AIVO] open=pricing bridge failed", e);
    }
  }

  // DOM hazır olunca
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once:true });
  } else {
    boot();
  }
})();
/* =========================================================
   AIVO — STUDIO BUY ROUTER (FINAL / REVIZED)
   Studio içinde pricing modal açma yok.
   Tüm "Kredi Al / Plan Yükselt" tetikleri -> /fiyatlandirma.html#packs
   (Opsiyonel: data-pack="standard" -> /fiyatlandirma.html?pack=standard#packs)
   ========================================================= */
(function AIVO_StudioBuyRouter_FINAL(){
  "use strict";

  if (window.__AIVO_STUDIO_BUY_ROUTER__) return;
  window.__AIVO_STUDIO_BUY_ROUTER__ = true;

  var BASE = "/fiyatlandirma.html";

  function buildTarget(pack){
    pack = (pack || "").toString().trim();
    if (pack) return BASE + "?pack=" + encodeURIComponent(pack) + "#packs";
    return BASE + "#packs";
  }

  function getPackFromEl(el){
    if (!el) return "";
    // data-pack="standard"
    if (el.getAttribute) {
      var p = el.getAttribute("data-pack");
      if (p) return p;
    }
    // dataset.pack
    try { if (el.dataset && el.dataset.pack) return el.dataset.pack; } catch(_) {}
    return "";
  }

  function go(e, pack){
    try { if (e) e.preventDefault(); } catch(_) {}
    try { if (e) e.stopPropagation(); } catch(_) {}
    try { window.location.href = buildTarget(pack); } catch(_) {}
  }

  document.addEventListener("click", function(e){
    try{
      if (!e || !e.target) return;
      var t = e.target;

      // 1) data-open-pricing (özellikle dış sayfalarda data-open-pricing="1" vardı)
      var a = t.closest ? t.closest("[data-open-pricing]") : null;
      if (a) {
        // Studio tarafında da attribute var; kontrollü yakala:
        // - data-open-pricing="1" veya boş attribute kabul
        var v = "";
        try { v = (a.getAttribute && a.getAttribute("data-open-pricing")) || ""; } catch(_) {}
        if (v === "" || v === "1" || v === true) {
          return go(e, getPackFromEl(a));
        }
      }

      // 2) Studio içi kredi CTA’ları (varsa)
      var b = t.closest ? t.closest(".btn-credit-buy, #creditsButton, #btnBuyCredits, #btnOpenPricing") : null;
      if (b) return go(e, getPackFromEl(b));

    } catch(err){
      console.warn("[AIVO] studio buy router error:", err);
    }
  }, true);

})();
// ===== LIBRARY: filters + search (event delegation) =====
(function () {
  const root = document.querySelector('.page-library');
  if (!root) return;

  const toolbar = root.querySelector('.library-toolbar');
  const chips = () => Array.from(root.querySelectorAll('.filter-chip'));
  const search = root.querySelector('.library-search');
  const cardsWrap = root.querySelector('.library-cards');

  function setActiveChip(btn) {
    chips().forEach(b => b.classList.toggle('is-active', b === btn));
  }

  function getActiveFilter() {
    const active = root.querySelector('.filter-chip.is-active');
    if (!active) return 'all';
    const t = (active.textContent || '').trim().toLowerCase();
    if (t.includes('müzik')) return 'music';
    if (t.includes('video')) return 'video';
    if (t.includes('kapak')) return 'cover';
    return 'all';
  }

  function applyFilter() {
    const q = (search?.value || '').trim().toLowerCase();
    const kind = getActiveFilter();

    const cards = Array.from(root.querySelectorAll('.prod-card'));
    if (!cards.length) return; // empty-state varken sorun yok

    cards.forEach(card => {
      const k = (card.getAttribute('data-kind') || '').toLowerCase();
      const title = (card.getAttribute('data-title') || card.textContent || '').toLowerCase();

      const okKind = (kind === 'all') ? true : (k === kind);
      const okSearch = q ? title.includes(q) : true;

      card.style.display = (okKind && okSearch) ? '' : 'none';
    });
  }

  // Chip click
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.page-library .filter-chip');
    if (!btn) return;
    e.preventDefault();
    setActiveChip(btn);
    applyFilter();
  }, true);

  // Search input
  if (search) {
    search.addEventListener('input', applyFilter);
  }
})();
/* =========================
   LOGIN RETURN — after login redirect
   ========================= */

(function handleReturnAfterLogin() {
  try {
    // Eğer login modalı query ile açılıyorsa (open=login), bu akış login sonrası da çalışacak.
    // Not: İstersen bu kontrolü kaldırabilirsin; zarar vermez.
    var u = null;
    try { u = localStorage.getItem("aivo_return_after_login"); } catch (_) {}

    if (!u) return;

    // Güvenlik: sadece aynı origin içi relative yolları kabul et
    if (typeof u !== "string") return;
    if (/^https?:\/\//i.test(u)) return;

    // Kullanıcı gerçekten login oldu mu?
    // Bizde net bir flag olmayabilir; ama pratik kontrol: aivo_user / token / vb. varsa
    // Bu kısmı senin mevcut auth yapına göre güçlendireceğiz.
    var looksLoggedIn = false;
    try {
      // 1) UI tarafında bir user flag varsa
      if (window.aivoUser || window.currentUser) looksLoggedIn = true;

      // 2) localStorage'da user kaydı varsa (yaygın pattern)
      var lsUser = localStorage.getItem("aivo_user") || localStorage.getItem("user") || "";
      if (lsUser && lsUser.length > 5) looksLoggedIn = true;

      // 3) Cookie tabanlı ise burada kesin bilemeyiz; yine de "login modundan çıkınca" çalışması yeterli
    } catch (_) {}

    // Eğer kesin login tespitin yoksa bile, login akışı tamamlanınca genelde sayfa reload olur.
    // Bu yüzden: open=login parametresi yoksa ve UI'da login gibi görünüyorsa dön.
    try {
      var qs = String(location.search || "");
      var isOnLoginOpen = qs.indexOf("open=login") !== -1;
      if (isOnLoginOpen && !looksLoggedIn) return;
    } catch (_) {}

    // one-shot
    try { localStorage.removeItem("aivo_return_after_login"); } catch (_) {}
    // Geri dön
    location.href = u;
  } catch (_) {}
})(); // handleReturnAfterLogin IIFE kapanışı
// ===============================
// ATMOSPHERE UI (Basit/Süper Mod + Sahne + Atmosfer max2)
// HTML ile %100 uyumlu REVİZE BLOK
// - Sahne: #atmScenes içindeki .smpack-choice (data-atm-scene)
// - Efekt: #atmEffects içindeki .smpack-pill (data-atm-eff)  (max 2)
// - Uyarı: #atmWarn (senin HTML’de var)
// - (Opsiyonel) İpucu: #atmHint (yoksa patlamaz)
// ===============================
(function initAtmosphereUI() {
  if (window.__AIVO_ATM_UI__) return;
  window.__AIVO_ATM_UI__ = true;

  const MAX_EFF = 2;

  const state = {
    mode: "basic",              // basic | pro
    scenePreset: "winter_cafe",
    sceneImageFile: null,
    effects: [],                // ["snow", "light"]
    camera: "kenburns_soft",
    duration: 8,
    logoFile: null,
    logoPos: "br",
    logoSize: "sm",
    logoOpacity: 0.9,
    audioFile: null,
    audioMode: "none",
    audioTrim: "loop_to_fit",
    exportSilentCopy: true
  };

  const invalidPairs = new Set([
    "snow|rain", "rain|snow",
    "fire|rain", "rain|fire",
    "candle|rain", "rain|candle"
  ]);

  function $(id) { return document.getElementById(id); }

  function getAtmosphereRoot() {
    // Sadece Atmosfer sayfası açıkken çalışsın (SPA)
    const page = document.querySelector('.page[data-page="atmosphere"]');
    if (!page) return null;
    // bazı sistemlerde aktif class/body dataset ile kontrol ediliyor olabilir
    // yine de element varsa bağlayalım; event delegation güvenli.
    return page;
  }

  function showWarn(warnEl, msg) {
    if (!warnEl) return;
    warnEl.style.display = msg ? "block" : "none";
    warnEl.textContent = msg || "";
  }

  function setHint(hintEl, msg) {
    if (!hintEl) return;
    hintEl.textContent = msg || "";
  }

  function normalizePair(a, b) { return `${a}|${b}`; }

  function canAddEffect(next) {
    if (state.effects.includes(next)) return true;         // toggle off için izin
    if (state.effects.length >= MAX_EFF) return false;
    if (state.effects.length === 1) {
      const pair = normalizePair(state.effects[0], next);
      if (invalidPairs.has(pair)) return false;
    }
    return true;
  }

  function updateEffectsUI(effectsEl, warnEl, hintEl) {
    if (!effectsEl) return;

    const buttons = effectsEl.querySelectorAll('[data-atm-eff]');
    buttons.forEach((btn) => {
      const eff = btn.getAttribute("data-atm-eff");
      const isActive = state.effects.includes(eff);

      btn.classList.toggle("is-active", isActive);

      // disable logic
      if (!isActive && state.effects.length >= MAX_EFF) {
        btn.classList.add("is-disabled");
        btn.disabled = true;
        return;
      }

      if (!isActive && state.effects.length === 1) {
        const pair = normalizePair(state.effects[0], eff);
        if (invalidPairs.has(pair)) {
          btn.classList.add("is-disabled");
          btn.disabled = true;
          return;
        }
      }

      btn.classList.remove("is-disabled");
      btn.disabled = false;
    });

    // hint/warn
    if (state.effects.length === 0) {
      setHint(hintEl, "İpucu: Kar + Işık / Yağmur + Işık çok iyi.");
      showWarn(warnEl, "");
    } else if (state.effects.length === 1) {
      setHint(hintEl, "İstersen bir atmosfer daha ekleyebilirsin (max 2).");
      showWarn(warnEl, "");
    } else {
      setHint(hintEl, "Hazır. Üretebilirsin.");
      showWarn(warnEl, "");
    }
  }

  function updateSceneUI(scenesEl) {
    if (!scenesEl) return;
    scenesEl.querySelectorAll('[data-atm-scene]').forEach((b) => {
      const v = b.getAttribute("data-atm-scene");
      b.classList.toggle("is-active", v === state.scenePreset && !state.sceneImageFile);
    });
  }

  function applyModeUI(root) {
    const tabs = root.querySelectorAll(".mode-tab[data-mode]");
    const panels = root.querySelectorAll(".mode-panel[data-mode-panel]");

    tabs.forEach((t) => t.classList.toggle("is-active", t.getAttribute("data-mode") === state.mode));
    panels.forEach((p) => p.classList.toggle("is-active", p.getAttribute("data-mode-panel") === state.mode));
  }

  function bindOnce() {
    const root = getAtmosphereRoot();
    if (!root) return;

    // Aynı sayfaya tekrar girilince tekrar bind etmesin
    if (root.__ATM_BOUND__) return;
    root.__ATM_BOUND__ = true;

    // Elements (Atmosfer sayfası scope’unda arıyoruz)
    const scenesEl = root.querySelector("#atmScenes");
    const effectsEl = root.querySelector("#atmEffects");
    const warnEl = root.querySelector("#atmWarn");
    const hintEl = root.querySelector("#atmHint"); // opsiyonel yoksa sorun değil

    // Initial UI
    updateSceneUI(scenesEl);
    updateEffectsUI(effectsEl, warnEl, hintEl);
    applyModeUI(root);

    // ===== Mode Switch =====
    const modeSwitch = root.querySelector(".mode-switch");
    if (modeSwitch) {
      modeSwitch.addEventListener("click", (e) => {
        const tab = e.target.closest(".mode-tab[data-mode]");
        if (!tab) return;
        const mode = tab.getAttribute("data-mode");
        if (mode !== "basic" && mode !== "pro") return;

        state.mode = mode;
        applyModeUI(root);
      });
    }

    // ===== Scene preset click =====
    if (scenesEl) {
      scenesEl.addEventListener("click", (e) => {
        const btn = e.target.closest('[data-atm-scene]');
        if (!btn) return;

        // önce hepsinden active kaldır, sonra tıklanana ekle (senin sorduğun kısım)
        scenesEl.querySelectorAll('[data-atm-scene]').forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");

        state.scenePreset = btn.getAttribute("data-atm-scene");
        state.sceneImageFile = null; // preset seçilince upload override kalksın
      });
    }

    // ===== Scene image upload =====
    const imageFile = root.querySelector("#atmImageFile");
    if (imageFile) {
      imageFile.addEventListener("change", (e) => {
        const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
        state.sceneImageFile = f;

        // görsel yüklenince preset seçimini görsel olarak pasifle
        if (f && scenesEl) {
          scenesEl.querySelectorAll('[data-atm-scene]').forEach((b) => b.classList.remove("is-active"));
        } else {
          updateSceneUI(scenesEl);
        }
      });
    }

    // ===== Effects (max 2) =====
    if (effectsEl) {
      effectsEl.addEventListener("click", (e) => {
        const btn = e.target.closest('[data-atm-eff]');
        if (!btn) return;

        const eff = btn.getAttribute("data-atm-eff");

        // toggle off
        if (state.effects.includes(eff)) {
          state.effects = state.effects.filter((x) => x !== eff);
          showWarn(warnEl, "");
          updateEffectsUI(effectsEl, warnEl, hintEl);
          return;
        }

        // add
        if (!canAddEffect(eff)) {
          if (state.effects.length >= MAX_EFF) {
            showWarn(warnEl, "En fazla 2 atmosfer seçebilirsin.");
          } else if (state.effects.length === 1) {
            showWarn(warnEl, "Bu kombinasyon desteklenmiyor. (Örn: Kar+Yağmur, Ateş+Yağmur)");
          }
          return;
        }

        state.effects = [...state.effects, eff];
        showWarn(warnEl, "");
        updateEffectsUI(effectsEl, warnEl, hintEl);
      });
    }

    // ===== Camera / Duration =====
    const cam = root.querySelector("#atmCamera");
    if (cam) cam.addEventListener("change", (e) => (state.camera = e.target.value));

    const dur = root.querySelector("#atmDuration");
    if (dur) dur.addEventListener("change", (e) => (state.duration = Number(e.target.value)));

    // ===== Logo =====
    const logoFile = root.querySelector("#atmLogoFile");
    if (logoFile) logoFile.addEventListener("change", (e) => (state.logoFile = e.target.files?.[0] || null));

    const logoPos = root.querySelector("#atmLogoPos");
    if (logoPos) logoPos.addEventListener("change", (e) => (state.logoPos = e.target.value));

    const logoSize = root.querySelector("#atmLogoSize");
    if (logoSize) logoSize.addEventListener("change", (e) => (state.logoSize = e.target.value));

    const logoOpacity = root.querySelector("#atmLogoOpacity");
    if (logoOpacity) logoOpacity.addEventListener("input", (e) => (state.logoOpacity = Number(e.target.value)));

    // ===== Audio =====
    const audioFile = root.querySelector("#atmAudioFile");
    if (audioFile) audioFile.addEventListener("change", (e) => (state.audioFile = e.target.files?.[0] || null));

    const audioMode = root.querySelector("#atmAudioMode");
    if (audioMode) audioMode.addEventListener("change", (e) => (state.audioMode = e.target.value));

    const audioTrim = root.querySelector("#atmAudioTrim");
    if (audioTrim) audioTrim.addEventListener("change", (e) => (state.audioTrim = e.target.value));

    const silentCopy = root.querySelector("#atmSilentCopy");
    if (silentCopy) silentCopy.addEventListener("change", (e) => (state.exportSilentCopy = !!e.target.checked));

   // ===== CTA =====
const btnGen = root.querySelector("#atmGenerateBtn");
if (btnGen) {
  btnGen.addEventListener("click", () => {
    if (state.effects.length === 0) {
      showWarn(warnEl, "En az 1 atmosfer seçmelisin.");
      return;
    }
    console.log("[ATM] submit state:", state);
    // TOAST KALDIRILDI (mock kuyruğa eklendi)
  });
}

console.log("[ATM] UI ready (revised)");
}


  // DOM hazır olunca bağla + SPA gecikmesi için kısa polling (tek seferlik güvenli)
  function boot() {
    bindOnce();
    let tries = 0;
    const t = setInterval(() => {
      bindOnce();
      tries++;
      if (tries > 40) clearInterval(t); // ~4sn
    }, 100);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

// ==============================
// ATMOSFER MODE SWITCH (Basic / Pro)
// ==============================
(function () {
  const tabs = document.querySelectorAll('.mode-tab');
  const panels = document.querySelectorAll('.mode-panel');

  if (!tabs.length || !panels.length) return;

  function setMode(mode) {
    tabs.forEach(t =>
      t.classList.toggle('is-active', t.dataset.mode === mode)
    );
    panels.forEach(p =>
      p.classList.toggle('is-active', p.dataset.modePanel === mode)
    );
  }

  tabs.forEach(t =>
    t.addEventListener('click', () => setMode(t.dataset.mode))
  );

  // varsayılan
  setMode('basic');
})();

/* =========================
   ATM EFFECTS — SAFE FIX
   (no prototype patch)
   ========================= */
(function () {
  "use strict";

  const MAX = 2;
  const STATE_KEY = "__ATM_STATE__";

  function getState() {
    const s = (window[STATE_KEY] = window[STATE_KEY] || {});
    if (!Array.isArray(s.effects)) s.effects = [];
    return s;
  }

  function findWrap() {
    const page = document.querySelector('[data-page="atmosphere"]') || document;
    return page.querySelector("#atmEffects");
  }

  function allBtns(wrap) {
    return Array.from(wrap.querySelectorAll('[data-atm-eff]'));
  }

  function render(wrap) {
    const st = getState();
    const selected = new Set(st.effects);
    const full = st.effects.length >= MAX;

    allBtns(wrap).forEach((btn) => {
      const key = btn.getAttribute("data-atm-eff");
      const active = selected.has(key);

      // UI
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");

      // Rule: max doluysa sadece seçili olmayanlar disable
      const shouldDisable = full && !active;
      btn.disabled = shouldDisable;
      btn.toggleAttribute("disabled", shouldDisable);
      btn.classList.toggle("is-disabled", shouldDisable);

      // Safari / CSS çakışmalarına karşı:
      btn.style.pointerEvents = shouldDisable ? "none" : "auto";
    });
  }

  function toggle(wrap, key) {
    const st = getState();
    const i = st.effects.indexOf(key);
    if (i >= 0) st.effects.splice(i, 1);
    else {
      if (st.effects.length >= MAX) return;
      st.effects.push(key);
    }
    render(wrap);
  }

  function bind() {
    const wrap = findWrap();
    if (!wrap) return false;
    if (wrap.dataset.atmBound === "1") return true;
    wrap.dataset.atmBound = "1";

    // ilk render
    render(wrap);

    // ✅ CLICK YEMEYE KARŞI: pointerdown capture + stopPropagation
    wrap.addEventListener(
      "pointerdown",
      (e) => {
        const btn = e.target && e.target.closest ? e.target.closest('[data-atm-eff]') : null;
        if (!btn) return;

        // BUTON disabled ise (max dolu) zaten tıklanmasın
        if (btn.disabled || btn.hasAttribute("disabled")) return;

        e.preventDefault();
        e.stopPropagation();

        toggle(wrap, btn.getAttribute("data-atm-eff"));
      },
      true
    );

    return true;
  }

  function boot() {
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (bind() || tries > 50) clearInterval(t);
    }, 100);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

// ✅ MUSIC WORKMODE TOGGLE — HARD BIND (single authority)
(function bindMusicWorkModeOnce(){
  if (window.__AIVO_MUSIC_MODE_BOUND__) return;
  window.__AIVO_MUSIC_MODE_BOUND__ = true;

  function apply(mode){
    const m = (mode === "basic") ? "basic" : "advanced";
    document.body.dataset.mode = m;

    const btnBasic = document.querySelector('.mode-btn[data-mode-button="basic"]');
    const btnAdv   = document.querySelector('.mode-btn[data-mode-button="advanced"]');

    btnBasic?.classList.toggle("is-active", m === "basic");
    btnAdv?.classList.toggle("is-active", m === "advanced");
  }

  // ilk açılış: body’de ne varsa onu UI’a uygula (yoksa advanced varsay)
  apply(document.body.dataset.mode || "advanced");

  document.addEventListener("click", (e) => {
    const btn = e.target?.closest?.(".mode-btn[data-mode-button]");
    if (!btn) return;

    // (opsiyonel) sadece Müzik (Geleneksel) sayfasında çalışsın:
    // const onMusic = document.querySelector('.page.is-active[data-page="music-traditional"]');
    // if (!onMusic) return;

    e.preventDefault();
    e.stopPropagation();

    apply(btn.getAttribute("data-mode-button"));
  }, true);
})();


// COVER — minimal binding (layout-safe)
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('#coverGenerateBtn, [data-generate="cover"]');
  if (!btn) return;

  e.preventDefault();

  // prompt (sadece kapak panelinin içinden al)
  const root = btn.closest('.cover-main') || document;
  const promptEl =
    root.querySelector('#coverPrompt') ||
    root.querySelector('[name="coverPrompt"]') ||
    root.querySelector('textarea');

 const prompt = (promptEl?.value || '').trim();
if (!prompt) {
  return; // legacy cover toast disabled
}


  try {
    btn.disabled = true;

// 🔥 KREDİ DÜŞ (SADECE BU SATIR)
const ok = await window.consumeCoverCredits(6);
if (!ok) {
  window.toast?.error?.("Kredi üretimi başlatılamadı.");
  return;
}

// 🔥 TEK AKIŞ — job başlatma
const res = await window.AIVO_APP.generateCover({
  prompt
});

if (!res || res.ok !== true) {
  // toast kapatıldı (legacy duplicate)
  return;
}

} catch (err) {
  console.error(err);
  // toast kapatıldı (legacy duplicate)
} finally {
  btn.disabled = false;
}
}, true);



  // =========================================================
// APP-LAYER: MUSIC GENERATE (TEK OTORİTE)
// - Prompt boşsa: toast uyarı
// - /api/credits/consume ile kredi düşür
// - Başladı + kredi düştü toast
// - Sonra var olan music flow’u tetikle (varsa)
// =========================================================
(function AIVO_APP_MUSIC_GENERATE_SINGLE_AUTH() {
  if (window.__AIVO_APP_MUSIC_WIRED__) return;
  window.__AIVO_APP_MUSIC_WIRED__ = true;

  const MUSIC_COST = 5; // istediğin maliyet buysa kalsın (değilse burada değiştir)

  function tError(msg) {
    (window.toast && window.toast.error) ? window.toast.error(msg) : console.warn("[toast.error]", msg);
  }
  function tOk(msg) {
    (window.toast && window.toast.success) ? window.toast.success(msg) : console.log("[toast.success]", msg);
  }

  function getPromptValue() {
    const el =
      document.querySelector("#musicPrompt") ||
      document.querySelector("textarea[name='prompt']") ||
      document.querySelector("input[name='prompt']") ||
      document.querySelector("textarea") ||
      document.querySelector("input[type='text']");
    return (el && (el.value || "").trim()) || "";
  }

  function setTopCreditsUI(nextCredits) {
    // farklı sayfalarda farklı id olabiliyor; güvenli güncelleme
    const nodes = [
      document.querySelector("#topCreditCount"),
      document.querySelector("#topCreditsCount"),
      document.querySelector("[data-credit-count]"),
      document.querySelector("[data-credits]"),
    ].filter(Boolean);

    nodes.forEach(n => {
      if ("value" in n) n.value = String(nextCredits);
      else n.textContent = String(nextCredits);
    });
  }

  async function consumeCredits(cost, meta) {
    // Backend tek otorite
    const res = await fetch("/api/credits/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        cost: Number(cost) || 0,
        reason: "studio_music_generate",
        meta: meta || {}
      })
    });

    let data = null;
    try { data = await res.json(); } catch (_) {}

    if (!res.ok) {
      // yetersiz kredi / auth / vs.
      return { ok: false, status: res.status, data };
    }

    // data.credits veya data.remainingCredits gibi alanlar olabilir
    const credits =
      (data && (data.credits ?? data.remainingCredits ?? data.balance)) ??
      null;

    return { ok: true, status: res.status, data, credits };
  }

  document.addEventListener("click", async function (e) {
    const btn = e.target && e.target.closest ? e.target.closest("#musicGenerateBtn") : null;
    if (!btn) return;

    // TEK otorite: zinciri burada kilitle
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    // 1) Prompt kontrol
    const prompt = getPromptValue();
    if (!prompt) {
      tError("Prompt yazman gerekiyor.");
      return;
    }

    // 2) Kredi düş
    btn.disabled = true;
    btn.dataset.loading = "1";

    const r = await consumeCredits(MUSIC_COST, { promptLen: prompt.length });

    if (!r.ok) {
      btn.disabled = false;
      btn.dataset.loading = "0";

      // Yetersiz kredi ise yönlendir
      tError("Yetersiz kredi. Kredi satın alman gerekiyor.");
      const to = encodeURIComponent(location.pathname + location.search + location.hash);
      location.href = "/fiyatlandirma.html?from=studio&reason=insufficient_credit&to=" + to;
      return;
    }

    // 3) UI kredi güncelle + toast
    if (typeof r.credits === "number") setTopCreditsUI(r.credits);
    tOk(`Üretim başladı. ${MUSIC_COST} kredi düşüldü.`);
    // 3.5) Sol panele "müzik job" ekle (PLAYER BURADAN ÇIKIYOR)
if (window.AIVO_JOBS && typeof window.AIVO_JOBS.add === "function") {
  const jobId = "music_" + Date.now();

  window.AIVO_JOBS.add({
    job_id: jobId,
    type: "music",
    title: "Yeni Müzik",
    status: "queued",
    createdAt: Date.now(),
    meta: {
      prompt: prompt
    }
  });
}


    // 4) Var olan müzik akışını tetikle (senin sistemine göre)
    try {
      // Öncelik: senin yeni app-layer fonksiyonun varsa
      if (window.AIVO_APP && typeof window.AIVO_APP.generateMusic === "function") {
        await window.AIVO_APP.generateMusic({ buttonEl: btn, prompt, mode: "instrumental", durationSec: 30 });
      }
      // Alternatif: mevcut global flow varsa
      else if (typeof window.AIVO_RUN_MUSIC_FLOW === "function") {
        window.AIVO_RUN_MUSIC_FLOW(btn, prompt);
      }
      // Son çare: sadece log
      else {
        console.log("[MUSIC] generate flow yok, sadece kredi tüketildi.", { prompt });
      }
    } catch (err) {
      console.error("[MUSIC] generate error:", err);
      tError("Müzik üretimi başlatılamadı.");
    } finally {
      btn.disabled = false;
      btn.dataset.loading = "0";
    }
  }, true);
})();

// =========================================================
// APP-LAYER: VIDEO GENERATE (TEK OTORİTE)
// - Text: prompt zorunlu
// - Image: image zorunlu (prompt opsiyonel)
// - audioEnabled ON => 14 kredi, OFF => 10 kredi
// - /api/credits/consume ile kredi düşür
// - Başladı + kredi düştü toast
// - Sonra var olan video flow’u tetikle (varsa)
// =========================================================
(function AIVO_APP_VIDEO_GENERATE_SINGLE_AUTH() {
  if (window.__AIVO_APP_VIDEO_WIRED__) return;
  window.__AIVO_APP_VIDEO_WIRED__ = true;

  const COST_WITH_AUDIO = 14;
  const COST_NO_AUDIO = 10;

  function tError(msg) {
    (window.toast && window.toast.error) ? window.toast.error(msg) : console.warn("[toast.error]", msg);
  }
  function tOk(msg) {
    (window.toast && window.toast.success) ? window.toast.success(msg) : console.log("[toast.success]", msg);
  }

  function getAudioEnabled() {
    const el = document.querySelector("#audioEnabled");
    return !!(el && el.checked);
  }

  function getVideoCost() {
    return getAudioEnabled() ? COST_WITH_AUDIO : COST_NO_AUDIO;
  }

  function setTopCreditsUI(nextCredits) {
    const nodes = [
      document.querySelector("#topCreditCount"),
      document.querySelector("#topCreditsCount"),
      document.querySelector("[data-credit-count]"),
      document.querySelector("[data-credits]"),
    ].filter(Boolean);

    nodes.forEach(n => {
      if ("value" in n) n.value = String(nextCredits);
      else n.textContent = String(nextCredits);
    });
  }

  async function consumeCredits(cost, meta) {
    const res = await fetch("/api/credits/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        cost: Number(cost) || 0,
        reason: "studio_video_generate",
        meta: meta || {}
      })
    });

    let data = null;
    try { data = await res.json(); } catch (_) {}

    if (!res.ok) return { ok: false, status: res.status, data };

    const credits =
      (data && (data.credits ?? data.remainingCredits ?? data.balance)) ??
      null;

    return { ok: true, status: res.status, data, credits };
  }

  function updateVideoCostUI() {
    const cost = getVideoCost();

    // badge'ler (şu an ikisi de "10 Kredi" yazıyor, toggle’a göre güncelle)
    document.querySelectorAll(".video-view .badge-beta").forEach(b => {
      b.textContent = `${cost} Kredi`;
    });

    // buton metinleri + data-credit-cost
    const btns = [
      document.querySelector("#videoGenerateTextBtn"),
      document.querySelector("#videoGenerateImageBtn"),
    ].filter(Boolean);

    btns.forEach(btn => {
      btn.dataset.creditCost = String(cost);
      // ikonlar farklı: 🎬 / 🎞 - text'i bozmayalım, sadece parantezi güncelleyelim
      const raw = btn.textContent || "";
      const left = raw.replace(/\(\s*\d+\s*Kredi\s*\)/i, "").trim();
      btn.textContent = `${left} (${cost} Kredi)`;
    });
  }

  // Toggle değişince UI kredi etiketleri güncellensin
  document.addEventListener("change", function(e) {
    if (e.target && e.target.id === "audioEnabled") updateVideoCostUI();
  }, true);

  // İlk açılışta da sync
  updateVideoCostUI();

  async function handleGenerate(mode, btn) {
    const cost = getVideoCost();

    // 1) Validasyon
    let prompt = "";
    let imageFile = null;

    if (mode === "text") {
      prompt = (document.querySelector("#videoPrompt")?.value || "").trim();
      if (!prompt) {
        tError("Önce prompt yazman gerekiyor.");
        return;
      }
    } else {
      // image mode
      const input = document.querySelector("#videoImageInput");
      imageFile = input && input.files && input.files[0] ? input.files[0] : null;
      if (!imageFile) {
        tError("Önce bir resim yüklemen gerekiyor.");
        return;
      }
      prompt = (document.querySelector("#videoImagePrompt")?.value || "").trim(); // opsiyonel
    }

    // 2) Kredi düş
    btn.disabled = true;
    btn.dataset.loading = "1";

    const r = await consumeCredits(cost, {
      mode,
      audioEnabled: getAudioEnabled(),
      promptLen: (prompt || "").length,
      hasImage: !!imageFile,
      duration: document.querySelector("#videoDuration")?.value,
      resolution: document.querySelector("#videoResolution")?.value,
      ratio: document.querySelector("#videoRatio")?.value,
    });

    if (!r.ok) {
      btn.disabled = false;
      btn.dataset.loading = "0";

      // basit MVP: her başarısızlıkta pricing (müzikle aynı davranış)
      tError("Yetersiz kredi. Kredi satın alman gerekiyor.");
      const to = encodeURIComponent(location.pathname + location.search + location.hash);
      location.href = "/fiyatlandirma.html?from=studio&reason=insufficient_credit&to=" + to;
      return;
    }

    // 3) UI kredi + toast
    if (typeof r.credits === "number") setTopCreditsUI(r.credits);
    tOk(`Üretim başladı. ${cost} kredi düşüldü.`);
     window.AIVO_PUSH_VIDEO_PLACEHOLDER?.({ id: "video-" + Date.now() });


    // 4) Var olan video flow’u tetikle
    try {
      if (window.AIVO_APP && typeof window.AIVO_APP.generateVideo === "function") {
        await window.AIVO_APP.generateVideo({
          buttonEl: btn,
          mode,
          prompt,
          imageFile, // image modda dolu, text modda null
          audioEnabled: getAudioEnabled(),
          durationSec: Number(document.querySelector("#videoDuration")?.value || 8),
          resolution: String(document.querySelector("#videoResolution")?.value || "720"),
          ratio: String(document.querySelector("#videoRatio")?.value || "16:9"),
        });
         // ✅ MP4 hazırsa sağ panel kartını güncelle
const mp4Url = window.AIVO_EXTRACT_MP4_URL(data);

if (mp4Url) {
  window.AIVO_OUTPUT_VIDEOS = (window.AIVO_OUTPUT_VIDEOS || []).map(v =>
    v.badge === "Sırada"
      ? {
          ...v,
          src: mp4Url,
          badge: "Hazır",
          title: "Video"
        }
      : v
  );

  try {
    localStorage.setItem(
      "AIVO_OUTPUT_VIDEOS_V1",
      JSON.stringify(window.AIVO_OUTPUT_VIDEOS)
    );
  } catch (_) {}

  if (typeof window.AIVO_RENDER_MINI_VIDEOS === "function") {
    window.AIVO_RENDER_MINI_VIDEOS();
  }

  window.toast?.success?.("Video hazır");
}
      // ❌ (SİLİNDİ) UI'ye "Sırada" kartı basan legacy video queue
      // window.AIVO_OUTPUT_VIDEOS = window.AIVO_OUTPUT_VIDEOS || [];
      // window.AIVO_OUTPUT_VIDEOS.unshift({ title: "Yeni Video", src: "", badge: "Sırada" });
      // window.AIVO_RENDER_MINI_VIDEOS && window.AIVO_RENDER_MINI_VIDEOS();
      //
      // try {
      //   localStorage.setItem(
      //     "AIVO_OUTPUT_VIDEOS_V1",
      //     JSON.stringify(window.AIVO_OUTPUT_VIDEOS.slice(0, 50))
      //   );
      // } catch(_) {}

      } else if (typeof window.AIVO_RUN_VIDEO_FLOW === "function") {
        window.AIVO_RUN_VIDEO_FLOW(btn, { mode, prompt, imageFile });
      } else {
        console.log(
          "[VIDEO] generate flow yok, sadece kredi tüketildi.",
          { mode, cost, promptLen: (prompt || "").length, hasImage: !!imageFile }
        );
      }
    } catch (err) {
      console.error("[VIDEO] generate error:", err);
      tError("Video üretimi başlatılamadı.");
    } finally {
      btn.disabled = false;
      btn.dataset.loading = "0";
    }
  }

  document.addEventListener("click", function(e) {
    const textBtn = e.target?.closest?.("#videoGenerateTextBtn");
    const imgBtn  = e.target?.closest?.("#videoGenerateImageBtn");
    const btn = textBtn || imgBtn;
    if (!btn) return;

    // müzikteki gibi tek otorite
    e.preventDefault();
    e.stopPropagation();

    const mode = textBtn ? "text" : "image";
    handleGenerate(mode, btn);
  }, true);

})();

/* =========================================================
   COVER — SINGLE AUTHORITY (REAL FLOW)
   - direct bind (no delegated doc click)
   - prompt gate
   - credits consume (single path)
   - calls /api/cover/generate
   - pushes output to gallery + (if exists) AIVO_JOBS
   ========================================================= */
(function AIVO_BIND_COVER_ONCE(){
  const btn = document.getElementById("coverGenerateBtn");
  if (!btn || btn.__aivoBoundCover) return;
  btn.__aivoBoundCover = true;

  // --- helpers (robust selectors) ---
  function findCoverRoot(){
    return document.querySelector(".cover-main, .cover-panel, [data-page='cover'], #pageCover, #coverPage") || document;
  }
  function getPrompt(){
    const root = findCoverRoot();
    const el =
      root.querySelector("#coverPrompt, textarea[name='coverPrompt'], textarea[name='prompt'], textarea") ||
      document.querySelector("#coverPrompt, textarea[name='coverPrompt'], textarea[name='prompt'], textarea");
    return (el?.value || "").trim();
  }
  function getStyle(){
    const root = findCoverRoot();
    // seçili chip buton
    const active =
      root.querySelector(".chip.is-active,[data-style].is-active,[data-cover-style].is-active,.style-chip.is-active") ||
      document.querySelector(".chip.is-active,[data-style].is-active,[data-cover-style].is-active,.style-chip.is-active");
    return (active?.dataset?.coverStyle || active?.dataset?.style || active?.textContent || "").trim();
  }
  function getRatio(){
    const root = findCoverRoot();
    const sel =
      root.querySelector("select[name='ratio'], #coverRatio, [data-cover-ratio]") ||
      document.querySelector("select[name='ratio'], #coverRatio, [data-cover-ratio]");
    const v = (sel?.value || sel?.dataset?.coverRatio || "").trim();
    return v || "1:1";
  }
  function getCount(){
    const root = findCoverRoot();
    const sel =
      root.querySelector("select[name='count'], #coverCount, [data-cover-count]") ||
      document.querySelector("select[name='count'], #coverCount, [data-cover-count]");
    const v = Number(sel?.value || sel?.dataset?.coverCount || 1);
    return Number.isFinite(v) && v > 0 ? v : 1;
  }
  function toastErr(msg){
    if (window.toast?.error) return window.toast.error(msg);
    console.warn(msg);
  }
  function toastOk(msg){
    if (window.toast?.success) return window.toast.success(msg);
    console.log(msg);
  }

async function consumeCredits(cost){
  // ✅ TEK SATIR FIX (NEGATİF GELSE BİLE POZİTİFE ÇEVİRİR)
  cost = Math.abs(Number(cost || 0));

  // Prefer store (single authority) if present
  if (window.AIVO_STORE_V1?.consumeCredits) {
    const ok = await window.AIVO_STORE_V1.consumeCredits(cost);
    return !!ok;
  }

  // Fallback direct API
  const r = await fetch("/api/credits/consume", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: cost, reason: "cover" })
  });

  if (!r.ok) return false;

  const data = await r.json().catch(() => ({}));

  // optional UI sync
  if (window.AIVO_STORE_V1?.syncCreditsUI) {
    window.AIVO_STORE_V1.syncCreditsUI(data);
  }

  return true;
}


  function pushToGallery(imageUrl){
    const root = findCoverRoot();
    const gallery =
      root.querySelector("#coverGallery, .cover-gallery, [data-cover-gallery]") ||
      document.querySelector("#coverGallery, .cover-gallery, [data-cover-gallery]");
    if (!gallery) return;

    const card = document.createElement("div");
    card.className = "gallery-card";
    card.dataset.status = "ready";

    const thumb = document.createElement("div");
    thumb.className = "gallery-thumb";
    thumb.style.background = `center/cover no-repeat url("${imageUrl}")`;

    const overlay = document.createElement("div");
    overlay.className = "media-overlay";

    const expandBtn = document.createElement("button");
    expandBtn.className = "media-ico";
    expandBtn.type = "button";
    expandBtn.textContent = "🔍";
    expandBtn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const img = document.createElement("img");
      img.src = imageUrl;
      if (typeof window.openMediaModal === "function") window.openMediaModal(img);
      else window.open(imageUrl, "_blank");
    });

    const downloadBtn = document.createElement("button");
    downloadBtn.className = "media-ico";
    downloadBtn.type = "button";
    downloadBtn.textContent = "⬇";
    downloadBtn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const a = document.createElement("a");
      a.href = imageUrl;
      a.download = "aivo-cover.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
    });

    const delBtn = document.createElement("button");
    delBtn.className = "media-ico danger";
    delBtn.type = "button";
    delBtn.textContent = "✖";
    delBtn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      card.remove();
    });

    overlay.append(expandBtn, downloadBtn, delBtn);
    card.append(thumb, overlay);
    gallery.prepend(card);
  }

  async function generateCoverReal(){
    const prompt = getPrompt();
    if (!prompt) {
      toastErr("Prompt boş. Kapak için kısa bir açıklama yaz.");
      return;
    }

    const cost = Number(btn.dataset.creditCost || 6);
    const originalText = btn.textContent;

    try {
      btn.disabled = true;
      btn.classList.add("is-loading");
      btn.textContent = "Üretiliyor...";

      const ok = await consumeCredits(cost);
      if (!ok) {
        toastErr("Kredi yetersiz veya kredi düşürülemedi.");
        return;
      }

      const payload = {
        prompt,
        style: getStyle(),
        ratio: getRatio(),
        count: getCount()
      };

      const res = await fetch("/api/cover/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        toastErr("Kapak üretimi başarısız (API).");
        return;
      }

      const data = await res.json().catch(() => ({}));

      // Accept common shapes
      const urls = []
        .concat(data.url || [])
        .concat(data.urls || [])
        .concat(data.image_url || [])
        .concat(data.imageUrl || [])
        .filter(Boolean);

      if (!urls.length && data.base64) {
        urls.push(`data:image/png;base64,${data.base64}`);
      }

      if (!urls.length) {
        toastErr("Kapak üretildi ama görsel URL gelmedi.");
        return;
      }

      // Push first to gallery (and optionally jobs)
      pushToGallery(urls[0]);

      if (window.AIVO_JOBS?.pushJob) {
        window.AIVO_JOBS.pushJob({
          type: "cover",
          createdAt: Date.now(),
          url: urls[0],
          meta: payload
        });
      }

      toastOk("Kapak oluşturuldu.");
    } finally {
      btn.disabled = false;
      btn.classList.remove("is-loading");
      btn.textContent = originalText;
    }
  }

  // ✅ single, direct handler
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    generateCoverReal();
  }, { passive: false });

  console.log("[COVER] single authority bound:", btn);
})();
/* =========================
   ATMOSFER → KREDİ (PERSIST) + JOB + MOCK OUTPUT (BASIC+SUPER TEK BLOK)
   FIX:
   - Süper mod cost = 30 garanti
   - Çift toast / çift tetik engeli (lock)
   - "çıktı hazır" toast kapalı
   ========================= */
(() => {
  const log = (...a) => console.log("[ATM_BIND]", ...a);

  function ensureToast() {
    if (!window.toast) window.toast = {};
    if (!window.toast.success) window.toast.success = (m) => console.log("[toast:success]", m);
    if (!window.toast.error) window.toast.error = (m) => console.error("[toast:error]", m);
    if (!window.toast.info) window.toast.info = (m) => console.log("[toast:info]", m);
  }

  function readMode(btn) {
    const v =
      btn.getAttribute("data-atm-mode") ||
      btn.dataset.atmMode ||
      window.__ATM_MODE__ ||
      "";

    if (String(v).toLowerCase() === "super") return "super";
    if (String(v).toLowerCase() === "basic") return "basic";

    const superTab =
      document.querySelector('[data-atm-tab="super"].is-active') ||
      document.querySelector("#atmTabSuper.is-active") ||
      document.querySelector(".atm-tab.super.is-active") ||
      document.querySelector('.segmented .is-active[data-mode="super"]');

    return superTab ? "super" : "basic";
  }

  function isSuperButton(btn) {
    const t = (btn.textContent || "").toLowerCase();
    return t.includes("süper") || t.includes("super");
  }

  function getSuperPromptValue() {
    const el =
      document.getElementById("atmPromptSuper") ||
      document.querySelector('[data-atm-prompt="super"]') ||
      document.querySelector('[data-atm-super-prompt]') ||
      document.querySelector('#atmPanelSuper textarea') ||
      document.querySelector(".atm-super textarea") ||
      document.querySelector('.atm-panel [data-mode="super"] textarea') ||
      document.querySelector('textarea[placeholder*="Gece neon"]') ||
      null;

    return (el?.value || "").trim();
  }

  function getBasicAtmosphereSelectedCount() {
    const root =
      document.getElementById("atmBasicPanel") ||
      document.getElementById("atmPanelBasic") ||
      document.querySelector('[data-atm-panel="basic"]') ||
      document.querySelector(".atm-basic") ||
      document.querySelector("#atmPanel") ||
      document;

    const section =
      root.querySelector('[data-atm-atmosphere]') ||
      root.querySelector("#atmAtmosphere") ||
      root.querySelector(".atm-atmosphere") ||
      root;

 const selected = section.querySelectorAll(
  [
    '[data-atm-effect].is-active',
    '[data-atm-effect].active',
    '[data-atm-effect].selected',
    '[data-atm-effect].is-selected',
    '[data-atm-effect][aria-pressed="true"]',

    ".atm-chip.is-active",
    ".atm-chip.active",
    ".atm-chip.selected",
    ".atm-chip.is-selected",

    ".chip.is-active",
    ".chip.active",
    ".chip.selected",
    ".chip.is-selected",

    // ✅ SADECE section içinde olduğu için güvenli:
    'button[aria-pressed="true"]'
  ].join(",")
);



    const uniq = new Set();
    selected.forEach((el) => {
      const key =
        el.getAttribute("data-atm-effect") ||
        el.getAttribute("data-effect") ||
        (el.textContent || "").trim();
      if (key) uniq.add(key);
    });

    return uniq.size;
  }

  async function consumeCreditsBackend({ cost, mode }) {
    try {
      const res = await fetch("/api/credits/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ cost, reason: "atmosphere", mode })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, status: res.status, data };
      return { ok: true, status: res.status, data };
    } catch (e) {
      return { ok: false, status: 0, data: { error: String(e?.message || e) } };
    }
  }

  function applyCreditsUI(maybeCredits) {
    if (typeof maybeCredits !== "number" || !Number.isFinite(maybeCredits)) return;

    const el =
      document.getElementById("topCreditCount") ||
      document.querySelector("#topCredits [data-credit-count]") ||
      document.querySelector("[data-top-credit-count]");

    if (el) el.textContent = String(maybeCredits);

    if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.setCredits === "function") {
      try { window.AIVO_STORE_V1.setCredits(maybeCredits); } catch {}
    }
    if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.syncCreditsUI === "function") {
      try { window.AIVO_STORE_V1.syncCreditsUI(); } catch {}
    }
  }

  function findJobsHost() {
    return (
      document.getElementById("jobsList") ||
      document.getElementById("outputsList") ||
      document.querySelector("[data-jobs-list]") ||
      document.querySelector(".jobs-list") ||
      document.querySelector(".outputs-list") ||
      document.querySelector("#rightPanel .list") ||
      document.querySelector("#rightPanel") ||
      null
    );
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
    }[c]));
  }

  function nowId() {
    return (crypto?.randomUUID ? crypto.randomUUID() : `atm_${Date.now()}_${Math.random().toString(16).slice(2)}`);
  }

  function createJobCard({ jobId, title, subtitle }) {
    const host = findJobsHost();
    if (!host) return null;

    const card = document.createElement("div");
    card.className = "job-card atm-job";
    card.dataset.jobId = jobId;
    card.style.cssText = `
      border:1px solid rgba(255,255,255,.10);
      background:rgba(255,255,255,.04);
      border-radius:14px;
      padding:12px;
      margin:10px 0;
    `;

    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <div>
          <div style="font-weight:700;line-height:1.15">${escapeHtml(title)}</div>
          <div style="opacity:.75;font-size:12px;margin-top:4px">${escapeHtml(subtitle)}</div>
        </div>
        <div class="atm-status" style="font-size:12px;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);">
          Hazırlanıyor…
        </div>
      </div>

      <div class="atm-output" style="margin-top:10px;display:none">
        <div style="opacity:.75;font-size:12px;margin-bottom:8px;">Mock çıktı (loop)</div>
        <video class="atm-video" controls loop playsinline style="width:100%;border-radius:12px;border:1px solid rgba(255,255,255,.10);background:#000"></video>
      </div>
    `;

    host.prepend(card);
    return card;
  }

  function setCardReady(card, { videoUrl }) {
    if (!card) return;
    const status = card.querySelector(".atm-status");
    const output = card.querySelector(".atm-output");
    const vid = card.querySelector(".atm-video");

    if (status) status.textContent = "Hazır";
    if (output) output.style.display = "block";

    if (vid) {
      vid.src = videoUrl || "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
      try { vid.load(); } catch {}
    }
  }

  function getAtmosphereButtons() {
    const list = [];

    const b1 = document.getElementById("atmGenerateBtn");
    const b2 = document.getElementById("atmGenerateBtnSuper");
    if (b1) list.push(b1);
    if (b2) list.push(b2);

    document.querySelectorAll("[data-atm-generate]").forEach(b => list.push(b));

    document.querySelectorAll("button").forEach((b) => {
      const t = (b.textContent || "").trim();
      if (/Atmosfer Video Oluştur/i.test(t) || /Süper Atmosfer Video Oluştur/i.test(t)) list.push(b);
    });

    return Array.from(new Set(list));
  }

  function bindAtmosphere() {
    ensureToast();

    const btns = getAtmosphereButtons();
    if (!btns.length) return log("Atmosfer butonu bulunamadı.");

    btns.forEach((btn) => {
      if (btn.dataset.atmBound === "1") return;
      btn.dataset.atmBound = "1";

      btn.addEventListener("click", async (e) => {
        try { e.preventDefault(); } catch {}
        try { e.stopImmediatePropagation?.(); } catch {}
        try { e.stopPropagation?.(); } catch {}

        if (btn.dataset.atmBusy === "1") return;
        btn.dataset.atmBusy = "1";

        try {
          let mode = readMode(btn);
          if (isSuperButton(btn)) mode = "super";

          if (mode === "basic") {
            const n = getBasicAtmosphereSelectedCount();
            if (!n) {
              window.toast.error("En az 1 atmosfer seçmelisin.");
              return;
            }
          }

          if (mode === "super") {
            const prompt = getSuperPromptValue();
            if (!prompt) {
              window.toast.error("Prompt boş. Atmosfer için bir açıklama yaz.");
              return;
            }
          }

          const attrCostRaw = btn.getAttribute("data-atm-cost");
          const attrCost = Number(attrCostRaw);
          let cost = (Number.isFinite(attrCost) && attrCost > 0)
            ? attrCost
            : (mode === "super" ? 30 : (20 + getBasicAtmosphereSelectedCount()));

          if (mode === "super") cost = 30;

          const out = await consumeCreditsBackend({ cost, mode });
          if (!out.ok) {
            window.toast.error("Yetersiz kredi. Fiyatlandırma sayfasına yönlendiriliyor…");
            if (typeof window.redirectToPricing === "function") window.redirectToPricing();
            else window.location.href = "/fiyatlandirma.html";
            return;
          }

          const newCredits =
            (typeof out.data?.credits === "number" ? out.data.credits : null) ??
            (typeof out.data?.remaining === "number" ? out.data.remaining : null) ??
            (typeof out.data?.balance === "number" ? out.data.balance : null);

          if (typeof newCredits === "number") applyCreditsUI(newCredits);

          window.toast.success(`Atmosfer için ${cost} kredi düşüldü.`);

          const jobId = nowId();
          const card = createJobCard({
            jobId,
            title: mode === "super" ? "AI Atmosfer Video (Süper)" : "AI Atmosfer Video",
            subtitle: `Mod: ${mode} • Job: ${jobId.slice(0, 8)}…`
          });

          if (card) {
            setTimeout(() => {
              setCardReady(card, { videoUrl: null });
            }, 1200);
          }

          log("OK", { mode, cost, jobId, newCredits });
        } finally {
          btn.dataset.atmBusy = "0";
        }
      }, { passive: false });

      log("bound ✅", btn);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindAtmosphere, { once: true });
  } else {
    bindAtmosphere();
  }
})();

/* =========================================================
   SM PACK — SINGLE AUTHORITY (PROMPT GATE + REAL CREDIT CONSUME)
   - Prompt yoksa: hata toast
   - Prompt varsa: /api/credits/consume (4) -> kredi düş
   - Sağ panel: job + step flow
   - DEMO/MOCK VIDEO YOK: gerçek videoUrl gelene kadar "Henüz çıktı yok"
   ========================================================= */
(function SMPACK_FINAL_SINGLE_BLOCK(){
  "use strict";
  if (window.__AIVO_SMPACK_FINAL_BLOCK__) return;
  window.__AIVO_SMPACK_FINAL_BLOCK__ = true;

  const COST = 4;

  function toastErr(){
    try { window.toast?.error?.("Prompt Boş. Sosyal Medya video için kısa bir açıklama yaz."); } catch(_) {}
  }
  function toastOk(){
    try { window.toast?.success?.(`Üretim başladı • ${COST} kredi düşüldü`); } catch(_) {}
  }

  function escapeHtml(s){
    return String(s || "")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#39;");
  }

  function getSMPageFrom(btn){
    return btn?.closest?.(".page-sm-pack") || document.querySelector(".page-sm-pack") || document.body;
  }

  function getMessageInput(page){
    return (
      page.querySelector("[data-sm-pack-message]") ||
      page.querySelector("input[name='smPackMessage']") ||
      page.querySelector(".smpack-message") ||
      page.querySelector("input[type='text']") ||
      null
    );
  }

  function getPrompt(page){
    const el = getMessageInput(page);
    return (el && (el.value || "").trim()) || "";
  }

  function getRightList(){
    // legacy right list
    return (
      document.querySelector(".right-panel .right-list") ||
      document.querySelector(".right-list") ||
      null
    );
  }

  function hideEmpty(list){
    const empty = list?.querySelector?.(".right-empty");
    if (empty) empty.style.display = "none";
  }

  function uid(){
    return "sm_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,7);
  }

  function createJobCard(list, meta){
    const { message, jobId } = meta;

    const card = document.createElement("div");
    card.className = "right-job right-job--sm";
    card.setAttribute("data-sm-job", jobId);

    card.innerHTML = `
      <div class="right-job__top">
        <div>
          <div class="right-job__title">AI Sosyal Medya Paketi</div>
          <div class="card-subtitle" style="opacity:.85;margin-top:2px;">
            ${escapeHtml(message.slice(0, 60))}
          </div>
        </div>
        <div class="right-job__status" data-sm-status>Üretiliyor</div>
      </div>

      <div class="right-job__line" data-sm-step="1">
        <div class="right-job__badge">1</div>
        <div class="right-job__text">Hazırlanıyor…</div>
        <div class="right-job__state is-doing" data-sm-state>Üretiliyor</div>
      </div>
      <div class="right-job__line" data-sm-step="2">
        <div class="right-job__badge">2</div>
        <div class="right-job__text">Video oluşturuluyor…</div>
        <div class="right-job__state" data-sm-state>Bekliyor</div>
      </div>

      <div class="right-sm-output" style="margin-top:10px;">
        <div style="opacity:.75;font-size:12px;margin-bottom:8px;">Çıktı</div>
        <div class="out-empty" style="min-height:120px;border-radius:14px;">
          Henüz çıktı yok
        </div>
      </div>
    `;

    list.prepend(card);
    return card;
  }

  function setStep(card, stepNo){
    const lines = Array.from(card.querySelectorAll("[data-sm-step]"));
    lines.forEach(line => {
      const n = parseInt(line.getAttribute("data-sm-step"), 10);
      const state = line.querySelector("[data-sm-state]");
      if (!state) return;

      state.classList.remove("is-doing","is-done");

      if (n < stepNo){
        state.textContent = "Hazır";
        state.classList.add("is-done");
      } else if (n === stepNo){
        state.textContent = "Üretiliyor";
        state.classList.add("is-doing");
      } else {
        state.textContent = "Bekliyor";
      }
    });
  }

  function finishJob(card){
    const st = card.querySelector("[data-sm-status]");
    if (st) st.textContent = "Tamamlandı";

    const states = card.querySelectorAll("[data-sm-state]");
    states.forEach(s => {
      s.textContent = "Hazır";
      s.classList.remove("is-doing");
      s.classList.add("is-done");
    });
  }

  async function consumeCredits(cost){
    const res = await fetch("/api/credits/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ cost })
    });

    let data = null;
    try { data = await res.json(); } catch(_) {}

    if (!res.ok){
      try {
        const msg = (data && (data.error || data.message)) ? String(data.error || data.message) : "Kredi düşürülemedi";
        window.toast?.error?.(msg);
      } catch(_) {}
      return { ok: false, data };
    }

    try {
      if (typeof data?.credits === "number") {
        const el = document.querySelector("#topCreditCount") || document.querySelector("[data-top-credits]");
        if (el) el.textContent = String(data.credits);
      }
      window.AIVO_STORE_V1?.syncCreditsUI?.();
    } catch(_) {}

    return { ok: true, data };
  }

  document.addEventListener("click", async function(e){
    const btn = e.target?.closest?.("[data-generate-sm-pack], .smpack-generate, [data-sm-generate]");
    if (!btn) return;

    const page = getSMPageFrom(btn);

    e.preventDefault();
    e.stopPropagation();
    try { e.stopImmediatePropagation(); } catch(_) {}

    const prompt = getPrompt(page);
    if (!prompt){
      toastErr();
      try { getMessageInput(page)?.focus?.(); } catch(_) {}
      return;
    }

    const cons = await consumeCredits(COST);
    if (!cons.ok) return;

    toastOk();

    const list = getRightList();
    if (!list) return;

    hideEmpty(list);

    const jobId = uid();
    const card = createJobCard(list, { message: prompt, jobId });

    setStep(card, 1);
    setTimeout(()=>setStep(card, 2), 600);

    setTimeout(()=>finishJob(card), 1400);

  }, true);

})();

/* ===========================================================
   AIVO — RIGHT PANEL VIDEO OUTPUTS (Mini MP4 Grid + Modal)
   - Grid: #outVideosGrid
   - Panel: #videoList / #videoEmpty
   - Modal: #vprev (video preview + download)
   - Helpers:
       window.AIVO_RENDER_MINI_VIDEOS()
       window.AIVO_PUSH_VIDEO_PLACEHOLDER(jobLike)
   - TEMP:
       Video butonlarına basınca placeholder basar (capture=true)
   =========================================================== */
(function () {
  const grid = document.getElementById("outVideosGrid");
  const modal = document.getElementById("vprev");
  const modalVideo = document.getElementById("vprevVideo");
  const modalTitle = document.getElementById("vprevTitle");
  const modalDl = document.getElementById("vprevDownload");

  if (!grid || !modal || !modalVideo) return;

  // dışarıdan doldurulacak liste
  window.AIVO_OUTPUT_VIDEOS = window.AIVO_OUTPUT_VIDEOS || [];

  // ✅ helper: listeye ekle + persist + render + paneli aç
  function addMiniVideo(item) {
    try {
      if (!item) return;

      const v = Object.assign(
        {
          id: "video-" + Date.now(),
          title: "Video • İşleniyor",
          badge: "Sırada",
          // placeholder: gerçek URL gelince güncellenecek
          src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
        },
        item
      );

      window.AIVO_OUTPUT_VIDEOS = window.AIVO_OUTPUT_VIDEOS || [];
      window.AIVO_OUTPUT_VIDEOS.unshift(v);

      // 20 ile sınırla
      window.AIVO_OUTPUT_VIDEOS = window.AIVO_OUTPUT_VIDEOS.slice(0, 20);

      // persist
      try {
        localStorage.setItem(
          "AIVO_OUTPUT_VIDEOS_V1",
          JSON.stringify(window.AIVO_OUTPUT_VIDEOS)
        );
      } catch (_) {}

      // panel görünür olsun
      const videoList = document.getElementById("videoList");
      if (videoList) videoList.classList.remove("hidden");

      // render
      if (typeof window.AIVO_RENDER_MINI_VIDEOS === "function") {
        window.AIVO_RENDER_MINI_VIDEOS();
      }
    } catch (e) {
      console.warn("[MINI_VIDEOS] add failed", e);
    }
  }

  function openPreview(src, title) {
    if (!src) return;
    modalTitle.textContent = title || "Video";
    modalVideo.pause();
    modalVideo.src = src;
    modalDl.href = src;
    modal.hidden = false;
    setTimeout(() => {
      try {
        modalVideo.play();
      } catch (e) {}
    }, 50);
  }

  function closePreview() {
    modalVideo.pause();
    modalVideo.removeAttribute("src");
    modalVideo.load();
    modal.hidden = true;
  }

  function renderMiniVideos(items) {
    grid.innerHTML = "";

    // empty state toggle
    const empty = document.getElementById("videoEmpty");
    if (empty) empty.style.display = items.length ? "none" : "block";

    items.forEach((v) => {
      const card = document.createElement("div");
      card.className = "vcard";
      card.dataset.src = v.src || "";
      card.dataset.title = v.title || "Video";

      card.innerHTML = `
        <video muted playsinline preload="metadata" src="${v.src || ""}"></video>
        <div class="vbadge">${v.badge || "Video"}</div>
        <div class="vplay"><i>▶</i></div>
        <div class="vactions">
          <a class="viconbtn" href="${v.src || "#"}" download title="İndir">⤓</a>
        </div>
      `;

      card.addEventListener("click", () =>
        openPreview(card.dataset.src, card.dataset.title)
      );
      grid.appendChild(card);
    });
  }

  // modal close
  modal.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.dataset && t.dataset.close === "1") closePreview();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && !modal.hidden) closePreview();
  });

  // expose helper for other modules:
  window.AIVO_RENDER_MINI_VIDEOS = function () {
    renderMiniVideos(window.AIVO_OUTPUT_VIDEOS || []);
  };

  // ✅ expose "push placeholder" helper (Video Oluştur basınca çağıracağız)
  window.AIVO_PUSH_VIDEO_PLACEHOLDER = function (jobLike) {
    const id =
      (jobLike &&
        (jobLike.id || jobLike.job_id || jobLike.jobId || jobLike.key)) ||
      "video-" + Date.now();
    addMiniVideo({ id, title: "Video • İşleniyor", badge: "Sırada" });
  };

  // 🔁 restore once on page load
  try {
    const saved = JSON.parse(
      localStorage.getItem("AIVO_OUTPUT_VIDEOS_V1") || "[]"
    );
    if (Array.isArray(saved) && saved.length) {
      window.AIVO_OUTPUT_VIDEOS = saved;
    }
  } catch (_) {}

  // initial render (restore’dan sonra!)
  window.AIVO_RENDER_MINI_VIDEOS();

  // ✅ TEMP: “Video Oluştur” butonuna basınca placeholder bas
  // (GEN_BRIDGE/AIVO_JOBS yokken bile UI çalışsın diye)
  try {
    const btn1 = document.getElementById("videoGenerateTextBtn");
    const btn2 = document.getElementById("videoGenerateImageBtn");
    const hook = (btn) => {
      if (!btn) return;
      btn.addEventListener(
        "click",
        () => {
          window.AIVO_PUSH_VIDEO_PLACEHOLDER({ id: "video-" + Date.now() });
        },
        true
      );
    };
    hook(btn1);
    hook(btn2);
  } catch (e) {
    console.warn("[MINI_VIDEOS] button hook failed", e);
  }
})();




})(); // ✅ MAIN studio.app.js WRAPPER KAPANIŞI (EKLENDİ)
