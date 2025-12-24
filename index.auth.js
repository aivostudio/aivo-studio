/* =========================================================
   AIVO — LANDING AUTH GATE (MODAL) — CLEAN & SAFE
   - data-auth="required" → login yoksa modal
   - Topbar: Giriş Yap / Kayıt Ol → modal
   - Demo allowlist
   - Redirect standardı: /studio.html
   ========================================================= */

const DEMO_AUTH = {
  email: "harunerkezen@gmail.com",
  pass: "123456",
};

/* ---------- AUTH STATE ---------- */
function isLoggedIn() {
  return localStorage.getItem("aivo_logged_in") === "1";
}
function setLoggedIn(v) {
  localStorage.setItem("aivo_logged_in", v ? "1" : "0");
}

/* ---------- MODAL ---------- */
function openLoginModal() {
  const m = document.getElementById("loginModal");
  if (!m) return;

  m.classList.add("is-open");
  m.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  setTimeout(() => {
    document.getElementById("loginEmail")?.focus();
  }, 10);
}

function closeLoginModal() {
  const m = document.getElementById("loginModal");
  if (!m) return;

  m.classList.remove("is-open");
  m.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

/* ---------- TARGET ---------- */
function rememberTarget(a) {
  try {
    const u = new URL(a.href, location.origin);
    if (u.origin !== location.origin) return;
    sessionStorage.setItem("aivo_after_login", u.pathname + u.search);
  } catch {}
}

function goAfterLogin() {
  const t = sessionStorage.getItem("aivo_after_login") || "/studio.html";
  sessionStorage.removeItem("aivo_after_login");
  location.href = t.includes("/studio") ? "/studio.html" : t;
}

/* ---------- HELPERS ---------- */
function val(id) {
  return (document.getElementById(id)?.value || "").trim();
}

/* =========================================================
   INIT
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {

  /* 1) AUTH GATE — ALT LİNKLER */
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[data-auth="required"]');
    if (!a) return;

    if (isLoggedIn()) return;

    e.preventDefault();
    rememberTarget(a);
    openLoginModal();
  });

  /* 2) TOPBAR — GİRİŞ / KAYIT */
  document.getElementById("btnLoginTop")?.addEventListener("click", () => {
    openLoginModal();
  });

  document.getElementById("btnRegisterTop")?.addEventListener("click", () => {
    openLoginModal();
  });

  /* 3) MODAL KAPAT */
  document.addEventListener("click", (e) => {
    if (
      e.target.classList?.contains("login-backdrop") ||
      e.target.closest(".login-x")
    ) {
      closeLoginModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLoginModal();
  });

  /* 4) DEMO LOGIN */
  document.getElementById("btnLogin")?.addEventListener("click", () => {
    const email = val("loginEmail");
    const pass = val("loginPass");

    if (email !== DEMO_AUTH.email || pass !== DEMO_AUTH.pass) {
      alert("E-posta veya şifre hatalı (demo).");
      return;
    }

    setLoggedIn(true);
    closeLoginModal();
    goAfterLogin();
  });

  /* 5) GOOGLE LOGIN (DEMO) */
  document.getElementById("btnGoogleLogin")?.addEventListener("click", () => {
    setLoggedIn(true);
    closeLoginModal();
    goAfterLogin();
  });

  /* 6) LOGOUT */
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("#btnLogout, [data-action='logout']");
    if (!btn) return;

    e.preventDefault();
    localStorage.clear();
    location.href = "/";
  });
});
