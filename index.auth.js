// ✅ Hard guard: aynı dosya 2 kez yüklense bile init tekrar çalışmasın
if (window.__AIVO_INDEX_AUTH_JS_LOADED__) {
  console.warn("[AIVO] index.auth.js already loaded — hard skip");
} else {
  window.__AIVO_INDEX_AUTH_JS_LOADED__ = true;
}

/* =========================================================
   AIVO — INDEX AUTH (CLEAN / SINGLE SOURCE OF TRUTH)
   - Topbar IDs: #btnLoginTop / #btnRegisterTop / #btnLogoutTop
   - UI Boxes:  #authGuest / #authUser / #topUserEmail
   - Gate: a[data-auth="required"] -> login yoksa modal aç
   - Demo login: harunerkezen@gmail.com / 123456
   - Redirect: /studio.html
   - Target key: sessionStorage["aivo_after_login"]
   - Exports for studio.guard.js:
       window.isLoggedIn
       window.openLoginModal
       window.rememberTarget
   ========================================================= */

console.log("[AIVO] index.auth.js LOADED ✅", new Date().toISOString());

/* ✅ Duplicate-safe DEMO_AUTH (script iki kez çalışsa bile patlamaz) */
window.DEMO_AUTH = window.DEMO_AUTH || {
  email: "harunerkezen@gmail.com",
  pass: "123456"
};

/* ✅ Sabitler (duplicate-safe) */
window.AIVO_AUTH_KEYS = window.AIVO_AUTH_KEYS || {
  TARGET_KEY: "aivo_after_login",
  LOGIN_KEY:  "aivo_logged_in",
  EMAIL_KEY:  "aivo_user_email"
};
// ✅ Duplicate-safe global bindings (dosya 2 kez yüklense bile patlamaz)
var TARGET_KEY = window.AIVO_AUTH_KEYS.TARGET_KEY;
var LOGIN_KEY  = window.AIVO_AUTH_KEYS.LOGIN_KEY;
var EMAIL_KEY  = window.AIVO_AUTH_KEYS.EMAIL_KEY;

/* =========================
   AUTH STATE (FINAL – Studio + Kurumsal ortak)
   ========================= */

function isLoggedIn() {
  try {
    // ✅ Ana kaynak (senin sistemin)
    if (localStorage.getItem(LOGIN_KEY) === "1") return true;

    // ✅ Yedek: email varsa login kabul et (token yokken)
    if (localStorage.getItem(EMAIL_KEY)) return true;

    return false;
  } catch (_) {
    return false;
  }
}

function setLoggedIn(v) {
  try {
    localStorage.setItem(LOGIN_KEY, v ? "1" : "0");
  } catch (_) {}
}


/* =========================
   MODAL FINDER
   (senin projede farklı id/class olabiliyor diye esnek)
   ========================= */
function getModalEl() {
  return (
    document.getElementById("loginModal") ||
    document.getElementById("authModal") ||
    document.querySelector('[data-modal="login"]') ||
    document.querySelector(".login-modal") ||
    null
  );
}

function openModal(mode /* "login" | "register" */) {
  const m = getModalEl();
  if (!m) {
    console.warn("[AIVO] Login modal bulunamadı. (#loginModal/#authModal/[data-modal='login']/.login-modal)");
    return;
  }
  m.classList.add("is-open");
  m.setAttribute("aria-hidden", "false");
  m.setAttribute("data-mode", mode === "register" ? "register" : "login");
  document.body.classList.add("modal-open");

  // focus
  setTimeout(() => {
    const email = document.getElementById("loginEmail") || m.querySelector('input[type="email"]');
    if (email && typeof email.focus === "function") email.focus();
  }, 30);
}

function closeModal() {
  const m = getModalEl();
  if (!m) return;
  m.classList.remove("is-open");
  m.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

/* =========================
   TARGET / REDIRECT
   ========================= */
function normalizeStudio(url) {
  const u = (url || "/studio.html").trim();
  // studio dışına hedef yazıldıysa bile güvenli normalize
  if (u.includes("/studio")) return "/studio.html";
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
    sessionStorage.setItem(TARGET_KEY, url || "/studio.html");
  } catch (_) {}
}

function goAfterLogin() {
  const raw = sessionStorage.getItem(TARGET_KEY) || "/studio.html";
  sessionStorage.removeItem(TARGET_KEY);
  location.href = normalizeStudio(raw);
}

/* =========================
   TOPBAR UI SYNC (FINAL)
   ========================= */
