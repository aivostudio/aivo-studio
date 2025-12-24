/* =========================================================
   AIVO INDEX — TOPBAR AUTH + MODAL GATE (SAFE) — SINGLE FILE
   - Giriş Yap / Kayıt Ol: modal açar
   - data-auth="required" linklerde login yoksa modal açar
   - login varsa hedef her zaman: /studio.html
   - guest/user toggle (syncAuthButtons) — email göstermez
   ========================================================= */

(function () {
  if (window.__aivoIndexAuthBound) return;
  window.__aivoIndexAuthBound = true;

  /* ---------- helpers ---------- */
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- auth state ---------- */
  function isLoggedIn() {
    return localStorage.getItem("aivo_logged_in") === "1";
  }
  function setLoggedIn(v) {
    localStorage.setItem("aivo_logged_in", v ? "1" : "0");
  }
  function setUserEmail(email) {
    if (email) localStorage.setItem("aivo_user_email", email);
  }

  function normalizeStudioTarget(href) {
    const h = (href || "/studio.html").trim();
    return h.includes("/studio") ? "/studio.html" : h;
  }

  /* ---------- modal open/close ---------- */
  function openLoginModal(mode /* 'login' | 'register' */) {
    const m = qs("#loginModal");
    if (!m) return;

    m.classList.add("is-open");
    m.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    m.setAttribute("data-mode", mode === "register" ? "register" : "login");

    setTimeout(() => {
      const email = qs("#loginEmail", m) || qs('input[type="email"]', m);
      if (email) email.focus();
    }, 30);
  }

  function closeLoginModal() {
    const m = qs("#loginModal");
    if (!m) return;

    m.classList.remove("is-open");
    m.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  /* ---------- topbar guest/user toggle ---------- */
  function syncAuthButtons() {
    const guest = qs(".auth-guest");
    const user = qs(".auth-user");
    const emailEl = qs("#topUserEmail");

    if (!guest || !user) return;

    if (isLoggedIn()) {
      guest.style.display = "none";
      user.style.display = "inline-flex";
      if (emailEl) emailEl.textContent = ""; // mail gösterme
    } else {
      user.style.display = "none";
      guest.style.display = "inline-flex";
      if (emailEl) emailEl.textContent = "";
    }
  }

  /* ---------- topbar auth buttons ---------- */
  function bindTopbarButtons() {
    const btnLoginTop = qs("#btnLoginTop");
    const btnRegisterTop = qs("#btnRegisterTop");
    const btnLogoutTop = qs("#btnLogoutTop");

    if (btnLoginTop) {
      btnLoginTop.addEventListener("click", (e) => {
        e.preventDefault();
        openLoginModal("login");
      });
    }

    if (btnRegisterTop) {
      btnRegisterTop.addEventListener("click", (e) => {
        e.preventDefault();
        openLoginModal("register");
      });
    }

    if (btnLogoutTop) {
      btnLogoutTop.addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.removeItem("aivo_logged_in");
        localStorage.removeItem("aivo_user_email");
        localStorage.removeItem("aivo_after_login");
        syncAuthButtons();
        window.location.href = "/"; // temiz dönüş
      });
    }
  }

  /* ---------- auth gate for links ---------- */
  function bindAuthGateLinks() {
    qsa('a[data-auth="required"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const href = a.getAttribute("href") || "/studio.html";
        const target = normalizeStudioTarget(href);

        if (!isLoggedIn()) {
          e.preventDefault();
          localStorage.setItem("aivo_after_login", target);
          openLoginModal("login");
          return;
        }

        a.setAttribute("href", target);
      });
    });
  }

  /* ---------- dropdown click open/close ---------- */
  function bindDropdowns() {
    const dropdownItems = qsa(".nav-item.has-dropdown");
    if (!dropdownItems.length) return;

    function closeAll(except) {
      dropdownItems.forEach((item) => {
        if (except && item === except) return;
        item.classList.remove("is-open");
      });
    }

    dropdownItems.forEach((item) => {
      const btn = qs(".nav-link", item);
      if (!btn) return;

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const willOpen = !item.classList.contains("is-open");
        closeAll();
        if (willOpen) item.classList.add("is-open");
      });
    });

    document.addEventListener("click", (e) => {
      const inside = e.target.closest(".nav-item.has-dropdown");
      if (!inside) closeAll();
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAll();
    });
  }

  /* ---------- hook existing modal UI ---------- */
  function bindModalClose() {
    const m = qs("#loginModal");
    if (!m) return;

    const closeBtn =
      qs(".modal-close", m) ||
      qs("[data-close]", m) ||
      qs(".close", m) ||
      qs(".x", m);

    if (closeBtn) closeBtn.addEventListener("click", closeLoginModal);

    m.addEventListener("click", (e) => {
      if (e.target === m) closeLoginModal();
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeLoginModal();
    });
  }

  /* ---------- OPTIONAL: demo login allowlist (CLICK + SUBMIT) ---------- */
  function bindDemoLoginIfPresent() {
    const m = qs("#loginModal");
    if (!m) return;

    const btnLogin =
      qs("#btnLogin", m) ||
      qs("#loginSubmit", m) ||
      qs("#btn-login", m) ||
      qs('[data-action="login"]', m) ||
      qs('button[type="submit"]', m) ||
      qs("button", m);

    const email =
      qs("#loginEmail", m) ||
      qs('input[type="email"]', m) ||
      qs('input[name="email"]', m) ||
      qs('input[autocomplete="email"]', m);

    const pass =
      qs("#loginPass", m) ||
      qs('input[type="password"]', m) ||
      qs('input[name="password"]', m) ||
      qs('input[autocomplete="current-password"]', m);

    if (!btnLogin || !email || !pass) return;

    function tryDemoLogin(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      const em = (email.value || "").trim().toLowerCase();
      const pw = (pass.value || "").trim();

      if (em === "harunerkezen@gmail.com" && pw === "123456") {
        setLoggedIn(true);
        setUserEmail(em);
        syncAuthButtons();
        closeLoginModal();

        const goRaw = localStorage.getItem("aivo_after_login") || "/studio.html";
        const go = normalizeStudioTarget(goRaw);
        window.location.assign(go);
        return;
      }

      alert("Giriş bilgileri hatalı (demo).");
    }

    // click ile
    btnLogin.addEventListener("click", tryDemoLogin);

    // Enter / form submit ile
    const form = btnLogin.closest("form") || qs("form", m);
    if (form) form.addEventListener("submit", tryDemoLogin);
  }

  /* ---------- INIT ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    bindTopbarButtons();
    bindAuthGateLinks();
    bindDropdowns();
    bindModalClose();
    bindDemoLoginIfPresent();
    syncAuthButtons();

    // eski linkler varsa standardize et
    qsa('a[href="/studio"], a[href="/studio/"]').forEach((a) =>
      a.setAttribute("href", "/studio.html")
    );
  });
})();

