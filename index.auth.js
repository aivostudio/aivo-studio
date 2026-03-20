/* =========================================================
   AIVO — INDEX AUTH (CLEAN / SINGLE SOURCE OF TRUTH)
   - Topbar IDs: #btnLoginTop / #btnRegisterTop / #btnLogoutTop
   - UI Boxes:  #authGuest / #authUser / #topUserEmail
   - Gate: a[data-auth="required"] -> login yoksa modal aç
   - Target key: sessionStorage["aivo_after_login"]
   - Exports for studio.guard.js:
       window.isLoggedIn
       window.openLoginModal
       window.rememberTarget
   ========================================================= */

console.log("[AIVO] index.auth.js LOADED ✅", new Date().toISOString());

/* ✅ Duplicate-safe DEMO_AUTH (şimdilik duruyor — sonra komple silinecek) */
window.DEMO_AUTH = window.DEMO_AUTH || {
  email: "harunerkezen@gmail.com",
  pass: "123456"
};

/* ✅ Sabitler (duplicate-safe) */
window.AIVO_AUTH_KEYS = window.AIVO_AUTH_KEYS || {
  TARGET_KEY: "aivo_after_login", // login sonrası nereye dönecek
  LOGIN_KEY:  "aivo_logged_in",
  EMAIL_KEY:  "aivo_user_email"
};

var TARGET_KEY = window.AIVO_AUTH_KEYS.TARGET_KEY;
var LOGIN_KEY  = window.AIVO_AUTH_KEYS.LOGIN_KEY;
var EMAIL_KEY  = window.AIVO_AUTH_KEYS.EMAIL_KEY;

/*
  NOT:
  - ToastFlash / sessionStorage "__AIVO_TOAST__" yolu KALDIRILDI.
  - Login success artık URL ile taşır:
    /studio.v2.html?tf=success&tm=...
*/


/* =========================
   AUTH STATE
   ========================= */
function isLoggedIn() {
  return localStorage.getItem(LOGIN_KEY) === "1";
}
function setLoggedIn(v) {
  localStorage.setItem(LOGIN_KEY, v ? "1" : "0");
}

/* =========================
   MODAL FINDER (SINGLE SOURCE)
   ========================= */
function getModalEl() {
  return document.getElementById("loginModal");
}

/* =========================
   MODE APPLY (MATCHES YOUR HTML)
   ========================= */
function applyModalMode(m, mode) {
  const isReg = mode === "register";

  // Header
  const title = m.querySelector("#loginTitle");
  const desc  = m.querySelector("#loginDesc") || m.querySelector(".login-desc");
  if (title) title.textContent = isReg ? "Email ile Kayıt" : "Tekrar hoş geldin 👋";
  if (desc)  desc.textContent  = isReg
    ? "AIVO Studio’ya erişmek için ücretsiz hesabını oluştur."
    : "AIVO Studio’ya erişmek için giriş yap veya ücretsiz hesap oluştur.";

  // Card titles
  const cardTitle = m.querySelector("#authCardTitle");
  const cardSub   = m.querySelector("#authCardSub");
  if (cardTitle) cardTitle.textContent = isReg ? "Email ile Kayıt" : "Email ile Giriş";
  if (cardSub)   cardSub.textContent   = isReg
    ? "Ücretsiz hesap oluştur ve 5 kredi kazan."
    : "Hesabına email adresinle giriş yap.";

  // Blocks (your exact IDs)
  const google   = document.getElementById("googleBlock");
  const footer   = document.getElementById("loginFooter");
  const loginMeta= document.getElementById("loginMeta");
  const regMeta  = document.getElementById("registerMeta");
  const extra    = document.getElementById("registerExtra");
  const kvkkRow  = document.getElementById("kvkkRow");

  if (google)    google.style.display    = isReg ? "none" : "block";
  if (footer)    footer.style.display    = isReg ? "none" : "block";
  if (loginMeta) loginMeta.style.display = isReg ? "none" : "flex";
  if (regMeta)   regMeta.style.display   = isReg ? "flex" : "none";
  if (extra)     extra.style.display     = isReg ? "flex" : "none";
  if (kvkkRow)   kvkkRow.style.display   = isReg ? "flex" : "none";

  // Submit text (your button id)
  const btn = document.getElementById("btnAuthSubmit");
  if (btn) btn.textContent = isReg ? "Hesap Oluştur" : "Giriş Yap";

  // Login’e dönünce register alanlarını temizle
  if (!isReg) {
    const name  = document.getElementById("regName");
    const pass2 = document.getElementById("regPass2");
    const kvkk  = document.getElementById("kvkkOk");
    if (name)  name.value = "";
    if (pass2) pass2.value = "";
    if (kvkk)  kvkk.checked = false;
  }
}

function openModal(mode /* "login" | "register" */) {
  const m = getModalEl();
  if (!m) {
    console.warn("[AIVO] Login modal bulunamadı. (#loginModal)");
    return;
  }

  const finalMode = mode === "register" ? "register" : "login";

  m.classList.add("is-open");
  m.setAttribute("aria-hidden", "false");
  m.setAttribute("data-mode", finalMode);

  document.body.classList.add("modal-open");
  document.documentElement.classList.add("modal-open");

  // ✅ apply mode
  applyModalMode(m, finalMode);

  // focus email
  setTimeout(() => {
    const email = document.getElementById("loginEmail");
    if (email && typeof email.focus === "function") email.focus();
  }, 30);
}


/* =========================
   TARGET / REDIRECT
   ========================= */
