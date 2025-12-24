/* =========================================================
   AIVO — LANDING AUTH GATE (MODAL) — FINAL (REDIRECT FIX)
   ========================================================= */

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

function rememberTarget(url) {
  if (!url) return;
  sessionStorage.setItem("aivo_after_login_target", url);
}

function goAfterLogin(fallback = "/studio.html") {
  const target = sessionStorage.getItem("aivo_after_login_target");
  if (target) sessionStorage.removeItem("aivo_after_login_target");
  window.location.href = target || fallback;
}

function getEmailValue() {
  const el = document.getElementById("loginEmail");
  return (el?.value || "").trim();
}

document.addEventListener("DOMContentLoaded", () => {
  /* ======================================================
     1) Auth gerektiren linkleri yakala
     ====================================================== */
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[data-auth="required"]');
    if (!a) return;

    if (isLoggedIn()) return; // login varsa normal geç

    e.preventDefault();
    rememberTarget(a.getAttribute("href"));
    openLoginModal();
  });

  /* ======================================================
     2) Modal kapatma: SADECE X ve Backdrop
     (Panel içine tıklayınca kapanmasın)
     ====================================================== */
  document.addEventListener("click", (e) => {
    const isBackdrop = e.target.classList?.contains("login-backdrop");
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
     4) Email login (demo) — email yazınca giriş kabul et + yönlendir
     ====================================================== */
  const btnLogin = document.getElementById("btnLogin");
  if (btnLogin) {
    btnLogin.addEventListener("click", () => {
      const email = getEmailValue();
      if (!email || !email.includes("@")) {
        alert("Lütfen geçerli bir e-posta gir.");
        document.getElementById("loginEmail")?.focus();
        return;
      }

      // demo: email’i sakla (sonra gerçek auth’ta kaldırırız)
      localStorage.setItem("aivo_user_email", email);

      setLoggedIn(true);
      closeLoginModal();
      goAfterLogin("/studio.html");
    });
  }

  /* ======================================================
     5) Google login (demo) — giriş kabul et + yönlendir
     ====================================================== */
  const btnGoogle = document.getElementById("btnGoogleLogin");
  if (btnGoogle) {
    btnGoogle.addEventListener("click", () => {
      setLoggedIn(true);
      closeLoginModal();
      goAfterLogin("/studio.html");
    });
  }

  /* ======================================================
     6) Kayıt Ol (demo) — şimdilik email ile aynı davran
     ====================================================== */
  const reg = document.getElementById("goRegister");
  if (reg) {
    reg.addEventListener("click", (e) => {
      e.preventDefault();

      const email = getEmailValue();
      if (!email || !email.includes("@")) {
        alert("Kayıt için önce e-posta yaz.");
        document.getElementById("loginEmail")?.focus();
        return;
      }

      localStorage.setItem("aivo_user_email", email);
      localStorage.setItem("aivo_is_new_user", "1"); // ileride 5 kredi hediye için

      setLoggedIn(true);
      closeLoginModal();
      goAfterLogin("/studio.html");
    });
  }

  /* ======================================================
     7) Şifremi unuttum (şimdilik kapatma veya mesaj)
     ====================================================== */
  const forgot = document.getElementById("forgotPass");
  if (forgot) {
    forgot.addEventListener("click", (e) => {
      e.preventDefault();
      alert("Şifre sıfırlama yakında.");
    });
  }
});
