/* =========================================================
   AIVO — INDEX.AUTH.JS (VITRIN TOPBAR + DROPDOWN + AUTH GATE)
   - Ürünler dropdown (sayfa içi scroll)
   - Kurumsal dropdown (sayfa içi scroll)
   - Sağ üst: Giriş Yap / Kayıt Ol (guest) ↔ Çıkış (user)
   - Auth gate: sadece Studio linkine giderken modal açar
   - White flash fix: /studio.html standardı (tek yön)
   - Remember me: localStorage (kalıcı) / sessionStorage (oturumluk)
   ========================================================= */

/* ===================== DEMO AUTH ===================== */
const DEMO_AUTH = {
  email: "harunerkezen@gmail.com",
  pass: "123456",
};

/* ===================== REMEMBER ME STORAGE ===================== */
const LS_KEY = "aivo_logged_in";            // "1" kalıcı
const SS_KEY = "aivo_logged_in_session";    // "1" oturumluk
const EMAIL_KEY = "aivo_user_email";

function getRememberChecked() {
  const el = document.getElementById("rememberMe");
  return !!(el && el.checked);
}

function isLoggedIn() {
  try {
    return localStorage.getItem(LS_KEY) === "1" || sessionStorage.getItem(SS_KEY) === "1";
  } catch (_) {
    return false;
  }
}

function setLoggedIn(v, remember = true) {
  try {
    if (v) {
      // birini set etmeden önce temizle
      localStorage.removeItem(LS_KEY);
      sessionStorage.removeItem(SS_KEY);

      if (remember) localStorage.setItem(LS_KEY, "1");
      else sessionStorage.setItem(SS_KEY, "1");
    } else {
      localStorage.removeItem(LS_KEY);
      sessionStorage.removeItem(SS_KEY);
    }
  } catch (_) {}
}

/* ===================== MODAL ===================== */
function openLoginModal() {
  const m = document.getElementById("loginModal");
  if (!m) return;

  m.classList.add("is-open");
  m.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

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
  document.body.classList.remove("modal-open");
}

/* ===================== TARGET + REDIRECT ===================== */
/**
 * Sadece /studio.html hedefini “after login” olarak kaydediyoruz.
 * (Ürün kartları ve navbar’daki Studio girişleri için)
 */
function rememberStudioTarget() {
  sessionStorage.setItem("aivo_after_login_target", "/studio.html");
}

function goAfterLogin(fallback = "/studio.html") {
  const target = sessionStorage.getItem("aivo_after_login_target");
  if (target) sessionStorage.removeItem("aivo_after_login_target");
  window.location.href = target || fallback;
}

/* ===================== INPUT HELPERS ===================== */
function getEmailValue() {
  const el = document.getElementById("loginEmail");
  return (el && el.value ? el.value : "").trim();
}
function getPassValue() {
  const el = document.getElementById("loginPass");
  return (el && el.value ? el.value : "").trim();
}

/* ===================== UI STATE (TOPBAR BUTTONS) ===================== */
function syncAuthButtons() {
  const guestBox = document.getElementById("authGuest");
  const userBox = document.getElementById("authUser");
  const userEmail = document.getElementById("authUserEmail");

  const logged = isLoggedIn();

  if (guestBox) guestBox.style.display = logged ? "none" : "flex";
  if (userBox) userBox.style.display = logged ? "flex" : "none";

  if (userEmail) {
    const em = localStorage.getItem(EMAIL_KEY) || "";
    userEmail.textContent = em || "Hesabım";
  }
}

/* ===================== DROPDOWNS ===================== */
function closeAllDropdowns(exceptEl = null) {
  document.querySelectorAll(".nav-dd.is-open").forEach((dd) => {
    if (exceptEl && dd === exceptEl) return;
    dd.classList.remove("is-open");
    const btn = dd.querySelector(".nav-dd-btn");
    if (btn) btn.setAttribute("aria-expanded", "false");
  });
}

function toggleDropdown(dd) {
  const isOpen = dd.classList.contains("is-open");
  closeAllDropdowns(dd);
  dd.classList.toggle("is-open", !isOpen);
  const btn = dd.querySelector(".nav-dd-btn");
  if (btn) btn.setAttribute("aria-expanded", String(!isOpen));
}