function normalizeStudio(url) {
  const u = (url || "/studio.v2.html").trim();

  if (u.includes("/studio.v2.html")) return u;

  if (u.includes("/studio.html")) {
    return u.replace("/studio.html", "/studio.v2.html");
  }

  if (u.includes("/studio")) {
    const suffix = u.substring(u.indexOf("/studio") + "/studio".length) || "";
    return "/studio.v2.html" + suffix;
  }

  return u;
}

function rememberTargetFromAnchor(a) {
  try {
    const u = new URL(a.href, location.origin);
    if (u.origin !== location.origin) return;
    sessionStorage.setItem(TARGET_KEY, u.pathname + u.search + u.hash);
  } catch (_) {}
}

function rememberTarget(url) {
  try {
   sessionStorage.setItem(TARGET_KEY, normalizeStudio(url || "/studio.v2.html"));
  } catch (_) {}
}

function goAfterLogin() {
const raw = sessionStorage.getItem(TARGET_KEY) || "/studio.v2.html";
  sessionStorage.removeItem(TARGET_KEY);
  location.href = normalizeStudio(raw);
}

/* =========================
   TOPBAR UI SYNC (FINAL)
   ========================= */
function syncTopbarAuthUI() {
  const guestBox = document.getElementById("authGuest");
  const userBox  = document.getElementById("authUser");

  const email = (localStorage.getItem(EMAIL_KEY) || "").trim();
  const loggedIn = isLoggedIn() && !!email; // ✅ email yoksa girişli sayma

  // Ana görünürlük
  if (guestBox) guestBox.style.display = loggedIn ? "none" : "flex";
  if (userBox)  userBox.style.display  = loggedIn ? "flex" : "none";

  // User alanları
  const topUserEmail = document.getElementById("topUserEmail");
  const topMenuEmail = document.getElementById("topMenuEmail");
  const topMenuName  = document.getElementById("topMenuName");

  if (loggedIn) {
    const name = (email.split("@")[0] || "Hesap").trim();
    if (topUserEmail) topUserEmail.textContent = email;
    if (topMenuEmail) topMenuEmail.textContent = email;
    if (topMenuName)  topMenuName.textContent  = name;
  } else {
    if (topUserEmail) topUserEmail.textContent = "";
    if (topMenuEmail) topMenuEmail.textContent = "";
    if (topMenuName)  topMenuName.textContent  = "—";
  }
}


/* =========================
   TOPBAR WAIT + AUTO SYNC (Kurumsal include gecikmesini çözer)
   ========================= */
window.__AIVO_SYNC_AUTH_UI__ = syncTopbarAuthUI;

function AIVO_WAIT_TOPBAR_AND_SYNC(){
  let tries = 0;
  const maxTries = 30;   // ~3sn
  const intervalMs = 100;

  function hasTopbarDom(){
    // ✅ en azından ana kutular gelsin (guest/user)
    return !!(
      document.getElementById("authGuest") &&
      document.getElementById("authUser")
    );
  }

  function tick(){
    tries++;
    try { syncTopbarAuthUI(); } catch(_){}

    if (hasTopbarDom()) return;
    if (tries >= maxTries) return;

    setTimeout(tick, intervalMs);
  }

  tick();

  try{
    const obs = new MutationObserver(() => {
      if (hasTopbarDom()){
        try { syncTopbarAuthUI(); } catch(_){}
        try { obs.disconnect(); } catch(_){}
      }
    });
    obs.observe(document.documentElement, { childList:true, subtree:true });
  }catch(_){}
}
/* ==============================
   DOM READY INIT
   — Studio’dan gelen logout handshake’i yakala
   ============================== */
document.addEventListener("DOMContentLoaded", () => {
  // ✅ Studio logout handshake
  if (sessionStorage.getItem("__AIVO_FORCE_LOGOUT__") === "1") {
    try {
      [
        "aivo_logged_in",
        "aivo_user_email",
        "aivo_auth",
        "aivo_token",
        "aivo_user"
      ].forEach((k) => {
        try { localStorage.removeItem(k); } catch (_) {}
      });

      sessionStorage.removeItem("__AIVO_FORCE_LOGOUT__");
    } catch (_) {}
  }

  // ✅ UI sync (tek kaynak)
  try { syncTopbarAuthUI(); } catch (_) {}
  try { AIVO_WAIT_TOPBAR_AND_SYNC(); } catch (_) {}
});


/* =========================================================
   CLICK ROUTER (tek yerden) — FINAL (STORE KORUNUR)
   ========================================================= */

const AUTH_KEYS_TO_CLEAR = [
  "aivo_logged_in",
  "aivo_user_email",
  "aivo_auth",
  "aivo_token",
  "aivo_user"
];

const SESSION_KEYS_TO_CLEAR = [
  "__AIVO_FORCE_LOGOUT__",
  "aivo_auth_target"
];

window.AIVO_LOGOUT = function () {
  AUTH_KEYS_TO_CLEAR.forEach((k) => { try { localStorage.removeItem(k); } catch (_) {} });
  SESSION_KEYS_TO_CLEAR.forEach((k) => { try { sessionStorage.removeItem(k); } catch (_) {} });
  try { if (typeof syncTopbarAuthUI === "function") syncTopbarAuthUI(); } catch (_) {}
  location.href = "/";
};

function OPEN_AUTH(mode){
  if (typeof window.openAuthModal === "function") return window.openAuthModal(mode);
  if (typeof openModal === "function") return openModal(mode);
}

function CLOSE_AUTH(){
  if (typeof window.closeAuthModal === "function") return window.closeAuthModal();
  if (typeof closeModal === "function") return closeModal();
}

