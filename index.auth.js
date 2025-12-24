/* =========================================================
   AIVO INDEX — TOPBAR AUTH + MODAL GATE (SAFE)
   - Giriş Yap / Kayıt Ol butonları modal açar
   - data-auth="required" linklerde login yoksa modal açar
   - login varsa /studio.html
   - guest/user toggle (syncAuthButtons)
   ========================================================= */

(function () {
  if (window.__aivoIndexAuthBound) return;
  window.__aivoIndexAuthBound = true;

  /* ---------- helpers ---------- */
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

  function isLoggedIn() {
    return localStorage.getItem("aivo_logged_in") === "1";
  }
  function setLoggedIn(v) {
    localStorage.setItem("aivo_logged_in", v ? "1" : "0");
  }

  // (opsiyonel) email göstermek için
  function getUserEmail() {
    return localStorage.getItem("aivo_user_email") || "";
  }
  function setUserEmail(email) {
    if (email) localStorage.setItem("aivo_user_email", email);
  }

  /* ---------- modal open/close ---------- */
  function openLoginModal(mode /* 'login' | 'register' */) {
    const m = qs("#loginModal"); // SENDE ZATEN VAR
    if (!m) return;

    m.classList.add("is-open");
    m.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open"); // scroll lock sınıfın varsa

    // Eğer modal içinde login/register tab’ı varsa bunu işaretlemek için:
    // data-mode kullandım; senin modalında farklıysa sorun çıkarmaz.
    m.setAttribute("data-mode", mode === "register" ? "register" : "login");

    // focus email
    setTimeout(() => {
      const email = qs("#loginEmail");
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

  /* ---------- topbar auth buttons ---------- */
  function syncAuthButtons() {
    const guest = qs(".auth-guest");
    const user = qs(".auth-user");
    const emailEl = qs("#topUserEmail");

    if (!guest || !user) return;

    if (isLoggedIn()) {
      guest.style.display = "none";
      user.style.display = "inline-flex";
      if (emailEl) emailEl.textContent = getUserEmail() || "Giriş yapıldı";
    } else {
      user.style.display = "none";
      guest.style.display = "inline-flex";
      if (emailEl) emailEl.textContent = "";
    }
  }

  /* ---------- auth gate for links ---------- */
  function bindAuthGateLinks() {
    // Ürünler dropdown + kartlar vb: data-auth="required"
    qsa('a[data-auth="required"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const href = a.getAttribute("href") || "/studio.html";
        const target = href.includes("/studio") ? "/studio.html" : href;

        if (!isLoggedIn()) {
          e.preventDefault();
          openLoginModal("login");
          // login olunca gideceği yer (opsiyonel)
          localStorage.setItem("aivo_after_login", target);
          return;
        }

        // login varsa standart hedef
        a.setAttribute("href", target);
      });
    });
  }

  /* ---------- dropdown click open/close (hover’a ek) ---------- */
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
    // modal kapatma butonu: sende “X” var; id yoksa data-close ile yakalıyoruz
    const closeBtn =
      qs("#loginModal .modal-close") ||
      qs("#loginModal [data-close]") ||
      qs("#loginModal .close") ||
      qs("#loginModal .x");

    if (closeBtn) closeBtn.addEventListener("click", closeLoginModal);

    // backdrop tıklayınca kapat (modal markup uygunsa)
    const m = qs("#loginModal");
    if (m) {
      m.addEventListener("click", (e) => {
        if (e.target === m) closeLoginModal();
      });
    }
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeLoginModal();
    });
  }

  /* ---------- topbar buttons bind ---------- */
  function bindTopbarButtons() {
    const btnLoginTop = qs("#btnLoginTop");
    const btnRegisterTop = qs("#btnRegisterTop");
    const btnLogoutTop = qs("#btnLogoutTop");

    if (btnLoginTop) {
      btnLoginTop.addEventListener("click", () => openLoginModal("login"));
    }
    if (btnRegisterTop) {
      btnRegisterTop.addEventListener("click", () => openLoginModal("register"));
    }
    if (btnLogoutTop) {
      btnLogoutTop.addEventListener("click", () => {
        setLoggedIn(false);
        localStorage.removeItem("aivo_user_email");
        localStorage.removeItem("aivo_after_login");
        syncAuthButtons();
      });
    }
  }

  /* ---------- OPTIONAL: demo login allowlist (senin önceki sisteminle uyumlu) ---------- */
  function bindDemoLoginIfPresent() {
    const btnLogin = qs("#btnLogin"); // modal içindeki "Giriş Yap" butonu id’si genelde buydu
    const email = qs("#loginEmail");
    const pass = qs("#loginPass");

    if (!btnLogin || !email || !pass) return;

    btnLogin.addEventListener("click", () => {
      const e = (email.value || "").trim().toLowerCase();
      const p = (pass.value || "").trim();

      // demo allowlist
      if (e === "harunerkezen@gmail.com" && p === "123456") {
        setLoggedIn(true);
        setUserEmail(e);
        syncAuthButtons();
        closeLoginModal();

        const go = localStorage.getItem("aivo_after_login") || "/studio.html";
        // standart hedef: /studio.html
        window.location.href = go.includes("/studio") ? "/studio.html" : go;
        return;
      }

      // yanlışsa: (istersen burada hata mesajını bağlarız)
      alert("Giriş bilgileri hatalı (demo).");
    });
  }

  /* ---------- INIT ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    bindTopbarButtons();
    bindAuthGateLinks();
    bindDropdowns();
    bindModalClose();
    bindDemoLoginIfPresent();
    syncAuthButtons();

    // Sayfa reload sonrası logged-in ise: ürün linklerini /studio.html standardına çeker
    qsa('a[href="/studio"], a[href="/studio/"]').forEach((a) => a.setAttribute("href", "/studio.html"));
  });
})();