function syncTopbarAuthUI() {
  const guestBox = document.getElementById("authGuest");
  const userBox  = document.getElementById("authUser");

  const email = localStorage.getItem(EMAIL_KEY) || "";
  const loggedIn = isLoggedIn();

  // Ana görünürlük
  if (guestBox) guestBox.style.display = loggedIn ? "none" : "flex";
  if (userBox)  userBox.style.display  = loggedIn ? "flex" : "none";

  // User alanları
  const topUserEmail = document.getElementById("topUserEmail");
  const topMenuEmail = document.getElementById("topMenuEmail");
  const topMenuName  = document.getElementById("topMenuName");

  if (loggedIn) {
    if (topUserEmail) topUserEmail.textContent = email;
    if (topMenuEmail) topMenuEmail.textContent = email;
    if (topMenuName)  topMenuName.textContent  = email.split("@")[0] || "Hesap";
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
  const maxTries = 30;         // ~3sn (100ms * 30)
  const intervalMs = 100;

  function hasTopbarDom(){
    return !!(
      document.getElementById("authGuest") ||
      document.getElementById("authUser")  ||
      document.getElementById("btnLoginTop") ||
      document.getElementById("btnRegisterTop") ||
      document.getElementById("btnLogoutTop")
    );
  }

  function tick(){
    tries++;
    try { syncTopbarAuthUI(); } catch(_){}

    // Elemanlar geldiyse bitir
    if (hasTopbarDom()) return;

    // Çok denedik, bırak
    if (tries >= maxTries) return;

    setTimeout(tick, intervalMs);
  }

  tick();

  // Ayrıca DOM’a sonradan eklenirse yakala (include inject)
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
  // ✅ Studio logout handshake: vitrin açılır açılmaz kesin logout uygula
  if (sessionStorage.getItem("__AIVO_FORCE_LOGOUT__") === "1") {
    try {
      // ✅ SADECE AUTH / USER kimlik anahtarlarını temizle
      // ❌ KREDİ / FATURA / STORE ASLA SİLİNMEZ
      [
        "aivo_logged_in",
        "aivo_user_email",
        "aivo_auth",
        "aivo_token",
        "aivo_user"
      ].forEach((k) => {
        try { localStorage.removeItem(k); } catch (_) {}
      });

      // ✅ handshake bayrağını kaldır (tekrar tetiklenmesin)
      try { sessionStorage.removeItem("__AIVO_FORCE_LOGOUT__"); } catch (_) {}

      // Not: sessionStorage.clear() yapmıyoruz, sadece bayrağı siliyoruz.
    } catch (_) {}
  }

  // UI’yi her durumda güncelle
  try { syncTopbarAuthUI(); } catch (_) {}
});


/* =========================================================
   CLICK ROUTER (tek yerden) — FINAL (STORE KORUNUR)
   - Logout sadece auth oturumunu temizler
   - aivo_store_v1 / invoices KESİNLİKLE SİLİNMEZ
   ========================================================= */

// ✅ Logout'ta SADECE oturum anahtarlarını temizle (kredi/store değil)
const AUTH_KEYS_TO_CLEAR = [
  "aivo_logged_in",     // 🔴 oturum flag
  "aivo_user_email",    // 🔴 kullanıcı
  "aivo_auth",
  "aivo_token",
  "aivo_user"
  // ❌ "aivo_credits" (legacy) -> istersen kalsın ama genelde gerek yok
  // ❌ "aivo_store_v1" -> ASLA SİLME (kredi + fatura burada)
];

// sessionStorage'da da her şeyi silme; sadece hedef/flag sil
const SESSION_KEYS_TO_CLEAR = [
  "__AIVO_FORCE_LOGOUT__",     // varsa
  "aivo_auth_target"           // login sonrası dönüş hedefi
];

window.AIVO_LOGOUT = function () {
  // 1) auth temizle
  AUTH_KEYS_TO_CLEAR.forEach((k) => {
    try { localStorage.removeItem(k); } catch (_) {}
  });

  // 2) session: sadece gerekli olanları temizle
  SESSION_KEYS_TO_CLEAR.forEach((k) => {
    try { sessionStorage.removeItem(k); } catch (_) {}
  });

  // 3) UI refresh (vitrin)
  try { if (typeof syncTopbarAuthUI === "function") syncTopbarAuthUI(); } catch (_) {}

  // 4) vitrine dön
  location.href = "/";
};