/* ===================== SMOOTH SCROLL ===================== */
function scrollToId(id) {
  const el = document.getElementById(id);
  if (!el) return;

  const y = el.getBoundingClientRect().top + window.scrollY - 86; // header offset
  window.scrollTo({ top: y, behavior: "smooth" });
}

/* ===================== INIT ===================== */
document.addEventListener("DOMContentLoaded", () => {
  /* 0) Auth state -> topbar */
  syncAuthButtons();

  /* 1) Dropdown open/close + scroll */
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-dd-btn");
    if (btn) {
      e.preventDefault();
      const dd = btn.closest(".nav-dd");
      if (dd) toggleDropdown(dd);
      return;
    }

    // dropdown item scroll
    const item = e.target.closest("[data-scroll-to]");
    if (item) {
      e.preventDefault();
      const id = item.getAttribute("data-scroll-to");
      closeAllDropdowns();
      if (id) scrollToId(id);
      return;
    }

    // dışarı tıklayınca dropdown kapat
    if (!e.target.closest(".nav-dd")) closeAllDropdowns();
  });

  // ESC dropdown + modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAllDropdowns();
      closeLoginModal();
    }
  });

  /* 2) Giriş Yap (topbar) -> modal */
  const openLoginBtn = document.getElementById("openLogin");
  if (openLoginBtn) {
    openLoginBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openLoginModal();
    });
  }

  /* 3) Kayıt Ol (topbar) -> modal (aynı modal) */
  const openRegisterBtn = document.getElementById("openRegister");
  if (openRegisterBtn) {
    openRegisterBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openLoginModal();
    });
  }

  /* 4) Çıkış */
  const logoutBtn = document.getElementById("btnLogout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      localStorage.removeItem(EMAIL_KEY);
      localStorage.removeItem("aivo_is_new_user");
      setLoggedIn(false);
      syncAuthButtons();
    });
  }

  /* 5) Modal kapatma: SADECE X ve backdrop */
  document.addEventListener("click", (e) => {
    const isBackdrop =
      e.target.classList && e.target.classList.contains("login-backdrop");
    const isX = !!e.target.closest(".login-x");
    if (!isBackdrop && !isX) return;

    e.preventDefault();
    closeLoginModal();
  });

  /* 6) Email + Password login (DEMO) */
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
      if (email !== DEMO_AUTH.email || pass !== DEMO_AUTH.pass) {
        alert("E-posta veya şifre hatalı (demo).");
        document.getElementById("loginPass")?.focus();
        return;
      }

      const remember = getRememberChecked();
      localStorage.setItem(EMAIL_KEY, email);
      setLoggedIn(true, remember);

      syncAuthButtons();
      closeLoginModal();
      goAfterLogin("/studio.html");
    });
  }

  /* 7) Google login (demo) */
  const btnGoogle = document.getElementById("btnGoogleLogin");
  if (btnGoogle) {
    btnGoogle.addEventListener("click", () => {
      const remember = getRememberChecked();
      setLoggedIn(true, remember);

      syncAuthButtons();
      closeLoginModal();
      goAfterLogin("/studio.html");
    });
  }

  /* 8) Register (demo) */
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

      const remember = getRememberChecked();
      localStorage.setItem(EMAIL_KEY, email);
      localStorage.setItem("aivo_is_new_user", "1");
      setLoggedIn(true, remember);

      syncAuthButtons();
      closeLoginModal();
      goAfterLogin("/studio.html");
    });
  }

  /* 9) Forgot pass */
  const forgot = document.getElementById("forgotPass");
  if (forgot) {
    forgot.addEventListener("click", (e) => {
      e.preventDefault();
      alert("Şifre sıfırlama yakında.");
    });
  }

  /* ======================================================
     10) AUTH GATE — SADECE STUDIOYA GİDERKEN MODAL AÇ
     - Çözüm: linklerde data-auth="required" + href="/studio.html"
     ====================================================== */
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[data-auth="required"]');
    if (!a) return;

    const href = a.getAttribute("href") || "";
    const isStudio =
      href === "/studio.html" ||
      href === "studio.html" ||
      href === "/studio" ||
      href === "studio";

    if (!isStudio) return;

    if (isLoggedIn()) return; // girişliyse link normal çalışsın

    e.preventDefault();
    rememberStudioTarget();
    openLoginModal();
  });
});
