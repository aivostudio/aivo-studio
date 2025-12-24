/* =========================================================
   AIVO — INDEX AUTH (EMERGENCY / DEBUG + WORKING)
   - Topbar: #btnLoginTop / #btnRegisterTop => modal açar
   - data-auth="required" linklerde login yoksa modal açar
   - Demo login: harunerkezen@gmail.com / 123456
   - Redirect standardı: /studio.html
   ========================================================= */

console.log("[AIVO] index.auth.js LOADED ✅", new Date().toISOString());

const DEMO = { email: "harunerkezen@gmail.com", pass: "123456" };

function isLoggedIn() {
  return localStorage.getItem("aivo_logged_in") === "1";
}
function setLoggedIn(v) {
  localStorage.setItem("aivo_logged_in", v ? "1" : "0");
}

function getModalEl() {
  return (
    document.getElementById("loginModal") ||
    document.getElementById("authModal") ||
    document.querySelector('[data-modal="login"]') ||
    document.querySelector(".login-modal") ||
    null
  );
}

function openModal(mode) {
  const m = getModalEl();
  if (!m) {
    console.warn("[AIVO] Modal bulunamadı. Denenenler: #loginModal, #authModal, [data-modal='login'], .login-modal");
    return;
  }
  m.classList.add("is-open");
  m.setAttribute("aria-hidden", "false");
  m.setAttribute("data-mode", mode === "register" ? "register" : "login");
  document.body.classList.add("modal-open");

  setTimeout(() => {
    (document.getElementById("loginEmail") || m.querySelector('input[type="email"]'))?.focus?.();
  }, 30);
}

function closeModal() {
  const m = getModalEl();
  if (!m) return;
  m.classList.remove("is-open");
  m.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

// /studio veya /studio/ gibi şeyleri /studio.html'e sabitle
function normalizeStudio(href) {
  const h = (href || "/studio.html").trim();
  if (h === "/studio" || h === "/studio/" || h.startsWith("/studio?") || h.startsWith("/studio#")) {
    return "/studio.html" + h.slice("/studio".length);
  }
  return h.includes("/studio") ? "/studio.html" : h;
}

function rememberTargetFromAnchor(a) {
  try {
    const u = new URL(a.getAttribute("href") || a.href, location.origin);

    // Aynı origin değilse dokunma
    if (u.origin !== location.origin) return;

    // hash link ise (örn: #fiyatlandirma) sayfa içinde kal
    if ((a.getAttribute("href") || "").trim().startsWith("#")) {
      sessionStorage.setItem("aivo_after_login", location.pathname + location.search + (a.getAttribute("href") || ""));
      return;
    }

    sessionStorage.setItem("aivo_after_login", u.pathname + u.search + u.hash);
  } catch {}
}

function goAfterLogin() {
  const raw = sessionStorage.getItem("aivo_after_login") || "/studio.html";
  sessionStorage.removeItem("aivo_after_login");
  location.href = normalizeStudio(raw);
}

/* =========================================================
   CLICK ROUTER (tek yerden yakala)
   ========================================================= */
document.addEventListener("click", (e) => {
  const t = e.target;

  // TOPBAR: Giriş Yap / Kayıt Ol
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

  // data-auth gate (senin standart sistemin)
  const a = t.closest('a[data-auth="required"]');
  if (a) {
    const hrefAttr = (a.getAttribute("href") || "").trim();

    // Login varsa:
    // - hash (#...) ise normal scroll etsin (Fiyatlandırma alt bloğa gitsin isteğine uygun)
    // - diğerlerinde normal davransın
    if (isLoggedIn()) return;

    // Login yoksa: her türlü gate
    e.preventDefault();
    rememberTargetFromAnchor(a);
    openModal("login");
    return;
  }

  // modal close: X / backdrop / data-close
  const m = getModalEl();
  if (m) {
    const isBackdrop =
      t === m ||
      t.classList?.contains("login-backdrop") ||
      t.closest(".login-backdrop");
    const isClose =
      t.closest(".login-x") ||
      t.closest(".modal-close") ||
      t.closest("[data-close]");
    if (isBackdrop || isClose) {
      e.preventDefault();
      closeModal();
      return;
    }
  }

  // logout
  const logout = t.closest("#btnLogoutTop, #btnLogout, [data-action='logout'], .logout");
  if (logout) {
    e.preventDefault();
    localStorage.removeItem("aivo_logged_in");
    localStorage.removeItem("aivo_user_email");
    sessionStorage.removeItem("aivo_after_login");
    location.href = "/";
  }
});

// ESC
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

/* =========================================================
   DEMO LOGIN BUTTON (modal içi)
   ========================================================= */
document.addEventListener("click", (e) => {
  const btn = e.target.closest("#btnLogin");
  if (!btn) return;

  const m = getModalEl();
  if (!m) return;

  e.preventDefault();

  const email =
    (document.getElementById("loginEmail")?.value || m.querySelector('input[type="email"]')?.value || "").trim().toLowerCase();
  const pass =
    (document.getElementById("loginPass")?.value || m.querySelector('input[type="password"]')?.value || "").trim();

  if (email === DEMO.email && pass === DEMO.pass) {
    setLoggedIn(true);
    localStorage.setItem("aivo_user_email", email);
    closeModal();
    goAfterLogin();
    return;
  }

  alert("E-posta veya şifre hatalı (demo).");
});

// Google demo
document.addEventListener("click", (e) => {
  const btn = e.target.closest("#btnGoogleLogin");
  if (!btn) return;
  e.preventDefault();
  setLoggedIn(true);
  closeModal();
  goAfterLogin();
});
