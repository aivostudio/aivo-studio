/* =========================================================
   AIVO — LANDING AUTH GATE (MODAL) — FINAL
   - Demo email+password kontrolü (allowlist)
   - Target kaydı sağlamlaştırıldı
   - Redirect standardı: /studio
   ========================================================= */

const DEMO_AUTH = {
  email: "harunerkezen@gmail.com",
  pass: "123456",
};

function isLoggedIn() {
  return localStorage.getItem("aivo_logged_in") === "1";
}

function setLoggedIn(v) {
  localStorage.setItem("aivo_logged_in", v ? "1" : "0");
}

function openLoginModal() {
  const m = document.getElementById("loginModal");
  if (!m) return;

  m.classList.add("is-open");
  m.setAttribute("aria-hidden", "false");

  // 🔒 scroll lock
  document.body.classList.add("modal-open");

  // focus email
  setTimeout(() => {
    const email = document.getElementById("loginEmail");
    if (email) email.focus();
  }, 10);
}

function closeLoginModal() {
  const m = document.getElementById("loginModal");
  if (!m) return;

  m.classList.remove("is-open");
  m.setAttribute("aria-hidden", "true");

  // 🔓 scroll unlock
  document.body.classList.remove("modal-open");
}

function rememberTargetFromAnchor(a) {
  try {
    // a.href her zaman absolute olur (tarayıcı resolve eder)
    const u = new URL(a.href, window.location.origin);

    // aynı origin değilse target kaydetme
    if (u.origin !== window.location.origin) return;

    const path = u.pathname + u.search + u.hash;

    // boş / anlamsız hedefleri kaydetme
    if (!path || path === "/" || path === "/#") return;

    sessionStorage.setItem("aivo_after_login_target", path);
  } catch (_) {}
}

function goAfterLogin(fallback = "/studio") {
  const target = sessionStorage.getItem("aivo_after_login_target");
  if (target) sessionStorage.removeItem("aivo_after_login_target");
  window.location.href = target || fallback;
}

function getEmailValue() {
  const el = document.getElementById("loginEmail");
  return (el && el.value ? el.value : "").trim();
}

function getPassValue() {
  // HTML'de id="loginPass" olmalı
  const el = document.getElementById("loginPass");
  return (el && el.value ? el.value : "").trim();
}

document.addEventListener("DOMContentLoaded", () => {
  /* ======================================================
     1) Auth gerektiren linkleri yakala (SADECE data-auth)
     ====================================================== */
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[data-auth="required"]');
    if (!a) return;

    // login varsa normal akış (link çalışsın)
    if (isLoggedIn()) return;

    // login yoksa modal aç
    e.preventDefault();

    // sağlam target kaydı
    rememberTargetFromAnchor(a);
    openLoginModal();
  });

  /* ======================================================
     2) Modal kapatma: SADECE X ve Backdrop
     ====================================================== */
  document.addEventListener("click", (e) => {
    const isBackdrop =
      e.target.classList && e.target.classList.contains("login-backdrop");
    const isX = !!e.target.closest(".login-x");
    if (!isBackdrop && !isX) return;

    e.preventDefault();
    closeLoginModal();
  });

  /* ======================================================
     3) ESC ile kapat
     ====================================================== */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLoginModal();
  });

  /* ======================================================
     4) Email + Password login (DEMO allowlist)
     ====================================================== */
  const btnLogin = document.getElementById("btnLogin");
  if (btnLogin) {
    btnLogin.addEventListener("click", () => {
      const email = getEmailValue();
      const pass = getPassValue();

      if (!email || !email.includes("@")) {
        alert("Lütfen geçerli bir e-posta gir.");
        document.getElementById("loginEmail")?.focus();
        return;
      }

      if (!pass) {
        alert("Lütfen şifre gir.");
        document.getElementById("loginPass")?.focus();
        return;
      }

      // DEMO kontrol
      if (email !== DEMO_AUTH.email || pass !== DEMO_AUTH.pass) {
        alert("E-posta veya şifre hatalı (demo).");
        document.getElementById("loginPass")?.focus();
        return;
      }

      localStorage.setItem("aivo_user_email", email);

      setLoggedIn(true);
      closeLoginModal();
      goAfterLogin("/studio");
    });
  }

  /* ======================================================
     5) Google login (demo) — direkt kabul
     ====================================================== */
  const btnGoogle = document.getElementById("btnGoogleLogin");
  if (btnGoogle) {
    btnGoogle.addEventListener("click", () => {
      setLoggedIn(true);
      closeLoginModal();
      goAfterLogin("/studio");
    });
  }

  /* ======================================================
     6) Kayıt Ol (demo)
     ====================================================== */
  const reg = document.getElementById("goRegister");
  if (reg) {
    reg.addEventListener("click", (e) => {
      e.preventDefault();

      const email = getEmailValue();
      const pass = getPassValue();

      if (!email || !email.includes("@")) {
        alert("Kayıt için önce e-posta yaz.");
        document.getElementById("loginEmail")?.focus();
        return;
      }

      if (!pass) {
        alert("Kayıt için şifre yaz.");
        document.getElementById("loginPass")?.focus();
        return;
      }

      // demo kayıt: sadece işaretleyelim
      localStorage.setItem("aivo_user_email", email);
      localStorage.setItem("aivo_is_new_user", "1");

      setLoggedIn(true);
      closeLoginModal();
      goAfterLogin("/studio");
    });
  }

  /* ======================================================
     7) Şifremi unuttum
     ====================================================== */
  const forgot = document.getElementById("forgotPass");
  if (forgot) {
    forgot.addEventListener("click", (e) => {
      e.preventDefault();
      alert("Şifre sıfırlama yakında.");
    });
  }

  /* ======================================================
     8) Çıkış Yap (logout) — her yerde çalışsın
     ====================================================== */
  document.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-action="logout"], #btnLogout, .logout');
    if (!btn) return;

    e.preventDefault();

    // login state temizle
    localStorage.removeItem("aivo_logged_in");
    localStorage.removeItem("aivo_user_email");
    localStorage.removeItem("aivo_is_new_user");

    // vitrine dön
    window.location.href = "/";
  });
});
