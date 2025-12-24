/* =========================================================
   AIVO INDEX — TOPBAR AUTH + MODAL GATE (SAFE) — SINGLE BLOCK (v2)
   - Giriş Yap / Kayıt Ol: modal açar (ID varsa ID, yoksa metinden yakalar)
   - data-auth="required" linklerde login yoksa modal açar
   - demo login (allowlist) => /studio.html
   - topbar: email göstermez, sadece Çıkış
   ========================================================= */

(function () {
  if (window.__aivoIndexAuthBound) return;
  window.__aivoIndexAuthBound = true;

  /* ---------- helpers ---------- */
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

  function isLink(el) {
    return el && el.tagName && el.tagName.toLowerCase() === "a";
  }

  function safePrevent(e, el) {
    // sadece <a> ise default’u engelle (button ise gerek yok)
    if (e && isLink(el)) e.preventDefault();
  }

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

  /* ---------- topbar guest/user toggle (NO EMAIL) ---------- */
  function syncAuthButtons() {
    const guest = qs(".auth-guest");
    const user = qs(".auth-user");
    const emailEl = qs("#topUserEmail"); // varsa bile boş bırakacağız

    if (emailEl) emailEl.textContent = ""; // asla mail gösterme

    if (!guest || !user) return;

    if (isLoggedIn()) {
      guest.style.display = "none";
      user.style.display = "inline-flex";
    } else {
      user.style.display = "none";
      guest.style.display = "inline-flex";
    }
  }

  /* ---------- TOPBAR BUTTON FINDERS (ID + FALLBACK) ---------- */
  function findTopbarButtonByText(textIncludes) {
    // Öncelik: topbar bölgesi içinde ara
    const scope =
      qs(".aivo-topbar") ||
      qs("header") ||
      document;

    const all = Array.from(scope.querySelectorAll("a,button"));
    const target = all.find((el) => {
      const t = (el.textContent || "").trim().toLowerCase();
      return t.includes(textIncludes);
    });
    return target || null;
  }

  /* ---------- topbar buttons ---------- */
  function bindTopbarButtons() {
    // ID varsa onu kullan, yoksa metinden yakala
    const btnLoginTop =
      qs("#btnLoginTop") ||
      findTopbarButtonByText("giriş yap");

    const btnRegisterTop =
      qs("#btnRegisterTop") ||
      findTopbarButtonByText("kayıt ol");

    const btnLogoutTop =
      qs("#btnLogoutTop") ||
      findTopbarButtonByText("çıkış");

    if (btnLoginTop) {
      btnLoginTop.addEventListener("click", (e) => {
        safePrevent(e, btnLoginTop);
        openLoginModal("login");
      });
    }

    if (btnRegisterTop) {
      btnRegisterTop.addEventListener("click", (e) => {
        safePrevent(e, btnRegisterTop);
        openLoginModal("register");
      });
    }

    if (btnLogoutTop) {
      btnLogoutTop.addEventListener("click", (e) => {
        safePrevent(e, btnLogoutTop);

        localStorage.removeItem("aivo_logged_in");
        localStorage.removeItem("aivo_user_email");
        localStorage.removeItem("aivo_after_login");

        syncAuthButtons();
        // index’te kal
        window.location.assign("/");
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

        // login varsa direkt standard hedefe git
        e.preventDefault();
        window.location.assign(target);
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

  /* ---------- modal close hooks ---------- */
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

  /* ---------- demo login allowlist (ROBUST) ---------- */
  function bindDemoLoginIfPresent() {
    const m = qs("#loginModal");
    if (!m) return;

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

    if (!email || !pass) return;

    // Modal içindeki butonlardan "Giriş Yap" olanı bul (Google hariç)
    const buttons = Array.from(m.querySelectorAll("button,a"));
    const btnLogin = buttons.find((b) => {
      const t = (b.textContent || "").trim().toLowerCase();
      return t.includes("giriş yap") && !t.includes("google");
    });

    if (!btnLogin) return;

    const handler = (e) => {
      // button da olabilir a da; güvenli şekilde engelle
      safePrevent(e, btnLogin);
      if (e) e.stopPropagation();

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
    };

    btnLogin.addEventListener("click", handler);

    // Enter ile submit oluyorsa yakala
    const form = btnLogin.closest("form") || m.querySelector("form");
    if (form) form.addEventListener("submit", handler);
  }

  /* ---------- INIT ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    // eski /studio linklerini standardize et
    qsa('a[href="/studio"], a[href="/studio/"]').forEach((a) =>
      a.setAttribute("href", "/studio.html")
    );

    bindTopbarButtons();
    bindAuthGateLinks();
    bindDropdowns();
    bindModalClose();
    bindDemoLoginIfPresent();
    syncAuthButtons();
  });
})();
