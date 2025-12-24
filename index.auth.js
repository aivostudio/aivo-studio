/* =========================================================
   AIVO — LANDING AUTH GATE (MODAL)
   ========================================================= */

/**
 * Şimdilik basit “login var/yok” flag.
 * Gerçek auth gelince cookie/session’a bağlarız.
 */
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

document.addEventListener("DOMContentLoaded", () => {
  // 1) Auth gerektiren linkleri yakala
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[data-auth="required"]');
    if (!a) return;

    if (isLoggedIn()) return; // login varsa normal geç

    e.preventDefault();
    rememberTarget(a.getAttribute("href"));
    openLoginModal();
  });

  // 2) Modal kapatma: X, backdrop, data-close
  document.addEventListener("click", (e) => {
    const closeBtn = e.target.closest("[data-close='1']");
    if (closeBtn) {
      e.preventDefault();
      closeLoginModal();
    }
  });

  // 3) ESC ile kapat
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLoginModal();
  });

  // 4) Demo login (şimdilik): “Giriş Yap” basınca login kabul et
  const btnLogin = document.getElementById("btnLogin");
  if (btnLogin) {
    btnLogin.addEventListener("click", () => {
      setLoggedIn(true);
      closeLoginModal();
      goAfterLogin("/studio.html");
    });
  }

  // 5) Google login demo (şimdilik)
  const btnGoogle = document.getElementById("btnGoogleLogin");
  if (btnGoogle) {
    btnGoogle.addEventListener("click", () => {
      setLoggedIn(true);
      closeLoginModal();
      goAfterLogin("/studio.html");
    });
  }

  // 6) Şifremi unuttum / kayıt ol (şimdilik sadece kapat)
  const forgot = document.getElementById("forgotPass");
  if (forgot) forgot.addEventListener("click", (e) => { e.preventDefault(); /* sonra bağlarız */ });

  const reg = document.getElementById("goRegister");
  if (reg) reg.addEventListener("click", (e) => { e.preventDefault(); /* sonra bağlarız */ });
});