document.addEventListener("click", (e) => {
  const t = e.target;
  if (!t || !t.closest) return;

  // Topbar: login/register
  const loginTop = t.closest("#btnLoginTop");
  if (loginTop) {
    e.preventDefault(); e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    OPEN_AUTH("login");
    return;
  }

  const regTop = t.closest("#btnRegisterTop");
  if (regTop) {
    e.preventDefault(); e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    OPEN_AUTH("register");
    return;
  }

  // Logout
  const logout = t.closest("#btnLogoutTop, [data-action='logout'], .logout");
  if (logout) {
    e.preventDefault(); e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    window.AIVO_LOGOUT();
    return;
  }

  // Gate: data-auth required link
  const a = t.closest('a[data-auth="required"]');
  if (a) {
    if (isLoggedIn()) return;
    e.preventDefault(); e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    rememberTargetFromAnchor(a);
    OPEN_AUTH("login");
    return;
  }

  // Modal close (X / backdrop / data-close)
  const m = (typeof getModalEl === "function") ? getModalEl() : document.getElementById("loginModal");
  if (m) {
    const isBackdrop = !!t.closest('[data-close="1"]') || t === m;
    const isClose = !!t.closest(".login-x") || !!t.closest(".modal-close") || !!t.closest("[data-close]");

    if (isBackdrop || isClose) {
      e.preventDefault(); e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      CLOSE_AUTH();
      return;
    }
  }
}, true); // ✅ CAPTURE

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") CLOSE_AUTH();
});


/* =========================================================
   🔄 CREDIT SYNC — AFTER LOGIN (SAFE / NO-OVERRIDE)
   - index.auth.js içinde kullan
   - Tab başına 1 kez çalışır
   - Store'da kredi varsa (0 değilse) EZMEZ
   ========================================================= */
(async function AIVO_SYNC_CREDITS_AFTER_LOGIN() {
  try {
    // ✅ tab başına 1 kez
    const FLAG = "aivo_credits_synced_once_v1";
    if (sessionStorage.getItem(FLAG) === "1") return;
    sessionStorage.setItem(FLAG, "1");

    // ✅ Email kaynağı: yeni prod auth (token/user) + legacy fallback
    let email =
      localStorage.getItem("aivo_user_email") ||
      (() => {
        try {
          const u = JSON.parse(localStorage.getItem("aivo_user") || "null");
          return u?.email || "";
        } catch (_) {
          return "";
        }
      })() ||
      localStorage.getItem("user_email") ||
      localStorage.getItem("email") ||
      "";

    email = String(email || "").trim().toLowerCase();
    if (!email || !window.AIVO_STORE_V1) return;

    // ✅ Store'da halihazırda geçerli kredi varsa EZME
    const cur = Number(window.AIVO_STORE_V1.getCredits?.());
    if (Number.isFinite(cur) && cur > 0) {
      // UI yine de sync olsun
      try { window.AIVO_SYNC_CREDITS_UI && window.AIVO_SYNC_CREDITS_UI(); } catch (_) {}
      console.log("[AIVO] Credit sync skipped (store already has credits):", cur);
      return;
    }

    // ✅ USER endpoint (admin değil)
    const r = await fetch(
      "/api/credits/get?email=" + encodeURIComponent(email),
      { cache: "no-store" }
    );
    const j = await r.json().catch(() => ({}));

    if (j && j.ok && typeof j.credits === "number") {
      window.AIVO_STORE_V1.setCredits(j.credits);

      // UI sync
      try { window.AIVO_SYNC_CREDITS_UI && window.AIVO_SYNC_CREDITS_UI(); } catch (_) {}

      console.log("[AIVO] Credits synced after login:", j.credits);
    } else {
      console.warn("[AIVO] Credits get failed:", j);
    }
  } catch (e) {
    console.error("[AIVO] Credit sync failed", e);
  }
})();

/* =========================================================
   EXPORTS for studio.guard.js
   ========================================================= */
window.isLoggedIn = isLoggedIn;
window.openLoginModal = function () {
  if (typeof window.openAuthModal === "function") return window.openAuthModal("login");
  if (typeof openModal === "function") return openModal("login");
};
window.rememberTarget = function (url) { rememberTarget(url); };

/* =========================================================
   PRODUCTS DROPDOWN — DEFAULT ACTIVE + TAP SELECT (iPad)
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  const menu = document.querySelector(".dropdown.dropdown--products .products-menu");
  if (!menu) return;

  const cards = Array.from(menu.querySelectorAll("a.product-card"));
  if (!cards.length) return;

  const setActive = (el) => {
    cards.forEach(c => c.classList.remove("is-active"));
    if (el) el.classList.add("is-active");
  };

  // 1) Sayfa açılır açılmaz ilk kart seçili
  setActive(cards[0]);

  // 2) Tap ile seç (iPad)
  cards.forEach(card => {
    card.addEventListener("touchstart", () => setActive(card), { passive: true });
    card.addEventListener("click", () => {
      setActive(card);
      // Linke gidecekse engelleme — sadece görsel seçim yapıyoruz
    });
  });
});


/* =========================================================
   DROPDOWN MANAGER — SINGLE SOURCE (PRODUCTS / CORP)
   - Desktop: hover (no click lock)
   - Mobile: click toggle (mutual exclusive)
   ========================================================= */