document.addEventListener("click", (e) => {
  const t = e.target;

  // Topbar: login/register
  const loginTop = t.closest("#btnLoginTop");
  if (loginTop) {
    e.preventDefault();
    openModal("login");
    return;
  }

  const regTop = t.closest("#btnRegisterTop");
  if (regTop) {
    e.preventDefault();
    openModal("register");
    return;
  }

  // ✅ Logout (topbar + admin/studio menü)
  const logout = t.closest("#btnLogoutTop, [data-action='logout'], .logout");
  if (logout) {
    e.preventDefault();
    window.AIVO_LOGOUT();
    return;
  }

  // Gate: data-auth required link
  const a = t.closest('a[data-auth="required"]');
  if (a) {
    if (isLoggedIn()) return;
    e.preventDefault();
    rememberTargetFromAnchor(a);
    openModal("login");
    return;
  }

  // Modal close (X / backdrop / data-close)
  const m = getModalEl();
  if (m) {
    const isBackdrop =
      (t === m) ||
      t.classList?.contains("login-backdrop") ||
      !!t.closest(".login-backdrop");

    const isClose =
      !!t.closest(".login-x") ||
      !!t.closest(".modal-close") ||
      !!t.closest("[data-close]");

    if (isBackdrop || isClose) {
      e.preventDefault();
      closeModal();
      return;
    }
  }
});

// ESC closes modal
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});


/* =========================================================
   DEMO LOGIN (modal içindeki #btnLogin)
   ========================================================= */
document.addEventListener("click", (e) => {
  const btn = e.target.closest("#btnLogin");
  if (!btn) return;

  const m = getModalEl();
  if (!m) return;

  e.preventDefault();

  const email =
    (document.getElementById("loginEmail")?.value ||
      m.querySelector('input[type="email"]')?.value ||
      "")
      .trim()
      .toLowerCase();

  const pass =
    (document.getElementById("loginPass")?.value ||
      m.querySelector('input[type="password"]')?.value ||
      "")
      .trim();

  if (email === DEMO_AUTH.email && pass === DEMO_AUTH.pass) {
    setLoggedIn(true);
    localStorage.setItem(EMAIL_KEY, email);
    syncTopbarAuthUI();
    closeModal();
    goAfterLogin();
    return;
  }

  alert("E-posta veya şifre hatalı (demo).");
});

