/* ===== AIVO MODAL CORE (FINAL / MATCHES YOUR HTML) ===== */
function getModalEl(){
  return (
    document.getElementById("loginModal") ||                 // ✅ senin id
    document.getElementById("authModal") ||                  // fallback
    document.querySelector('[data-modal="login"]') ||        // fallback
    document.querySelector(".login-modal")                   // fallback
  );
}

function openModal(mode){
  const m = getModalEl();
  if (!m) return;

  const finalMode = (mode === "register") ? "register" : "login";
  m.setAttribute("data-mode", finalMode);                    // ✅ controller bunu okuyor

  m.classList.add("is-open");
  m.setAttribute("aria-hidden", "false");

  document.body.classList.add("modal-open");
  document.documentElement.classList.add("modal-open");
}

function closeModal(){
  const m = getModalEl();
  if (!m) return;

  m.classList.remove("is-open");
  m.setAttribute("aria-hidden", "true");

  document.body.classList.remove("modal-open");
  document.documentElement.classList.remove("modal-open");
}


/* ===== AUTH MODAL LOGIN HARD RESET (CRITICAL) ===== */
(function authLoginHardReset(){
  if (window.__AIVO_LOGIN_HARD_RESET__) return;
  window.__AIVO_LOGIN_HARD_RESET__ = true;

  function hideRegisterFields() {
    const extra = document.getElementById("registerExtra");
    const kvkk  = document.getElementById("kvkkRow");
    const regMeta = document.getElementById("registerMeta");
    const loginMeta = document.getElementById("loginMeta");
    const google = document.getElementById("googleBlock");
    const footer = document.getElementById("loginFooter");

    if (extra) extra.style.display = "none";
    if (kvkk) kvkk.style.display = "none";
    if (regMeta) regMeta.style.display = "none";

    if (loginMeta) loginMeta.style.display = "flex";
    if (google) google.style.display = "block";
    if (footer) footer.style.display = "block";
  }

  // Login modal her açıldığında ZORLA resetle
  document.addEventListener("click", function(e){
    const loginBtn =
      e.target.closest('[data-open-auth="login"]') ||
      e.target.closest('#btnLoginTop') ||
      e.target.closest('#btnLogin');

    if (loginBtn) {
      // DOM biraz açıldıktan sonra resetle
      setTimeout(hideRegisterFields, 0);
      setTimeout(hideRegisterFields, 50);
    }
  }, true);

  // Sayfa ilk yüklendiğinde de garanti olsun
  document.addEventListener("DOMContentLoaded", hideRegisterFields);
})();


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
function applyModalMode(m, mode) {
  const isReg = mode === "register";

  // (1) Başlıklar
  const title = m.querySelector("#loginTitle");
  const desc  = m.querySelector(".login-desc");
  if (title) title.textContent = isReg ? "Hesap oluştur 👋" : "Tekrar hoş geldin 👋";
  if (desc)  desc.textContent  = isReg
    ? "AIVO Studio’ya erişmek için ücretsiz hesabını oluştur."
    : "AIVO Studio’ya erişmek için giriş yap veya ücretsiz hesap oluştur.";

  // (2) Google blok: sadece login’de görünsün (istersen register’da da açık bırakabilirsin)
  const googleBlock = m.querySelector(".login-google");
  if (googleBlock) googleBlock.style.display = isReg ? "none" : "block";

  // (3) Footer (AIVO’da yeni misin?): sadece login’de görünsün
  const footer = m.querySelector(".login-footer");
  if (footer) footer.style.display = isReg ? "none" : "block";

  // (4) Login meta (beni hatırla / şifremi unuttum): sadece login
  const meta = m.querySelector(".login-meta");
  if (meta) meta.style.display = isReg ? "none" : "flex";

  // (5) Register-only alanlar: ID ile hedefle (senin HTML’de bu ID’leri ver)
  const regOnly = m.querySelector("#registerOnly");   // Ad Soyad + Şifre tekrar wrapper
  const kvkkRow = m.querySelector("#kvkkRow");        // KVKK wrapper
  if (regOnly) regOnly.style.display = isReg ? "grid" : "none";
  if (kvkkRow) kvkkRow.style.display = isReg ? "flex" : "none";

  // (6) Buton yazısı
  const btn = m.querySelector("#btnLogin"); // sende submit butonu bu id
  if (btn) btn.textContent = isReg ? "Hesap Oluştur" : "Giriş Yap";

  // (7) Login’e dönünce register alanlarını temizle (kritik)
  if (!isReg) {
    const name  = m.querySelector("#regName");
    const pass2 = m.querySelector("#regPass2");
    const kvkk  = m.querySelector("#kvkkOk");
    if (name) name.value = "";
    if (pass2) pass2.value = "";
    if (kvkk) kvkk.checked = false;
  }
}