(function () {
  const nav = document.querySelector(".aivo-nav, .aivo-topbar, header");
  if (!nav) return;

  const items = Array.from(nav.querySelectorAll(".nav-item.has-dropdown"));

  const isMobileMode = () =>
    window.matchMedia("(max-width: 900px)").matches ||
    window.matchMedia("(hover: none)").matches;

  function closeAll(except) {
    items.forEach((it) => {
      if (except && it === except) return;
      it.classList.remove("is-open");
      const btn = it.querySelector(".nav-link");
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
  }

  function openItem(it) {
    closeAll(it);
    it.classList.add("is-open");
    const btn = it.querySelector(".nav-link");
    if (btn) btn.setAttribute("aria-expanded", "true");
  }

  // Desktop hover
  items.forEach((it) => {
    it.addEventListener("mouseenter", () => {
      if (isMobileMode()) return;
      openItem(it);
    });

    it.addEventListener("mouseleave", () => {
      if (isMobileMode()) return;
      it.classList.remove("is-open");
      const btn = it.querySelector(".nav-link");
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
  });

  // Mobile click toggle (only on nav dropdown buttons)
  items.forEach((it) => {
    const btn = it.querySelector("button.nav-link, .nav-link");
    if (!btn) return;

    btn.addEventListener("click", (e) => {
      if (!isMobileMode()) return; // desktop'ta click kilitlemesin
      e.preventDefault();
      e.stopPropagation();

      const willOpen = !it.classList.contains("is-open");
      if (willOpen) openItem(it);
      else closeAll(null);
    });
  });

  // Dropdown içinde tıklama => dışarı click'e düşmesin
  nav.querySelectorAll(".nav-item.has-dropdown .dropdown").forEach((dd) => {
    dd.addEventListener("click", (e) => e.stopPropagation());
  });

  // Dışarı tıkla => kapat
  document.addEventListener("click", (e) => {
    if (!nav.contains(e.target)) closeAll(null);
  });

  // ESC => kapat
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAll(null);
  });
})();

/* =========================================================
   HERO CTA: login gate + orb hover follow (SAFE)
   - KENDİ isLoggedIn tanımlamaz
   - Mevcut window.isLoggedIn / window.openAuthModal / openModal kullanır
   ========================================================= */
(() => {
  const actions = document.querySelector(".hero-actions");
  if (!actions) return;

  const links = [...actions.querySelectorAll("a.btn")];

  function isAuthedSafe() {
    try {
      if (typeof window.isLoggedIn === "function") return window.isLoggedIn();
      if (window.isLoggedIn === true) return true;
      return localStorage.getItem("aivo_logged_in") === "1";
    } catch (_) {
      return false;
    }
  }

  function openLoginSafe() {
    if (typeof window.openAuthModal === "function") return window.openAuthModal("login");
    if (typeof window.openLoginModal === "function") return window.openLoginModal();
    if (typeof openModal === "function") return openModal("login");

    const modal = document.getElementById("loginModal");
    if (modal) {
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
      document.documentElement.classList.add("modal-open");
      return;
    }
  }

  // data-auth="required" CTA’larda navigation engelle + login aç
  actions.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a) return;

    if (a.getAttribute("data-auth") !== "required") return;

    if (!isAuthedSafe()) {
      e.preventDefault();
      e.stopPropagation();
      try {
     sessionStorage.setItem("aivo_after_login", normalizeStudio(a.getAttribute("href") || "/studio.v2.html"));
      } catch (_) {}
      openLoginSafe();
    }
  }, true);

  // Orb hover follow
  const orb = actions.querySelector(".cta-orb");
  if (!orb) return;

  function moveOrbTo(target) {
    const rA = actions.getBoundingClientRect();
    const rB = target.getBoundingClientRect();
    const x = (rB.left - rA.left) + (rB.width / 2);
    const y = (rB.top - rA.top) + (rB.height * 0.85);
    orb.style.transform = `translate(${x}px, ${y}px)`;
    orb.style.opacity = "1";
  }

  links.forEach((btn) => {
    btn.addEventListener("mouseenter", () => moveOrbTo(btn));
    btn.addEventListener("focus", () => moveOrbTo(btn));
  });

  actions.addEventListener("mouseleave", () => {
    const primary = actions.querySelector(".btn-primary");
    if (primary) moveOrbTo(primary);
    else orb.style.opacity = "0";
  });

  const primary = actions.querySelector(".btn-primary");
  if (primary) moveOrbTo(primary);
})();

/* =========================================================
   TOPBAR USER / ADMIN PANEL — TOGGLE + LOGOUT (SINGLE)
   ========================================================= */
(() => {
  if (window.__AIVO_USER_PANEL__) return;
  window.__AIVO_USER_PANEL__ = true;

  function getBtn(){ return document.getElementById("btnUserMenuTop"); }
  function getPanel(){ return document.getElementById("userMenuPanel"); }
  function getLogout(){ return document.getElementById("btnLogoutUnified"); }

  function openPanel(btn, panel){
    panel.classList.add("is-open");
    btn.setAttribute("aria-expanded","true");
  }
  function closePanel(btn, panel){
    panel.classList.remove("is-open");
    btn.setAttribute("aria-expanded","false");
  }

  function init(){
    const btn = getBtn();
    const panel = getPanel();
    const logoutBtn = getLogout();
    if (!btn || !panel) return false;

    // Aç / Kapa
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      panel.classList.contains("is-open") ? closePanel(btn,panel) : openPanel(btn,panel);
    });

    // Panel içi tıklamalar
    panel.addEventListener("click", (e) => e.stopPropagation());

    // Dışarı tıklayınca kapat
    document.addEventListener("click", () => closePanel(btn,panel));

    // ESC ile kapat
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closePanel(btn,panel);
    });

    // Logout
    if (logoutBtn){
      logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (typeof window.AIVO_LOGOUT === "function") { window.AIVO_LOGOUT(); return; }
        if (typeof window.aivoLogout === "function")  { window.aivoLogout(); return; }
        if (typeof window.logout === "function")      { window.logout(); return; }

        // Fallback — AUTH ONLY
        try{
          ["aivo_logged_in","aivo_user_email","aivo_auth","aivo_token","aivo_user"]
            .forEach(k => { try { localStorage.removeItem(k); } catch(_){} });
          ["__AIVO_FORCE_LOGOUT__","aivo_auth_target","aivo_redirect_after_login"]
            .forEach(k => { try { sessionStorage.removeItem(k); } catch(_){} });
        }catch(_){}

        window.location.href = "/";
      });
    }

    return true;
  }

  // include gecikmesi varsa 2sn dene
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      if (init()) return;
      let tries = 0;
      const t = setInterval(() => {
        tries++;
        if (init() || tries > 20) clearInterval(t);
      }, 100);
    });
  } else {
    if (init()) return;
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (init() || tries > 20) clearInterval(t);
    }, 100);
  }
})();



