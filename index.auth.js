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

const DEMO_AUTH = { email: "harunerkezen@gmail.com", pass: "123456" };
const TARGET_KEY = "aivo_after_login";
const LOGIN_KEY = "aivo_logged_in";
const EMAIL_KEY = "aivo_user_email";

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
   TOPBAR UI SYNC
   ========================= */
function syncTopbarAuthUI() {
  const guestBox = document.getElementById("authGuest") || document.querySelector(".auth-guest");
  const userBox  = document.getElementById("authUser")  || document.querySelector(".auth-user");
  const emailEl  = document.getElementById("topUserEmail");
  const loggedIn = isLoggedIn();

  if (guestBox) guestBox.style.display = loggedIn ? "none" : "flex";
  if (userBox)  userBox.style.display  = loggedIn ? "flex" : "none";

  if (emailEl) {
    emailEl.textContent = loggedIn ? (localStorage.getItem(EMAIL_KEY) || "") : "";
  }
}

/* =========================
   DOM READY INIT
   - Studio’dan gelen logout handshake’i yakala
   ========================= */
document.addEventListener("DOMContentLoaded", () => {
  // ✅ Studio logout handshake: vitrin açılır açılmaz kesin logout uygula
  if (sessionStorage.getItem("__AIVO_FORCE_LOGOUT__") === "1") {
    try {
      [
        "aivo_logged_in",
        "aivo_user_email",
        "aivo_auth",
        "aivo_token",
        "aivo_user",
        "aivo_credits",
        "aivo_store_v1"
      ].forEach((k) => {
        try { localStorage.removeItem(k); } catch (_) {}
      });
      try { sessionStorage.removeItem("__AIVO_FORCE_LOGOUT__"); } catch (_) {}
      // Not: sessionStorage.clear() yapmıyoruz, sadece bayrağı siliyoruz.
    } catch (_) {}
  }

  // UI’yi her durumda güncelle
  syncTopbarAuthUI();
});


/* =========================================================
   CLICK ROUTER (tek yerden)
   ========================================================= */

// ✅ TEK SOURCE OF TRUTH: her sayfadan çağrılabilir logout fonksiyonu
const AUTH_KEYS_TO_CLEAR = [
  "aivo_logged_in",     // 🔴 KRİTİK
  "aivo_user_email",    // 🔴 KRİTİK
  "aivo_auth",
  "aivo_token",
  "aivo_user",
  "aivo_credits",
  "aivo_store_v1"
];

window.AIVO_LOGOUT = function () {
  AUTH_KEYS_TO_CLEAR.forEach((k) => {
    try { localStorage.removeItem(k); } catch (_) {}
  });
  try { sessionStorage.clear(); } catch (_) {}

  // UI refresh (vitrin)
  try { if (typeof syncTopbarAuthUI === "function") syncTopbarAuthUI(); } catch (_) {}

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

      // Fallback (gerekmez ama güvenlik)
      try{
        localStorage.clear();
        sessionStorage.clear();
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
   ✅ PRODUCTS dropdown click (FINAL / SAFE)
   - capture kaldırıldı (çakışma azalır)
   - Studio’ya giderken query/hash korunur
   ========================================================= */
(function bindProductsNav(){
  document.addEventListener("click", (e) => {
    const card = e.target.closest ? e.target.closest(".product-card[data-product]") : null;
    if (!card) return;

    e.preventDefault();

    const product = (card.getAttribute("data-product") || "").trim();
    if (!product) return;

    try { localStorage.setItem("aivo_product_target", product); } catch(_) {}

    const isStudio = /studio\.html/.test(location.pathname) || /studio\.html/.test(location.href);

    // Studio'da değilsek Studio'ya git (query/hash koru)
    if (!isStudio) {
      const suffix = (location.search || "") + (location.hash || "");
      location.href = "/studio.html" + suffix;
      return;
    }

    // Studio'daysak: varsa studio switch fonksiyonunu dene
    if (typeof window.AIVO_SWITCH_PAGE === "function") {
      const map = { music: "music", cover: "cover", video: "video" };
      window.AIVO_SWITCH_PAGE(map[product] || product);
      try { localStorage.removeItem("aivo_product_target"); } catch(_) {}
    }
  }, false);
})();