/* Google demo (modal içindeki #btnGoogleLogin varsa) */
document.addEventListener("click", (e) => {
  const btn = e.target.closest("#btnGoogleLogin");
  if (!btn) return;
  e.preventDefault();
  setLoggedIn(true);
  localStorage.setItem(EMAIL_KEY, "google-user@demo");
  syncTopbarAuthUI();
  closeModal();
  goAfterLogin();
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

    const email =
      localStorage.getItem("aivo_user_email") ||
      localStorage.getItem("user_email") ||
      localStorage.getItem("email");

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
    const j = await r.json();

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
window.openLoginModal = function () { openModal("login"); };
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
 

  // 2) Tap ile seç (iPad)
  cards.forEach(card => {
    card.addEventListener("touchstart", () => setActive(card), { passive: true });
    card.addEventListener("click", (e) => {
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
(() => {
  // HERO CTA: login gate + orb hover follow
  const actions = document.querySelector(".hero-actions");
  if (!actions) return;

  const links = [...actions.querySelectorAll("a.btn")];

  // ---- 1) Login kontrol fonksiyonu (mevcut sistemine uyumlu)
  function isLoggedIn() {
    // En sağlam: senin auth sistemin ne kullanıyorsa burayı ona uydur.
    // AIVO projende genelde token/uid vb. localStorage ile kontrol ediliyor.
    return !!(localStorage.getItem("aivo_user") || localStorage.getItem("aivo_token"));
  }

  // ---- 2) Login modal açma (mevcut modal fonksiyonuna bağlan)
  function openLoginModal() {
    // Eğer sende global bir fonksiyon varsa onu çağır:
    if (typeof window.openLoginModal === "function") {
      window.openLoginModal();
      return;
    }
    // Alternatif: DOM’daki modal id’si üzerinden aç
    const modal = document.getElementById("loginModal");
    if (modal) {
      modal.classList.add("is-open");
      modal.removeAttribute("aria-hidden");
      return;
    }
    // Son çare: login sayfasına yönlendir (istersen kapat)
    window.location.href = "/login.html";
  }

  // ---- 3) data-auth required olan CTA’larda scroll'u engelle + login aç
  actions.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a) return;

    const requires = a.getAttribute("data-auth") === "required";
    if (!requires) return;

    if (!isLoggedIn()) {
      e.preventDefault(); // ✅ en alta scroll etmesin
      openLoginModal();   // ✅ login panel açsın
    }
  });

  // ---- 4) Orb/ışığı hover edilen butona taşı
  const orb = actions.querySelector(".cta-orb");
  if (!orb) return;

  function moveOrbTo(target) {
    const rA = actions.getBoundingClientRect();
    const rB = target.getBoundingClientRect();

    // orb merkezini butonun alt-orta noktasına taşı (istersen ince ayar)
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
    // mouse çıkınca istersen Studio’ya geri dönsün
    const primary = actions.querySelector(".btn-primary");
    if (primary) moveOrbTo(primary);
    else orb.style.opacity = "0";
  });

  // ilk konum: Studio’ya Gir
  const primary = actions.querySelector(".btn-primary");
  if (primary) moveOrbTo(primary);
})();
  function doLogout(){
    try { KEYS.forEach(k => localStorage.removeItem(k)); } catch(e) {}
    window.location.assign("/");
  }

  // ✅ Handshake: Studio "/?logout=1" ile geldiyse burada kesin temizle
  (function consumeLogoutParam(){
    try{
      const url = new URL(window.location.href);
      if (url.searchParams.get("logout") === "1"){
        KEYS.forEach(k => localStorage.removeItem(k));
        url.searchParams.delete("logout");
        window.history.replaceState({}, "", url.pathname + url.search + url.hash);
      }
    }catch(e){}
  })();
/* =========================================================
   TOPBAR USER / ADMIN PANEL — TOGGLE + LOGOUT
   ========================================================= */
(() => {
  if (window.__AIVO_USER_PANEL__) return;
  window.__AIVO_USER_PANEL__ = true;

  const btn = document.getElementById("btnUserMenuTop");
  const panel = document.getElementById("userMenuPanel");
  const logoutBtn = document.getElementById("btnLogoutUnified");

  if (!btn || !panel) return;

  function openPanel(){
    panel.classList.add("is-open");
    btn.setAttribute("aria-expanded","true");
  }

  function closePanel(){
    panel.classList.remove("is-open");
    btn.setAttribute("aria-expanded","false");
  }

  function togglePanel(){
    panel.classList.contains("is-open") ? closePanel() : openPanel();
  }

  /* Aç / Kapa */
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    togglePanel();
  });

  /* Panel içi tıklamalar */
  panel.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  /* Dışarı tıklayınca kapat */
  document.addEventListener("click", () => {
    closePanel();
  });

  /* ESC ile kapat */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePanel();
  });

  /* ================= LOGOUT ================= */
if (logoutBtn){
  logoutBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Mevcut logout sistemini bozma
    if (typeof window.aivoLogout === "function") {
      window.aivoLogout();
      return;
    }

    if (typeof window.logout === "function") {
      window.logout();
      return;
    }

    // ✅ Fallback (gerekmez ama güvenlik) — AUTH ONLY (store/fatura silinmez)
    try{
      ["aivo_logged_in","aivo_user_email","aivo_auth","aivo_token","aivo_user"]
        .forEach(k => { try { localStorage.removeItem(k); } catch(_){} });

      ["__AIVO_FORCE_LOGOUT__","aivo_auth_target","aivo_redirect_after_login"]
        .forEach(k => { try { sessionStorage.removeItem(k); } catch(_){} });
    }catch(_){}

    window.location.href = "/";
  });
}

})();

/* =========================================================
   TOPBAR USER / ADMIN PANEL — DELEGATED TOGGLE + LOGOUT [BULLETPROOF]
   - ID şartı yok: #authUser içindeki butona tıklamayı yakalar
   - is-open sadece #authUser üzerinde
   ========================================================= */