function openModal(mode /* "login" | "register" */) {
  const m = getModalEl();
  if (!m) {
    console.warn("[AIVO] Login modal bulunamadı. (#loginModal/#authModal/[data-modal='login']/.login-modal)");
    return;
  }

  const finalMode = mode === "register" ? "register" : "login";

  m.classList.add("is-open");
  m.setAttribute("aria-hidden", "false");
  m.setAttribute("data-mode", finalMode);
  document.body.classList.add("modal-open");

  // ✅ MODE’U GERÇEKTEN UYGULA (senin bug’ın tam burada)
  applyModalMode(m, finalMode);

  setTimeout(() => {
    const email = document.getElementById("loginEmail") || m.querySelector('input[type="email"]');
    if (email && typeof email.focus === "function") email.focus();
  }, 30);
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
    } catch (_) {}
  }

  // ✅ UI’yi her durumda güncelle
  try { syncTopbarAuthUI(); } catch (_) {}

  // ✅ Kurumsal sayfalarda include/topbar geç gelirse: DOM gelene kadar tekrar sync dene
  // (Login/Logout akışına dokunmaz, sadece UI görünümünü düzeltir)
  try { AIVO_WAIT_TOPBAR_AND_SYNC(); } catch (_) {}
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
   AIVO — AVATAR INITIAL SYNC (SAFE / NO-OP IF MISSING)
   - Writes SAME initial to:
       #topUserInitial  (topbar small avatar)
       #umAvatar        (user menu panel avatar)
   - Never writes "?".
   - Reads name/email from DOM first, then localStorage EMAIL_KEY.
   - Retries briefly because other scripts may hydrate DOM later.
   ========================================================= */
(function AIVO_syncAvatarInitial_SAFE(){
  // Hard-guard: prevent double attach
  if (window.__AIVO_AVATAR_SYNC_ATTACHED__) return;
  window.__AIVO_AVATAR_SYNC_ATTACHED__ = true;

  function pickText(sel){
    var el = document.querySelector(sel);
    return el && el.textContent ? String(el.textContent).trim() : "";
  }

  function computeInitial(){
    // 1) Prefer DOM (panel)
    var name  = pickText("#umName") || pickText("#topUserName");
    var email = pickText("#umEmail") || pickText("#topUserEmail");

    // 2) Fallback: localStorage email (from auth keys)
    if (!email) {
      try {
        if (typeof EMAIL_KEY !== "undefined" && EMAIL_KEY) {
          email = String(localStorage.getItem(EMAIL_KEY) || "").trim();
        }
      } catch(e){}
    }

    var src = (name || email || "").trim();
    if (!src) return "";

    var ch = src.charAt(0).toUpperCase();
    // Never output '?'
    if (ch === "?") return "";
    return ch;
  }

  function applyInitial(){
    var initial = computeInitial();

    var topEl = document.querySelector("#topUserInitial");
    var umEl  = document.querySelector("#umAvatar");

    // If neither exists, nothing to do
    if (!topEl && !umEl) return false;

    // Write same initial to both (or blank)
    if (topEl) topEl.textContent = initial;
    if (umEl)  umEl.textContent  = initial;

    // success means: we had data and wrote a non-empty initial
    return !!initial;
  }

  function runWithRetries(){
    // Try immediately
    if (applyInitial()) return;

    // Retry a few times in case other scripts fill #umName/#umEmail later
    var tries = 0;
    var maxTries = 20;      // ~3s total
    var timer = setInterval(function(){
      tries++;
      if (applyInitial() || tries >= maxTries) clearInterval(timer);
    }, 150);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runWithRetries);
  } else {
    runWithRetries();
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

  function computeDisplayName(){
    var name  = pickText("#umName");
    var email = pickText("#umEmail") || pickText("#topUserEmail");

    if (!email) {
      try {
        if (typeof EMAIL_KEY !== "undefined" && EMAIL_KEY) {
          email = String(localStorage.getItem(EMAIL_KEY) || "").trim();
        }
      } catch(e){}
    }

    // Prefer real name; fallback to email
    if (name) return name;
    if (email) return email;
    return "";
  }

  function applyName(){
    var topNameEl = document.querySelector("#topUserName");
    if (!topNameEl) return false;

    var v = computeDisplayName();
    if (!v) return false;

    // If still placeholder, replace it
    var cur = String(topNameEl.textContent || "").trim();
    if (!cur || cur === "Hesap" || cur === "Account" || cur === "—") {
      topNameEl.textContent = v;
    }
    return true;
  }

  function runWithRetries(){
    if (applyName()) return;

    var tries = 0;
    var maxTries = 20; // ~3s
    var timer = setInterval(function(){
      tries++;
      if (applyName() || tries >= maxTries) clearInterval(timer);
    }, 150);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runWithRetries);
  } else {
    runWithRetries();
  }
})();
/* =========================================================
   AIVO — GLOBAL BUY ROUTER (NON-STUDIO) — FINAL
   - Studio dışındaki tüm "Kredi Al / Plan Yükselt / data-open-pricing"
     tetiklerini tek commerce hub'a yollar:
       /fiyatlandirma.html#packs
   - Opsiyonel pack taşır:
       ?pack=standard|pro|mega|starter
   ========================================================= */