/* =========================================================
   ✅ PRODUCTS dropdown click (GATE OVERRIDE / CAPTURE)
   - capture=true: başka handler'ları ezer
   - login yoksa: Studio'ya GİTMEZ, login açar
   ========================================================= */
(function bindProductsNav(){
  if (window.__AIVO_PRODUCTS_NAV_GATE__) return;
  window.__AIVO_PRODUCTS_NAV_GATE__ = true;
   function safeOpenLogin(){
  try{
    if (typeof window.openLoginModal === "function") { window.openLoginModal(); return; }
    if (typeof window.openAuthModal  === "function") { window.openAuthModal("login"); return; }
    if (typeof window.openModal      === "function") { window.openModal("login"); return; }
    const btn = document.getElementById("btnLoginTop");
    if (btn) { btn.click(); return; }
  }catch(_){}
}

document.addEventListener("click", async (e) => {
    const card = e.target && e.target.closest ? e.target.closest(".product-card[data-product]") : null;
    if (!card) return;

    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

    const product = (card.getAttribute("data-product") || "").trim();
    if (!product) return;

   const isStudio =
  /\/studio(\.html)?$/i.test(location.pathname) ||
  /\/studio\.v2\.html$/i.test(location.pathname) ||
  /studio\.html/i.test(location.href) ||
  /studio\.v2\.html/i.test(location.href);

    function safeIsLoggedIn(){
      try{
        // ✅ gerçek auth için daha sağlam kontrol
        if (localStorage.getItem("aivo_logged_in") === "1") return true;
        if ((localStorage.getItem("aivo_user_email") || "").trim()) return true;
        if ((localStorage.getItem("aivo_token") || "").trim()) return true;
        if ((localStorage.getItem("aivo_user") || "").trim()) return true;
        return false;
      }catch(_){ return false; }
    }

    function safeOpenLogin(){
      try{
        if (typeof window.openLoginModal === "function") { window.openLoginModal(); return; }
        if (typeof window.openAuthModal  === "function") { window.openAuthModal("login"); return; }
        if (typeof window.openModal      === "function") { window.openModal("login"); return; }
        const btn = document.getElementById("btnLoginTop");
        if (btn) { btn.click(); return; }
      }catch(_){}
    }

    const map = { music: "music", cover: "cover", video: "video" };
    const page = map[product] || product;

  if (!isStudio && !(await safeIsLoggedInServer())) {
   try { sessionStorage.setItem("aivo_after_login", "/studio.v2.html#" + encodeURIComponent(page)); } catch(_) {}
      safeOpenLogin();
      return;
    }

    try { localStorage.setItem("aivo_product_target", product); } catch(_) {}

    if (!isStudio) {
      const suffix = (location.search || "") + (location.hash || "");
     location.href = "/studio.v2.html#" + encodeURIComponent(page);
      return;
    }

    if (typeof window.AIVO_SWITCH_PAGE === "function") {
      window.AIVO_SWITCH_PAGE(page);
      try { localStorage.removeItem("aivo_product_target"); } catch(_) {}
    }
  }, true);
})();

/* =========================================================
   ✅ Pricing'ten gelen yönlendirme: ?auth=1 ise login modalını aç (FINAL / SAFE)
   - Login VARSA: modal açmaz, sadece auth paramını temizler
   - return paramını saklar (login sonrası yönlendirme için)
   ========================================================= */