(() => {
  if (window.__AIVO_USER_PANEL__) return;
  window.__AIVO_USER_PANEL__ = true;

  const authUser = document.getElementById("authUser");
  const panel    = document.getElementById("userMenuPanel");
  const logoutBtn= document.getElementById("btnLogoutUnified");

  // authUser veya panel yoksa bu sayfada user panel yok demektir
  if (!authUser || !panel) return;

  // Buton bazen id'siz olabiliyor; authUser içindeki ilk button'u anchor al
  const btn = document.getElementById("btnUserMenuTop") || authUser.querySelector("button");

  function isLoggedIn(){
    try{
      if (localStorage.getItem("aivo_logged_in") === "1") return true;
      if (localStorage.getItem("aivo_token")) return true;
      if (localStorage.getItem("aivo_user_email")) return true;
      if (localStorage.getItem("aivo_user")) return true;
      return false;
    }catch(_){ return false; }
  }

  function open(){
    if (!isLoggedIn()) return;
    authUser.classList.add("is-open");
    if (btn) btn.setAttribute("aria-expanded","true");
    panel.setAttribute("aria-hidden","false");
  }
  function close(){
    authUser.classList.remove("is-open");
    if (btn) btn.setAttribute("aria-expanded","false");
    panel.setAttribute("aria-hidden","true");
  }
  function toggle(){
    authUser.classList.contains("is-open") ? close() : open();
  }

  // Tıklama yakalama: authUser içindeki butona tıklanınca toggle
  document.addEventListener("click", (e) => {
    const clickedBtn = btn && (e.target === btn || e.target.closest("button") === btn);
    const insidePanel = e.target.closest("#userMenuPanel");

    if (clickedBtn){
      e.preventDefault();
      e.stopPropagation();
      toggle();
      return;
    }

    if (insidePanel) return; // panel içi tık -> kapatma

    // dışarı tık -> kapat
    close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  // Logout
  function clearAuthKeys(){
    ["aivo_logged_in","aivo_token","aivo_user","aivo_user_email","user"].forEach(k=>{
      try{ localStorage.removeItem(k); }catch(_){}
    });
  }

  if (logoutBtn){
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (typeof window.aivoLogout === "function") { window.aivoLogout(); return; }
      if (typeof window.logout === "function")     { window.logout(); return; }

      clearAuthKeys();
      close();
      if (typeof window.__AIVO_SYNC_AUTH_UI__ === "function") window.__AIVO_SYNC_AUTH_UI__();
      window.location.href = "/";
    });
  }
})();
/* =========================================================
   ✅ PRODUCTS dropdown click (GATE OVERRIDE / CAPTURE)
   - capture=true: başka handler'ları ezer
   - login yoksa: Studio'ya GİTMEZ, login açar
   ========================================================= */
(function bindProductsNav(){
  document.addEventListener("click", (e) => {
    const card = e.target && e.target.closest ? e.target.closest(".product-card[data-product]") : null;
    if (!card) return;

    // HER ZAMAN: başka click handler'ları durdur
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

    const product = (card.getAttribute("data-product") || "").trim();
    if (!product) return;

    const isStudio = /studio\.html/.test(location.pathname) || /studio\.html/.test(location.href);

    function safeIsLoggedIn(){
      try{
        const li = localStorage.getItem("aivo_logged_in") === "1";
        const em = !!(localStorage.getItem("aivo_user_email") || "").trim();
        return li && em;
      }catch(_){ return false; }
    }

    function safeOpenLogin(){
      try{
        if (typeof window.openLoginModal === "function") { window.openLoginModal(); return; }
        if (typeof openModal === "function") { openModal("login"); return; }
        const btn = document.getElementById("btnLoginTop");
        if (btn) { btn.click(); return; }
      }catch(_){}
    }

    const map = { music: "music", cover: "cover", video: "video" };
    const page = map[product] || product;

    // Vitrinde ve login yoksa: login aç, hedefi sakla, çık
    if (!isStudio && !safeIsLoggedIn()) {
      try { sessionStorage.setItem("aivo_after_login", "/studio.html?page=" + encodeURIComponent(page)); } catch(_) {}
      safeOpenLogin();
      return;
    }

    // Login varsa: Studio'ya git veya Studio içindeyse sayfa değiştir
    try { localStorage.setItem("aivo_product_target", product); } catch(_) {}

    if (!isStudio) {
      const suffix = (location.search || "") + (location.hash || "");
      location.href = "/studio.html?page=" + encodeURIComponent(page) + suffix;
      return;
    }

    if (typeof window.AIVO_SWITCH_PAGE === "function") {
      window.AIVO_SWITCH_PAGE(page);
      try { localStorage.removeItem("aivo_product_target"); } catch(_) {}
    }
  }, true); // ✅ CAPTURE MODE
})();


/* =========================================================
   ✅ Pricing'ten gelen yönlendirme: ?auth=1 ise login modalını aç (FINAL / SAFE)
   - Login VARSA: modal açmaz, sadece auth paramını temizler
   - return paramını saklar (login sonrası yönlendirme için)
   ========================================================= */