(function AIVO_GlobalBuyRouter_FINAL(){
  if (window.__AIVO_GLOBAL_BUY_ROUTER__) return;
  window.__AIVO_GLOBAL_BUY_ROUTER__ = true;

  var PATH = (location.pathname || "").toLowerCase();

  // ✅ Studio tarafı asla burada yönetilmez
  if (PATH.indexOf("/studio") === 0) return;

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
    if (!pack) return HUB;
    return HUB_BASE + "?pack=" + encodeURIComponent(pack) + "#packs";
  }

  function samePageIsPricing(){
    return PATH === "/fiyatlandirma.html" || PATH === "/fiyatlandirma";
  }

  function goToHub(e, pack){
    try { if (e) e.preventDefault(); } catch(_) {}

    // pack varsa pricing sayfası açılınca seçilebilsin (istersen sonra okuturuz)
    pack = normalizePack(pack);
    if (pack) { try { sessionStorage.setItem("aivo_preselect_pack", pack); } catch(_) {} }

    // Zaten fiyatlandırmadaysak: sadece #packs'e kaydır
    if (samePageIsPricing()) {
      try { location.hash = "packs"; } catch(_) {}
      try {
        var el = document.getElementById("packs");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch(_) {}
      return;
    }

    // Diğer sayfalarda: tek hub'a git
    try { window.location.href = buildTarget(pack); } catch(_) {}
  }

  function closest(el, sel){
    return (el && el.closest) ? el.closest(sel) : null;
  }

  document.addEventListener("click", function(e){
    try{
      if (!e || !e.target) return;
      var t = e.target;

      // 1) Ana standart: data-open-pricing
      var op = closest(t, "[data-open-pricing]");
      if (op) {
        var pack1 = op.getAttribute("data-pack") || op.getAttribute("data-buy-plan") || op.dataset.pack || op.dataset.buyPlan || "";
        return goToHub(e, pack1);
      }

      // 2) Plan/Kredi butonları (legacy varyantlar)
      var legacy = closest(
        t,
        ".btn-credit-buy, #btnBuyCredits, #btnOpenPricing, #creditsButton, [data-action='open-pricing']"
      );
      if (legacy) {
        var pack2 = legacy.getAttribute("data-pack") || legacy.getAttribute("data-buy-plan") || legacy.dataset.pack || legacy.dataset.buyPlan || "";
        return goToHub(e, pack2);
      }

      // 3) Paket kartları / satın al (sayfa genelindeki data-pack)
      var packBtn = closest(t, "[data-pack]");
      if (packBtn && (packBtn.classList.contains("js-login-required") || packBtn.classList.contains("p-btn") || packBtn.hasAttribute("data-buy"))) {
        var pack3 = packBtn.getAttribute("data-pack") || "";
        return goToHub(e, pack3);
      }

    } catch(err){
      console.warn("[AIVO] GlobalBuyRouter error:", err);
    }
  }, true);

})();
/* =========================================================
   GLOBAL AUTH CHECK — SINGLE SOURCE OF TRUTH
   ========================================================= */