(function () {
  if (window.__AIVO_PRICING_AUTH_REDIRECT__) return;
  window.__AIVO_PRICING_AUTH_REDIRECT__ = true;

  function isAuthed() {
    try {
      // ✅ hem token bazlı, hem legacy flag/email bazlı kapsayıcı
      if (localStorage.getItem("aivo_logged_in") === "1") return true;
      if ((localStorage.getItem("aivo_user_email") || "").trim()) return true;

      return !!(
        localStorage.getItem("aivo_user") ||
        localStorage.getItem("aivo_auth") ||
        localStorage.getItem("aivo_session") ||
        localStorage.getItem("aivo_token") ||
        localStorage.getItem("token")
      );
    } catch (_) {
      return false;
    }
  }

  function run() {
    try {
      const url = new URL(window.location.href);
      const p = url.searchParams;

      if (p.get("auth") !== "1") return;

      const ret = p.get("return");
      if (ret) {
        try { sessionStorage.setItem("aivo_return_after_login", ret); } catch(_) {}
      }

      if (!isAuthed()) {
        if (typeof window.openAuthModal === "function") {
          window.openAuthModal("login");
        } else if (typeof window.openLoginModal === "function") {
          window.openLoginModal();
        } else {
          const btn = document.getElementById("btnLoginTop");
          if (btn) btn.click();
        }
      }

      p.delete("auth");
      const newQs = p.toString();
      const newUrl = url.pathname + (newQs ? ("?" + newQs) : "") + url.hash;
      history.replaceState({}, "", newUrl);

    } catch (_) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();



/* =========================================================
   ✅ TOPBAR USER MENU — BULLETPROOF (Kurumsal + Index)
   - btnUserMenuTop tık/pointerdown ile menü aç/kapa
   - dışarı tık + ESC kapatır
   - başka document click closer'ları menüyü anında kapatmasın diye:
     capture + stopImmediatePropagation kullanır
   - include ile sonradan gelse bile çalışır (delegated)
   ========================================================= */
(function AIVO_TopbarUserMenu_Bulletproof(){
  if (window.__AIVO_TOPBAR_USERMENU_FIX_V1__) return;
  window.__AIVO_TOPBAR_USERMENU_FIX_V1__ = true;

  function getAuthUser(){ return document.getElementById("authUser"); }
  function getBtn(){ return document.getElementById("btnUserMenuTop"); }
  function getMenu(){ return document.getElementById("topUserMenu"); }

  function setOpen(open){
    const authUser = getAuthUser();
    const btn = getBtn();
    const menu = getMenu();
    if (!authUser || !btn || !menu) return;

    if (open){
      authUser.classList.add("is-open");
      btn.setAttribute("aria-expanded","true");
      menu.style.display = "block";
      menu.setAttribute("aria-hidden","false");
    } else {
      authUser.classList.remove("is-open");
      btn.setAttribute("aria-expanded","false");
      menu.style.display = "none";
      menu.setAttribute("aria-hidden","true");
    }
  }

  function isOpen(){
    const authUser = getAuthUser();
    return !!(authUser && authUser.classList.contains("is-open"));
  }

  function toggle(){
    setOpen(!isOpen());
  }

  // ✅ iPad/Safari: click yerine pointerdown daha stabil (menü “anında kapanma” bug’ını keser)
  document.addEventListener("pointerdown", function(e){
    const btn = e.target && e.target.closest ? e.target.closest("#btnUserMenuTop") : null;
    const menu = e.target && e.target.closest ? e.target.closest("#topUserMenu") : null;

    // Buton
    if (btn){
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
      toggle();
      return;
    }

    // Menü içi tık -> kapatma
    if (menu) return;

    // Dışarı -> kapat
    if (isOpen()) setOpen(false);
  }, true); // capture

  // ESC kapatır
  document.addEventListener("keydown", function(e){
    if (e.key === "Escape" && isOpen()) setOpen(false);
  });

  // Sayfa ilk açılışta menü kapalı garanti
  document.addEventListener("DOMContentLoaded", function(){
    const menu = getMenu();
    if (menu){
      menu.style.display = "none";
      menu.setAttribute("aria-hidden","true");
    }
    const btn = getBtn();
    if (btn) btn.setAttribute("aria-expanded","false");
  });
})();
/* =========================================================
   AIVO — AVATAR INITIAL SYNC (SAFE)
   ========================================================= */
(function AIVO_syncAvatarInitial_SAFE(){
  if (window.__AIVO_AVATAR_SYNC_ATTACHED__) return;
  window.__AIVO_AVATAR_SYNC_ATTACHED__ = true;

  function pickText(sel){
    var el = document.querySelector(sel);
    return el && el.textContent ? String(el.textContent).trim() : "";
  }

  function pickEmailFromStorage(){
    try {
      if (typeof EMAIL_KEY !== "undefined" && EMAIL_KEY) {
        const e = String(localStorage.getItem(EMAIL_KEY) || "").trim();
        if (e) return e;
      }
      const u = JSON.parse(localStorage.getItem("aivo_user") || "null");
      if (u?.email) return String(u.email).trim();
      const t = localStorage.getItem("aivo_user_email");
      if (t) return String(t).trim();
    } catch(_){}
    return "";
  }

  function computeInitial(){
    var name  = pickText("#umName") || pickText("#topUserName");
    var email = pickText("#umEmail") || pickText("#topUserEmail") || pickEmailFromStorage();

    var src = (name || email || "").trim();
    if (!src) return "";

    var ch = src.charAt(0).toUpperCase();
    if (ch === "?" || ch === "@") return "";
    return ch;
  }

  function applyInitial(){
    var initial = computeInitial();
    var topEl = document.querySelector("#topUserInitial");
    var umEl  = document.querySelector("#umAvatar");

    if (!topEl && !umEl) return false;

    if (topEl) topEl.textContent = initial;
    if (umEl)  umEl.textContent  = initial;

    return !!initial;
  }

  function run(){
    if (applyInitial()) return;

    var tries = 0;
    var maxTries = 20;
    var t = setInterval(function(){
      tries++;
      if (applyInitial() || tries >= maxTries) clearInterval(t);
    }, 150);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();

/* =========================================================
   AIVO — TOPBAR NAME SYNC (SAFE)
   - Sets #topUserName from panel (#umName) or email.
   - Keeps "Hesap" only as last fallback.
   ========================================================= */
(function AIVO_syncTopbarName_SAFE(){
  if (window.__AIVO_TOPNAME_SYNC_ATTACHED__) return;
  window.__AIVO_TOPNAME_SYNC_ATTACHED__ = true;

  function pickText(sel){
    var el = document.querySelector(sel);
    return el && el.textContent ? String(el.textContent).trim() : "";
  }

  function pickEmailFromStorage(){
    try {
      if (typeof EMAIL_KEY !== "undefined" && EMAIL_KEY) {
        const e = String(localStorage.getItem(EMAIL_KEY) || "").trim();
        if (e) return e;
      }
      const u = JSON.parse(localStorage.getItem("aivo_user") || "null");
      if (u?.email) return String(u.email).trim();
      const t = localStorage.getItem("aivo_user_email");
      if (t) return String(t).trim();
    } catch(_){}
    return "";
  }

  function computeDisplayName(){
    var name  = pickText("#umName");
    var email = pickText("#umEmail") || pickText("#topUserEmail") || pickEmailFromStorage();

    if (name) return name;
    if (email) return email;
    return "";
  }

  function applyName(){
    var topNameEl = document.querySelector("#topUserName");
    if (!topNameEl) return false;

    var v = computeDisplayName();
    if (!v) return false;

    var cur = String(topNameEl.textContent || "").trim();
    if (!cur || cur === "Hesap" || cur === "Account" || cur === "—") {
      topNameEl.textContent = v;
    }
    return true;
  }

  function run(){
    if (applyName()) return;

    var tries = 0;
    var maxTries = 20;
    var t = setInterval(function(){
      tries++;
      if (applyName() || tries >= maxTries) clearInterval(t);
    }, 150);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();

/* =========================================================
   AIVO — GLOBAL BUY ROUTER (NON-STUDIO) — FINAL (SAFE)
   ========================================================= */
(function AIVO_GlobalBuyRouter_FINAL(){
  if (window.__AIVO_GLOBAL_BUY_ROUTER__) return;
  window.__AIVO_GLOBAL_BUY_ROUTER__ = true;

  var PATH = (location.pathname || "").toLowerCase();
  if (PATH.indexOf("/studio") === 0) return; // studio hariç

  var HUB = "/fiyatlandirma.html#packs";
  var HUB_BASE = "/fiyatlandirma.html";

  function normalizePack(p){
    p = (p || "").toString().trim().toLowerCase();
    if (!p) return "";
    if (p === "standart") return "standard";
    if (p === "baslangic") return "starter";
    if (p === "pro") return "pro";
    if (p === "mega") return "mega";
    return p;
  }

  function buildTarget(pack){
    pack = normalizePack(pack);
    return pack ? (HUB_BASE + "?pack=" + encodeURIComponent(pack) + "#packs") : HUB;
  }

  function samePageIsPricing(){
    return PATH === "/fiyatlandirma.html" || PATH === "/fiyatlandirma";
  }

  function goToHub(e, pack){
    try { if (e) e.preventDefault(); } catch(_) {}

    pack = normalizePack(pack);
    if (pack) { try { sessionStorage.setItem("aivo_preselect_pack", pack); } catch(_) {} }

    if (samePageIsPricing()) {
      try { location.hash = "packs"; } catch(_) {}
      try {
        var el = document.getElementById("packs");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch(_) {}
      return;
    }

    try { window.location.href = buildTarget(pack); } catch(_) {}
  }

  function closest(el, sel){
    return (el && el.closest) ? el.closest(sel) : null;
  }

  document.addEventListener("click", function(e){
    try{
      if (!e || !e.target) return;
      var t = e.target;

      // 1) Standart tetik: data-open-pricing
      var op = closest(t, "[data-open-pricing]");
      if (op) {
        var pack1 = op.getAttribute("data-pack") || op.getAttribute("data-buy-plan") || op.dataset.pack || op.dataset.buyPlan || "";
        return goToHub(e, pack1);
      }

      // 2) Legacy butonlar
      var legacy = closest(t, ".btn-credit-buy, #btnBuyCredits, #btnOpenPricing, #creditsButton, [data-action='open-pricing']");
      if (legacy) {
        var pack2 = legacy.getAttribute("data-pack") || legacy.getAttribute("data-buy-plan") || legacy.dataset.pack || legacy.dataset.buyPlan || "";
        return goToHub(e, pack2);
      }

      // 3) Pack taşıyan SATIN AL / CTA butonları (GENEL [data-pack] değil!)
      var packBtn = closest(t, "[data-pack][data-buy], [data-pack][data-open-pricing], button[data-pack], a[data-pack].buy, .p-btn[data-pack]");
      if (packBtn) {
        var pack3 = packBtn.getAttribute("data-pack") || "";
        return goToHub(e, pack3);
      }

    } catch(err){
      console.warn("[AIVO] GlobalBuyRouter error:", err);
    }
  }, true);

})();

/* =========================================================
   AIVO — AUTH CORE (SINGLE SOURCE)
   - exports: window.isAuthed(), window.openAuthModal(mode), window.closeAuthModal()
   - uses: #loginModal + data-mode="login|register"
   ========================================================= */
(function AIVO_AUTH_CORE_SINGLE(){
  if (window.__AIVO_AUTH_CORE_SINGLE__) return;
  window.__AIVO_AUTH_CORE_SINGLE__ = true;

  function getModal(){
    return document.getElementById("loginModal");
  }

  // ✅ SINGLE SOURCE login check
  window.isAuthed = function(){
    try {
      if (localStorage.getItem("aivo_logged_in") === "1") return true;
      if (localStorage.getItem("aivo_token")) return true;
      if (localStorage.getItem("aivo_auth")) return true;
      if (localStorage.getItem("aivo_user")) return true;
      if (typeof window.isLoggedIn === "function") return !!window.isLoggedIn();
      return false;
    } catch(_) { return false; }
  };

  // ✅ OPEN (mode: "login" | "register")
  window.openAuthModal = function(mode){
    // Eğer projede zaten openModal/closeModal varsa önce onu kullan
    if (typeof window.openModal === "function") return window.openModal(mode);

    const m = getModal();
    if (!m) return;

    m.setAttribute("data-mode", mode === "register" ? "register" : "login");
    m.classList.add("is-open");
    m.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    document.documentElement.classList.add("modal-open");
  };

  // ✅ CLOSE
  window.closeAuthModal = function(){
    if (typeof window.closeModal === "function") return window.closeModal();

    const m = getModal();
    if (!m) return;

    m.classList.remove("is-open");
    m.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    document.documentElement.classList.remove("modal-open");
  };
})();

/* =========================================================
   AIVO — AUTH SUBMIT (SINGLE BLOCK / SINGLE BIND) [FIXED]
   - Button: #btnAuthSubmit
   - Mode:   #loginModal[data-mode="login|register"]
   - Register: POST /api/auth/register
   - Login:    POST /api/auth/login
   ========================================================= */
(() => {
  if (window.__AIVO_AUTH_SUBMIT_SINGLE__) return;
  window.__AIVO_AUTH_SUBMIT_SINGLE__ = true;

  const MAX_MS = 15000;
  const start = Date.now();

  const wait = (cb) => {
    (function tick() {
      const modal = document.getElementById("loginModal");
      const btn   = document.getElementById("btnAuthSubmit");
      if (modal && btn) return cb(modal, btn);
      if (Date.now() - start > MAX_MS) return;
      setTimeout(tick, 150);
    })();
  };

  // ✅ [object Object] ve boş/garip mesajları temizler
  const safeMsg = (x) => {
    try {
      if (x == null) return "";
      if (typeof x === "string") return x;
      if (typeof x.message === "string") return x.message;
      if (typeof x.error === "string") return x.error;
      return JSON.stringify(x);
    } catch (_) {
      return String(x);
    }
  };

  wait((modal, btn) => {
    if (btn.__aivoBound === true) return;
    btn.__aivoBound = true;

    const qs = (id) => document.getElementById(id);
    const v  = (id) => (qs(id)?.value || "").trim();
    const on = (id) => !!qs(id)?.checked;

    const getMode = () =>
      String(modal.getAttribute("data-mode") || "login").toLowerCase();

    const setBusy = (busy, text) => {
      btn.disabled = !!busy;
      if (text != null) btn.textContent = text;
    };

    const isValidEmail = (email) =>
      !!email && email.includes("@") && email.includes(".") && email.length >= 6;

    async function doRegister() {
      const email = v("loginEmail").toLowerCase();
      const pass  = v("loginPass");
      const name  = v("registerName");
      const pass2 = v("registerPass2");
      const kvkk  = on("kvkkOk");

    if (!isValidEmail(email)) {
  window.toast.error("Lütfen geçerli bir email gir.");
  return;
}

if (!name) {
  window.toast.error("Lütfen ad soyad gir.");
  return;
}

if (!pass || pass.length < 6) {
  window.toast.error("Şifre en az 6 karakter olmalı.");
  return;
}

if (pass2 && pass2 !== pass) {
  window.toast.error("Şifreler uyuşmuyor.");
  return;
}

if (!kvkk) {
  window.toast.warning("KVKK ve şartları kabul etmelisin.");
  return;
}

      const old = btn.textContent;
      setBusy(true, "Gönderiliyor...");

      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ email, password: pass, name })
        });

        const text = await res.text();
        let data = {};
        try { data = JSON.parse(text); } catch (_) {}

        if (!res.ok) {
          window.toast.error(safeMsg(data?.error || data?.message || text || "Kayıt başarısız."));
return;


      window.toast.success(safeMsg(data?.message || "Kayıt başarılı! Şimdi giriş yapabilirsin."));


        modal.setAttribute("data-mode", "login");
        try { qs("registerPass2").value = ""; } catch(_) {}
        try { qs("kvkkOk").checked = false; } catch(_) {}

        setBusy(false, "Giriş Yap");
        setTimeout(() => { try { qs("loginPass")?.focus(); } catch(_){} }, 50);

      } catch (err) {
        window.toast.error("Bağlantı hatası. Tekrar dene.");

      } finally {
        const mode = getMode();
        setBusy(false, mode === "register" ? "Hesap Oluştur" : "Giriş Yap");
      }
    }

    async function doLogin() {
      const email = v("loginEmail").toLowerCase();
      const pass  = v("loginPass");
     if (!isValidEmail(email) || !pass) {
  window.toast.warning("E-posta ve şifre gir.");
  return;
}


      const old = btn.textContent;
      setBusy(true, "Giriş yapılıyor...");

      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ email, password: pass })
        });

const text = await res.text();
let data = {};
try { data = JSON.parse(text); } catch (_) {}

if (!res.ok || data?.ok === false) {
  window.toast.error(
    safeMsg(data?.error || data?.message || text || "Giriş başarısız.")
  );
  return;
}
// ✅ LOGIN SUCCESS — URL TOAST (storage'siz kesin çözüm)
try { localStorage.setItem("aivo_logged_in", "1"); } catch (_) {}
try { localStorage.setItem("aivo_user_email", data?.user?.email || email); } catch (_) {}
if (data?.token) { try { localStorage.setItem("aivo_token", data.token); } catch (_) {} }

try {
  if (typeof window.closeAuthModal === "function") window.closeAuthModal();
  else { modal.classList.remove("is-open"); modal.setAttribute("aria-hidden","true"); }
} catch (_) {}

const msg = encodeURIComponent("Girişiniz başarılı");
window.location.href = `/studio.v2.html?tf=success&tm=${msg}`;
return;
} catch (err) {
  window.toast.error("Bağlantı hatası. Tekrar dene.");
} finally {
  setBusy(false, old || "Giriş Yap");
}
} // doLogin BİTTİ