(function () {

  // 🔒 Login var mı? (index + studio farklı key yazsa bile kapsayıcı)
  function isAuthed() {
    try {
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

      // return parametresi varsa sakla
      const ret = p.get("return");
      if (ret) {
        try { sessionStorage.setItem("aivo_return_after_login", ret); } catch(_) {}
      }

      // ✅ Login zaten varsa: modal açma (en kritik fix)
      if (!isAuthed()) {
        // Modal aç: önce fonksiyon varsa onu dene, yoksa buton click
        if (typeof window.openAuthModal === "function") {
          window.openAuthModal("login");
        } else {
          const btn = document.getElementById("btnLoginTop");
          if (btn) btn.click();
        }
      }

      // ✅ SADECE auth paramını temizle (diğer query'ler kalsın)
      p.delete("auth");
      const newQs = p.toString();
      const newUrl = url.pathname + (newQs ? ("?" + newQs) : "") + url.hash;
      history.replaceState({}, "", newUrl);

    } catch (_) {}
  }

  // DOM hazır olunca çalıştır
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }

})();
/* =========================================================
   AUTH GATE — data-auth="required" tıklarını login'e bağlar
   - Logged out iken Studio'ya gitmeyi ENGELLER
   - Login modal açar
   - Hedef URL'yi saklar (login sonrası yönlendirme için)
   ========================================================= */
(function bindAuthGate() {
  function isAuthed() {
    try { return localStorage.getItem("aivo_logged_in") === "1"; } catch (_) {}
    return false;
  }

  function rememberTarget(href) {
    try { sessionStorage.setItem("aivo_redirect_after_login", href); } catch (_) {}
    try { localStorage.setItem("aivo_redirect_after_login", href); } catch (_) {}
  }

  function openLogin() {
    // senin projende hangisi varsa onu çalıştırır
    if (typeof window.openLoginModal === "function") return window.openLoginModal("login");
    if (typeof window.openAuthModal === "function") return window.openAuthModal("login");
    if (typeof window.showLogin === "function") return window.showLogin();
  }

  document.addEventListener("click", function (e) {
    const a = e.target && e.target.closest ? e.target.closest('a[data-auth="required"]') : null;
    if (!a) return;

    // zaten girişliyse serbest
    if (isAuthed()) return;

    // giriş yoksa: linke gitme, login aç
    e.preventDefault();
    e.stopPropagation();

    const href = a.getAttribute("href") || "/studio.html";
    rememberTarget(href);
    openLogin();
  }, true); // capture=true: navigation'dan önce yakalar
})();
/* =========================================================
   AUTO-LOGIN ON AUTOFILL (BEST EFFORT / SAFARI-SAFE-ish)
   - Modal açılınca inputları bulur (id şart değil)
   - Doluysa 1 kez login dener
   - Tarayıcı engellerse kullanıcı yine butona basar (fallback)
   ========================================================= */
(function autoLoginOnAutofill(){
  "use strict";

  function getModal(){
    return (
      document.getElementById("loginModal") ||
      document.getElementById("authModal") ||
      document.querySelector('[data-modal="login"]') ||
      document.querySelector(".login-modal")
    );
  }

  function isOpen(modal){
    if (!modal) return false;
    // senin sistem: aria-hidden=false veya is-open class
    const ah = modal.getAttribute("aria-hidden");
    return ah === "false" || modal.classList.contains("is-open");
  }

  function findFields(modal){
    const email = modal.querySelector('input[type="email"], input[name="email"], #loginEmail');
    const pass  = modal.querySelector('input[type="password"], input[name="password"], #loginPass');
    // buton: id varsa #btnLogin, yoksa form submit
    const btn   = modal.querySelector('#btnLogin, button[type="submit"], [data-action="login"]');
    return { email, pass, btn };
  }

  let tried = false;
  let lastTryAt = 0;

  function canTry(){
    const now = Date.now();
    if (now - lastTryAt < 1500) return false;
    lastTryAt = now;
    return true;
  }

  function attempt(modal){
    if (!modal || tried) return;
    const { email, pass, btn } = findFields(modal);
    if (!email || !pass || !btn) return;

    const e = String(email.value || "").trim();
    const p = String(pass.value || "");
    if (!e || !p) return;

    tried = true;

    // Bazı Safari durumlarında “anlık” değil, bir sonraki frame’de değer oturuyor
    requestAnimationFrame(() => {
      setTimeout(() => {
        try { btn.click(); } catch(_) {}
      }, 80);
    });
  }

  function startWatch(modal){
    if (!modal) return;

    // modal açıldığı an + kısa polling
    let t0 = Date.now();
    (function poll(){
      if (!isOpen(modal)) { tried = false; return; }   // kapandıysa reset
      attempt(modal);
      if (tried) return;
      if (Date.now() - t0 > 2500) return;
      setTimeout(poll, 120);
    })();
  }

  // Modal attribute değişince
  const modal = getModal();
  if (!modal) return;

  const obs = new MutationObserver(() => {
    if (isOpen(modal)) {
      if (canTry()) startWatch(modal);
    } else {
      tried = false;
    }
  });
  obs.observe(modal, { attributes: true, attributeFilter: ["aria-hidden","class","style"] });

  // input/focus olunca da dene
  modal.addEventListener("input", () => isOpen(modal) && canTry() && startWatch(modal), true);
  modal.addEventListener("focusin", () => isOpen(modal) && canTry() && startWatch(modal), true);

  // sayfa zaten modal açık gelirse
  if (isOpen(modal)) startWatch(modal);
})();
/* =========================================================
   ✅ "Studio hazırlanıyor…" Loading Overlay (CSS + JS) — SINGLE BLOCK
   - index.auth.js EN ALTINA ekle
   - HTML gerekmez (overlay DOM'a inject edilir)
   - Amaç: login/redirect 1–2sn gecikmeyi premium hissettirmek
   ========================================================= */