window.isAuthed = function(){
  try {
    if (typeof window.isLoggedIn === "function") {
      return window.isLoggedIn();
    }
    if (window.isLoggedIn === true) {
      return true;
    }
    if (typeof window.LOGIN_KEY === "string") {
      return localStorage.getItem(window.LOGIN_KEY) === "1";
    }
    return false;
  } catch(e){
    return false;
  }
};
/* ===== AUTH MODAL OPEN / CLOSE + MODE SET (MINIMAL) ===== */
(function AUTH_MODAL_OPEN_CORE() {
  if (window.__AIVO_AUTH_MODAL_OPEN_CORE__) return;
  window.__AIVO_AUTH_MODAL_OPEN_CORE__ = true;

  /* ===== GET MODAL ===== */
  function GET_MODAL() {
    return document.getElementById("loginModal");
  }

  /* ===== SET MODE (SOURCE OF TRUTH: #loginModal[data-mode]) ===== */
  function SET_MODE(mode) {
    const modal = GET_MODAL();
    if (!modal) return;
    modal.setAttribute("data-mode", mode === "register" ? "register" : "login");
  }

  /* ===== OPEN MODAL ===== */
  function OPEN_MODAL(mode) {
    const modal = GET_MODAL();
    if (!modal) return;

    SET_MODE(mode); // ✅ KRİTİK

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    document.documentElement.classList.add("modal-open");
  }

  /* ===== CLOSE MODAL ===== */
  function CLOSE_MODAL() {
    const modal = GET_MODAL();
    if (!modal) return;

    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    document.documentElement.classList.remove("modal-open");
  }

  /* ===== GLOBAL EXPOSE (OPTIONAL) ===== */
  window.openAuthModal = OPEN_MODAL;
  window.closeAuthModal = CLOSE_MODAL;

  /* ===== TOPBAR + GENERAL CLICK HANDLER ===== */
  document.addEventListener(
    "click",
    function (e) {
      /* ===== OPEN: LOGIN ===== */
      if (
        e.target.closest("#btnLoginTop") ||
        e.target.closest('[data-open-auth="login"]')
      ) {
        e.preventDefault();
        OPEN_MODAL("login");
        return;
      }

      /* ===== OPEN: REGISTER ===== */
      if (
        e.target.closest("#btnRegisterTop") ||
        e.target.closest('[data-open-auth="register"]')
      ) {
        e.preventDefault();
        OPEN_MODAL("register");
        return;
      }

      /* ===== CLOSE: X / BACKDROP ===== */
      if (e.target.closest('[data-close="1"]')) {
        e.preventDefault();
        CLOSE_MODAL();
        return;
      }
    },
    true
  );
})();

/* =========================================================
   AUTH MODAL — REGISTER HANDLER (HESAP OLUŞTUR)
   - Button: #btnAuthSubmit
   - Modal:  #loginModal (data-mode="login|register")
   - Register Name input id: #regName  ✅ (sende doğrulandı)
   Endpoint: POST /api/auth/register
   ========================================================= */

(function () {
  const modal = document.getElementById('loginModal');
  if (!modal) return;

  const submitBtn = document.getElementById('btnAuthSubmit');
  if (!submitBtn) return;

  // Modal mode helper
  const getMode = () => (modal.getAttribute('data-mode') || 'login').trim();

  // Helpers
  const q = (sel) => modal.querySelector(sel);
  const getVal = (sel) => (q(sel)?.value || '').trim();
  const isChecked = (sel) => !!q(sel)?.checked;

// =====================================================
// AUTH MODAL — REGISTER SELECTORS (KESİN / FINAL)
// =====================================================
const selectors = {
  email: '#loginEmail',   // ✅
  pass:  '#loginPass',    // ✅
  pass2: '#regPass2',     // ✅
  name:  '#regName',      // ✅
  kvkk:  '#kvkkOk'        // ✅ SON PARÇA
};




  async function handleRegister() {
    const email = getVal(selectors.email);
    const password = getVal(selectors.pass);
    const password2 = getVal(selectors.pass2);
    const name = getVal(selectors.name);
    const kvkk = isChecked(selectors.kvkk);

    // Frontend kontroller
    if (!email || !email.includes('@') || !email.includes('.')) {
      alert('Lütfen geçerli bir email gir.');
      return;
    }
    if (!name) {
      alert('Lütfen ad soyad gir.');
      return;
    }
    if (!password || password.length < 6) {
      alert('Şifre en az 6 karakter olmalı.');
      return;
    }
    if (password2 && password2 !== password) {
      alert('Şifreler uyuşmuyor.');
      return;
    }
    if (!kvkk) {
      alert('KVKK ve şartları kabul etmelisin.');
      return;
    }

    // Double click engeli
    submitBtn.disabled = true;
    const oldText = submitBtn.textContent;
    submitBtn.textContent = 'Gönderiliyor...';

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data?.error || data?.message || 'Kayıt başarısız.');
        return;
      }

      alert(data?.message || 'Kayıt başarılı! Lütfen emailini doğrula.');
      // İstersen register sonrası login moduna dön:
      // modal.setAttribute('data-mode', 'login');

    } catch (err) {
      alert('Bağlantı hatası. Tekrar dene.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = oldText;
    }
  }

  // ✅ Tek buton: register moddaysa register çalıştır
  submitBtn.addEventListener('click', (e) => {
    if (getMode() !== 'register') return;
    e.preventDefault();
    handleRegister();
  });
})();
/* =========================================================
   AUTH MODAL — LOGIN HANDLER (btnAuthSubmit ile)
   - Button: #btnAuthSubmit
   - Mode:   #loginModal[data-mode="login|register"]
   - Demo login: DEMO_AUTH (istersen sonra gerçek endpoint'e bağlarız)
   ========================================================= */
(function AIVO_LoginHandler_For_btnAuthSubmit(){
  if (window.__AIVO_LOGIN_HANDLER_BTN_AUTHSUBMIT__) return;
  window.__AIVO_LOGIN_HANDLER_BTN_AUTHSUBMIT__ = true;

  const modal = document.getElementById("loginModal");
  if (!modal) return;

  const getMode = () => (modal.getAttribute("data-mode") || "login").trim();

  function getEmail(){
    return (document.getElementById("loginEmail")?.value || "").trim().toLowerCase();
  }
  function getPass(){
    return (document.getElementById("loginPass")?.value || "").trim();
  }

  function setLoggedInDemo(email){
    try {
      localStorage.setItem("aivo_logged_in", "1");
      localStorage.setItem("aivo_user_email", email);
    } catch(_) {}

    // UI sync varsa
    try { window.__AIVO_SYNC_AUTH_UI__ && window.__AIVO_SYNC_AUTH_UI__(); } catch(_) {}

    // modal kapat
    try { if (typeof window.closeAuthModal === "function") window.closeAuthModal(); } catch(_) {}
    try { if (typeof window.closeModal === "function") window.closeModal(); } catch(_) {}

    // hedefe git
    try {
      const t = sessionStorage.getItem("aivo_after_login") || "/studio.html";
      sessionStorage.removeItem("aivo_after_login");
      location.href = t;
    } catch(_) {
      location.href = "/studio.html";
    }
  }

  // ✅ Tek listener: buton click
  document.addEventListener("click", function(e){
    const btn = e.target.closest("#btnAuthSubmit");
    if (!btn) return;

    // register modunda register handler çalışsın, login burada devreye girmesin
    if (getMode() !== "login") return;

    e.preventDefault();

    const email = getEmail();
    const pass  = getPass();

    // basit kontrol
    if (!email || !pass) {
      alert("Email ve şifre gir.");
      return;
    }

    // ✅ Şimdilik DEMO_AUTH ile
    const demo = window.DEMO_AUTH || { email: "harunerkezen@gmail.com", pass: "123456" };

    if (email === demo.email && pass === demo.pass) {
      setLoggedInDemo(email);
      return;
    }

    alert("E-posta veya şifre hatalı (demo).");
  }, true);
})();