(function AIVO_LoadingOverlay(){
  "use strict";

  // ---- guards ----
  if (window.__aivoLoadingOverlayInit) return;
  window.__aivoLoadingOverlayInit = true;

  // ---- helpers ----
  function qs(sel, root){ return (root || document).querySelector(sel); }
  function now(){ return Date.now ? Date.now() : +new Date(); }

  // ---- config ----
  var OVERLAY_ID = "aivo-loading-overlay";
  var STYLE_ID   = "aivo-loading-overlay-style";
  var KEY_LAST_SHOW = "aivo_loading_last_show_v1";
  var SHOW_COOLDOWN_MS = 800;     // spam/loop engeli
  var FAILSAFE_HIDE_MS = 12000;   // takılı kalmasın

  function isStudioUrl(){
    var p = String(location.pathname || "").toLowerCase();
    var h = String(location.href || "").toLowerCase();
    return (
      p.indexOf("/studio") === 0 ||
      p.indexOf("studio.html") !== -1 ||
      h.indexOf("/studio") !== -1
    );
  }

  function getParam(name){
    try{
      var sp = new URLSearchParams(location.search || "");
      return sp.get(name);
    } catch(e){ return null; }
  }

  function wantsStudioSoon(){
    // index tarafında after_login/return gibi parametrelerle studio hedefleniyorsa overlay göster
    var after = String(getParam("after_login") || getParam("return") || getParam("next") || "").toLowerCase();
    if (!after) return false;
    return (after.indexOf("studio") !== -1);
  }

  function ensureStyle(){
    if (document.getElementById(STYLE_ID)) return;
    var css = `
      #${OVERLAY_ID}{
        position:fixed; inset:0;
        display:none;
        align-items:center; justify-content:center;
        z-index:99999;
        background:rgba(7,8,12,.72);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      }
      #${OVERLAY_ID}.is-on{ display:flex; }
      #${OVERLAY_ID} .aivo-load-card{
        width:min(520px, calc(100vw - 32px));
        border-radius:18px;
        padding:18px 18px 16px;
        background:rgba(18,19,26,.72);
        border:1px solid rgba(255,255,255,.10);
        box-shadow: 0 18px 60px rgba(0,0,0,.45);
        overflow:hidden;
        position:relative;
      }
      #${OVERLAY_ID} .aivo-load-row{
        display:flex; gap:12px; align-items:center;
      }
      #${OVERLAY_ID} .aivo-load-spinner{
        width:18px; height:18px; border-radius:999px;
        border:2px solid rgba(255,255,255,.22);
        border-top-color: rgba(255,255,255,.78);
        animation:aivoSpin .9s linear infinite;
        flex:0 0 auto;
      }
      @keyframes aivoSpin{ to{ transform:rotate(360deg);} }

      #${OVERLAY_ID} .aivo-load-title{
        font-weight:800;
        letter-spacing:.2px;
        font-size:14px;
        line-height:1.2;
        color:rgba(255,255,255,.92);
      }
      #${OVERLAY_ID} .aivo-load-sub{
        margin-top:4px;
        font-size:12px;
        line-height:1.45;
        color:rgba(255,255,255,.72);
      }

      /* subtle light sweep */
      #${OVERLAY_ID} .aivo-load-card:before{
        content:"";
        position:absolute; inset:-40% -60%;
        background: linear-gradient(90deg,
          transparent 0%,
          rgba(255,255,255,.10) 45%,
          rgba(255,255,255,.22) 50%,
          rgba(255,255,255,.10) 55%,
          transparent 100%);
        transform: translateX(-30%);
        animation: aivoSweep 1.25s ease-in-out infinite;
        pointer-events:none;
        mix-blend-mode: screen;
      }
      @keyframes aivoSweep{
        0%{ transform: translateX(-35%); opacity:.55; }
        60%{ transform: translateX(35%); opacity:.65; }
        100%{ transform: translateX(35%); opacity:0; }
      }

      /* reduced motion */
      @media (prefers-reduced-motion: reduce){
        #${OVERLAY_ID} .aivo-load-spinner{ animation:none; }
        #${OVERLAY_ID} .aivo-load-card:before{ animation:none; }
      }
    `;
    var st = document.createElement("style");
    st.id = STYLE_ID;
    st.type = "text/css";
    st.appendChild(document.createTextNode(css));
    document.head.appendChild(st);
  }

  function ensureOverlay(){
    var el = document.getElementById(OVERLAY_ID);
    if (el) return el;

    el = document.createElement("div");
    el.id = OVERLAY_ID;
    el.setAttribute("aria-hidden","true");
    el.innerHTML =
      '<div class="aivo-load-card" role="status" aria-live="polite">' +
        '<div class="aivo-load-row">' +
          '<div class="aivo-load-spinner" aria-hidden="true"></div>' +
          '<div>' +
            '<div class="aivo-load-title">Studio hazırlanıyor…</div>' +
            '<div class="aivo-load-sub">Hesabın doğrulanıyor ve arayüz yükleniyor.</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    // Click-through kapalı; ama ESC ile kapatmak istersen (debug) açabilirsin:
    // document.addEventListener("keydown", function(e){ if(e.key==="Escape") hide(); });

    document.body.appendChild(el);
    return el;
  }

  function canShow(){
    var last = 0;
    try{ last = parseInt(localStorage.getItem(KEY_LAST_SHOW) || "0", 10) || 0; }catch(e){}
    return (now() - last) > SHOW_COOLDOWN_MS;
  }

  function markShown(){
    try{ localStorage.setItem(KEY_LAST_SHOW, String(now())); }catch(e){}
  }

  function show(){
    if (!canShow()) return;
    ensureStyle();
    var el = ensureOverlay();
    markShown();
    el.classList.add("is-on");
    el.setAttribute("aria-hidden","false");

    // failsafe: asla takılı kalmasın
    window.clearTimeout(window.__aivoOverlayFailTimer);
    window.__aivoOverlayFailTimer = window.setTimeout(function(){
      hide();
    }, FAILSAFE_HIDE_MS);
  }

  function hide(){
    var el = document.getElementById(OVERLAY_ID);
    if (!el) return;
    el.classList.remove("is-on");
    el.setAttribute("aria-hidden","true");
    window.clearTimeout(window.__aivoOverlayFailTimer);
  }

  // ---- public (optional) ----
  window.AIVO_LOADING = window.AIVO_LOADING || {};
  window.AIVO_LOADING.show = show;
  window.AIVO_LOADING.hide = hide;

  // ---- auto behavior ----
  // 1) Studio sayfasındaysak: ilk paint sonrası kısa süre gösterip kapat (premium giriş hissi)
  if (isStudioUrl()){
    // çok kısa gecikmeyle aç, ardından UI init için küçük pay bırak
    window.setTimeout(function(){
      show();
      window.setTimeout(function(){ hide(); }, 650);
    }, 120);
    return;
  }

  // 2) Index'te redirect hedefi studio ise: göster (redirect süresince)
  if (wantsStudioSoon()){
    // sayfa açılır açılmaz göster; redirect bitince zaten sayfa değişecek
    window.setTimeout(function(){ show(); }, 60);
  }

  // 3) İstersen: Login butonuna basınca da göster (varsa)
  // Not: selectorları generic tuttum, varsa yakalar.
  document.addEventListener("click", function(e){
    var t = e.target;
    if (!t) return;

    // Login submit butonu veya "Studio'ya Gir" gibi aksiyonlar
    var btn =
      t.closest && (
        t.closest('[data-action="login"]') ||
        t.closest('[data-login-submit]') ||
        t.closest('[data-auth-login]') ||
        t.closest('button[type="submit"][data-login]') ||
        t.closest('button[type="submit"]')
      );

    if (!btn) return;

    // Eğer bu click login modal/redirect akışını tetikliyorsa, overlay göster.
    // (Her submit’te gereksiz çıkmasın diye cooldown var.)
    show();
  }, true);

})();
