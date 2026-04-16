/* =========================================================
   AIVO AUTH CORE — SINGLE OWNER (NO CONFLICT)  ✅ FINAL
   - Modal:  #loginModal OR .login-modal (toleranslı)
   - Submit: #btnAuthSubmit   (text: "Giriş Yap" / "Hesap Oluştur")
   - Login:  POST /api/auth/login
   - Register: POST /api/auth/register
   ========================================================= */
(() => {
  if (window.__AIVO_AUTH_CORE__) return;
  window.__AIVO_AUTH_CORE__ = true;

  const MAX_MS = 20000;
  const started = Date.now();

  const byId = (id) => document.getElementById(id);
  const q = (sel, root = document) => root.querySelector(sel);

  const safeMsg = (x) => {
    if (x == null) return "";
    if (typeof x === "string") return x;
    if (typeof x.message === "string") return x.message;
    if (typeof x.error === "string") return x.error;
    if (typeof x.details === "string") return x.details;
    try { return JSON.stringify(x); } catch (_) { return String(x); }
  };

  const isValidEmail = (email) =>
    !!email && email.includes("@") && email.includes(".") && email.length >= 6;

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function firstNonEmpty() {
    for (let i = 0; i < arguments.length; i++) {
      const v = arguments[i];
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return "";
  }

  function emailToName(email) {
    const normalized = normalizeEmail(email);
    if (!normalized || normalized.indexOf("@") === -1) return "";
    return normalized.split("@")[0].trim();
  }

  function safeLSRemove(key) {
    try { localStorage.removeItem(key); } catch (_) {}
  }

  function safeLSSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_) {}
  }

  function getScopedProfileKey(baseKey, email) {
    const normalized = normalizeEmail(email);
    if (!normalized) return baseKey;
    return `${baseKey}:${normalized}`;
  }

  function writeUnifiedAuthFromLogin(payloadEmail, payloadName, payloadSurname) {
    const email = normalizeEmail(payloadEmail);
    const firstName = firstNonEmpty(payloadName, emailToName(email), "Kullanıcı");
    const surname = firstNonEmpty(payloadSurname, "");
    const fullName = firstNonEmpty(
      firstName && surname ? `${firstName} ${surname}` : "",
      firstName,
      "Kullanıcı"
    );

    safeLSSet("aivo_auth_unified_v1", JSON.stringify({
      loggedIn: true,
      email: email,
      name: firstName,
      full_name: fullName,
      first_name: firstName,
      last_name: surname,
      surname: surname,
      ts: Date.now()
    }));

    safeLSSet("aivo_profile_name", "");
    safeLSSet("aivo_profile_surname", "");
    safeLSSet(getScopedProfileKey("aivo_profile_name", email), firstName);
    safeLSSet(getScopedProfileKey("aivo_profile_surname", email), surname);
  }

  function clearUnifiedAuthState() {
    const currentUnified = (() => {
      try { return JSON.parse(localStorage.getItem("aivo_auth_unified_v1") || "{}"); }
      catch (_) { return {}; }
    })();

    const currentEmail = normalizeEmail(currentUnified && currentUnified.email);

    safeLSRemove("aivo_auth_unified_v1");
    safeLSRemove("aivo_profile_name");
    safeLSRemove("aivo_profile_surname");

    if (currentEmail) {
      safeLSRemove(getScopedProfileKey("aivo_profile_name", currentEmail));
      safeLSRemove(getScopedProfileKey("aivo_profile_surname", currentEmail));
    }
  }

  async function postJSON(url, body) {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      cache: "no-store",
      body: JSON.stringify(body || {})
    });
    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch (_) {}
    return { res, text, data };
  }

  function getModal() {
    return (
      byId("loginModal") ||
      byId("login-modal") ||
      q(".login-modal") ||
      q("#loginModal") ||
      null
    );
  }

  function getSubmitBtn() {
    return byId("btnAuthSubmit") || q("#btnAuthSubmit") || null;
  }

  function setMode(modal, mode) {
    if (!modal) return;
    modal.setAttribute("data-mode", mode);
  }

  function applyModeUI(modal) {
    if (!modal) return;

    const mode = String(modal.getAttribute("data-mode") || "login").toLowerCase();
    const isReg = mode === "register";

    const show = (id, on) => {
      const el = byId(id);
      if (el) el.style.display = on ? "" : "none";
    };

    const setText = (id, txt) => {
      const el = byId(id);
      if (el) el.textContent = txt;
    };

    setText("loginTitle", isReg ? "Email ile Kayıt" : "Tekrar hoş geldin 👋");
    setText(
      "loginDesc",
      isReg
        ? "AIVO Studio’ya erişmek için ücretsiz hesabını oluştur."
        : "AIVO Studio’ya giriş yap veya ücretsiz hesap oluştur."
    );

    show("registerName", isReg);
    show("registerPass2", isReg);
    show("kvkkRow", isReg);

    show("googleBlock", !isReg);
    show("loginMeta", !isReg);
    show("registerMeta", isReg);

    const btn = getSubmitBtn();
    if (btn) btn.textContent = isReg ? "Hesap Oluştur" : "Giriş Yap";
  }

  function openModal(mode) {
    const modal = getModal();
    if (!modal) return;

    setMode(modal, mode);
    applyModeUI(modal);

    modal.classList.add("is-open");
    modal.style.display = "block";
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    const modal = getModal();
    if (!modal) return;

    try {
      if (typeof window.closeAuthModal === "function") {
        window.closeAuthModal();
      } else {
        modal.classList.remove("is-open");
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
      }
    } catch (_) {}
  }

  function setBusy(btn, busy, text) {
    if (!btn) return;
    btn.disabled = !!busy;
    if (text != null) btn.textContent = text;
  }

  function waitForModalReady(cb) {
    (function tick() {
      const btn = getSubmitBtn();
      const modal = getModal() || btn?.closest?.(".login-modal") || null;

      if (btn) return cb(modal || document.body, btn);

      if (Date.now() - started > MAX_MS) return;
      setTimeout(tick, 120);
    })();
  }

  async function handleSubmit() {
    const modal = getModal();
    const btn = getSubmitBtn();
    if (!modal || !btn) return;

    const mode = String(modal.getAttribute("data-mode") || "login").toLowerCase();
    const isReg = mode === "register";

    const v = (id) => (byId(id)?.value || "").trim();
    const on = (id) => !!byId(id)?.checked;

    if (isReg) {
      const email = v("loginEmail").toLowerCase();
      const pass = v("loginPass");
      const name = v("registerName");
      const pass2 = v("registerPass2");
      const kvkk = on("kvkkCheck");

      if (!isValidEmail(email)) {
        window.toast.error("Geçerli bir email gir.");
        return;
      }

      if (!name) {
        window.toast.error("Ad Soyad gir.");
        return;
      }

      if (!pass || pass.length < 6) {
        window.toast.error("Şifre en az 6 karakter olmalı.");
        return;
      }

      if (pass !== pass2) {
        window.toast.error("Şifreler aynı değil.");
        return;
      }

      if (!kvkk) {
        window.toast.warning("KVKK ve şartları kabul etmelisin.");
        return;
      }

      const old = btn.textContent;
      setBusy(btn, true, "Hesap oluşturuluyor...");

      try {
        const { res, text, data } = await postJSON("/api/auth/register", { email, password: pass, name });

        if (!res.ok || data?.ok === false) {
          try {
            if (window.toast) toast.error("Kayıt başarısız", safeMsg(data?.error || data?.message || text || "Kayıt başarısız."));
          } catch (_) {}
          return;
        }

        try {
          if (window.toast) toast.success("Kayıt başarılı", "Doğrulama için e-postanı kontrol et. (Spam’i de kontrol et)");
        } catch (_) {}

        setMode(modal, "login");
        applyModeUI(modal);
      } catch (err) {
        console.error("AIVO_LOGIN_FETCH_FAIL:", err);
        try {
          if (window.toast) toast.error("Bağlantı hatası", "Tekrar dene.");
        } catch (_) {}
      } finally {
        setBusy(btn, false, old || "Hesap Oluştur");
      }
      return;
    }

    const email = v("loginEmail").toLowerCase();
    const pass = v("loginPass");

    if (!isValidEmail(email) || !pass) {
      try {
        if (window.toast) toast.error("Eksik bilgi", "E-posta ve şifre gir.");
      } catch (_) {}
      return;
    }

    const old = btn.textContent;
    setBusy(btn, true, "Giriş yapılıyor...");

    try {
      const { res, text, data } = await postJSON("/api/auth/login", { email, password: pass });

      if (!res.ok || data?.ok === false) {
        try {
          if (window.toast) toast.error("Giriş başarısız", safeMsg(data?.error || data?.message || text || "E-posta veya şifre hatalı."));
        } catch (_) {}
        return;
      }

    const resolvedEmail = normalizeEmail(
  firstNonEmpty(
    data?.user?.email,
    data?.email,
    email
  )
);

const rawFirstName = firstNonEmpty(
  data?.user?.first_name,
  data?.user?.firstName,
  ""
);

const rawSurname = firstNonEmpty(
  data?.user?.last_name,
  data?.user?.lastName,
  data?.user?.surname,
  data?.surname,
  ""
);

const rawLegacyName = firstNonEmpty(
  data?.user?.name,
  data?.name,
  ""
);

const loginEmailLocalName = emailToName(resolvedEmail);

const resolvedName = firstNonEmpty(
  rawFirstName,
  rawLegacyName && normalizeEmail(data?.user?.email || data?.email) === resolvedEmail ? rawLegacyName : "",
  loginEmailLocalName,
  "Kullanıcı"
);

const resolvedSurname = firstNonEmpty(
  rawSurname,
  ""
);
      safeLSSet("aivo_logged_in", "1");
      safeLSSet("aivo_user_email", resolvedEmail || email);
      if (data?.token) safeLSSet("aivo_token", data.token);

      writeUnifiedAuthFromLogin(resolvedEmail || email, resolvedName, resolvedSurname);

      try {
        if (typeof window.closeAuthModal === "function") window.closeAuthModal();
        else {
          modal.classList.remove("is-open");
          modal.setAttribute("aria-hidden", "true");
        }
      } catch (_) {}

      let after = "/studio.v2.html";
      try {
        after = sessionStorage.getItem("aivo_after_login") || "/studio.v2.html";
        sessionStorage.removeItem("aivo_after_login");
      } catch (_) {}

      const msg = encodeURIComponent("Girişiniz başarılı");
      const sep = String(after).includes("?") ? "&" : "?";
      window.location.href = `${after}${sep}tf=success&tm=${msg}`;
      return;
    } catch (_) {
      try {
        if (window.toast) toast.error("Bağlantı hatası", "Tekrar dene.");
      } catch (_) {}
    } finally {
      setBusy(btn, false, old || "Giriş Yap");
    }
  }

  document.addEventListener("click", function (e) {
    const t = e.target;

    if (t?.closest?.("#btnLoginTop")) {
      e.preventDefault();
      e.stopPropagation();
      openModal("login");
      return;
    }

    if (t?.closest?.("#btnRegisterTop")) {
      e.preventDefault();
      e.stopPropagation();
      openModal("register");
      return;
    }

    if (t?.closest?.("#btnAuthSubmit")) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      handleSubmit();
      return;
    }

    if (t?.closest?.(".login-modal .close, .login-modal [data-close], .login-modal .x, .login-modal .btn-close")) {
      e.preventDefault();
      e.stopPropagation();
      closeModal();
      return;
    }
  }, true);

  waitForModalReady((modal) => {
    applyModeUI(modal);

    if (!modal.__aivoModeObs) {
      modal.__aivoModeObs = true;
      try {
        const obs = new MutationObserver(() => applyModeUI(modal));
        obs.observe(modal, { attributes: true, attributeFilter: ["data-mode"] });
      } catch (_) {}
    }
  });
})();

/* ===============================
   AIVO AUTH CORE — SINGLE AUTHORITY LOGOUT
   Trigger: [data-action="logout"]
   Action : POST /api/auth/logout -> cleanup -> redirect
   Notes  : only LEFT click, ignore right-click/inspect, reduce false hits
   =============================== */
(function initSingleAuthorityLogout() {
  if (window.__AIVO_LOGOUT_INIT__) return;
  window.__AIVO_LOGOUT_INIT__ = true;

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function getScopedProfileKey(baseKey, email) {
    const normalized = normalizeEmail(email);
    if (!normalized) return baseKey;
    return `${baseKey}:${normalized}`;
  }

  function isVisible(el) {
    try {
      const r = el.getBoundingClientRect();
      if (!r || (r.width === 0 && r.height === 0)) return false;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return false;
      return true;
    } catch (_) {
      return true;
    }
  }

  async function doLogout({ redirectTo = "/" } = {}) {
    if (doLogout.__busy) return;
    doLogout.__busy = true;

    const currentUnified = (() => {
      try { return JSON.parse(localStorage.getItem("aivo_auth_unified_v1") || "{}"); }
      catch (_) { return {}; }
    })();

    const currentEmail = normalizeEmail(currentUnified && currentUnified.email);

    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        cache: "no-store"
      });

      try { await res.json(); } catch (_) {}

      const lsKeysToDelete = [
        "aivo_logged_in",
        "aivo_user",
        "aivo_user_email",
        "aivo_token",
        "aivo_session",
        "auth_user",
        "auth_token",
        "aivo_auth",
        "aivo_auth_v1",
        "aivo_user_v1",
        "aivo_session_v1",
        "aivo_after_login",
        "aivo_after_login_v1",
        "after_login_redirect",
        "return_after_login",
        "returnAfterLogin",
        "login_redirect",
        "post_login_redirect",
        "aivo_intent",
        "aivo_login_state",
        "aivo_login_email",
        "aivo_auth_unified_v1",
        "aivo_profile_name",
        "aivo_profile_surname"
      ];

      lsKeysToDelete.forEach((k) => {
        try { localStorage.removeItem(k); } catch (_) {}
      });

      if (currentEmail) {
        try { localStorage.removeItem(getScopedProfileKey("aivo_profile_name", currentEmail)); } catch (_) {}
        try { localStorage.removeItem(getScopedProfileKey("aivo_profile_surname", currentEmail)); } catch (_) {}
      }

      const ssKeysToDelete = [
        "aivo_after_login",
        "after_login_redirect",
        "return_after_login",
        "returnAfterLogin",
        "aivo_intent",
        "login_redirect",
        "post_login_redirect",
        "aivo_login_state"
      ];

      ssKeysToDelete.forEach((k) => {
        try { sessionStorage.removeItem(k); } catch (_) {}
      });

      const msg = encodeURIComponent("Çıkış yapıldı");
      const target = (redirectTo || "/");
      const sep = target.includes("?") ? "&" : "?";
      window.location.replace(`${target}${sep}tf=info&tm=${msg}`);
      return;
    } catch (_) {
      try { localStorage.removeItem("aivo_logged_in"); } catch (_) {}
      try { localStorage.removeItem("aivo_user"); } catch (_) {}
      try { localStorage.removeItem("aivo_token"); } catch (_) {}
      try { localStorage.removeItem("aivo_auth_unified_v1"); } catch (_) {}
      try { localStorage.removeItem("aivo_profile_name"); } catch (_) {}
      try { localStorage.removeItem("aivo_profile_surname"); } catch (_) {}
      if (currentEmail) {
        try { localStorage.removeItem(getScopedProfileKey("aivo_profile_name", currentEmail)); } catch (_) {}
        try { localStorage.removeItem(getScopedProfileKey("aivo_profile_surname", currentEmail)); } catch (_) {}
      }
      try { sessionStorage.removeItem("after_login_redirect"); } catch (_) {}
      try { sessionStorage.removeItem("return_after_login"); } catch (_) {}
      try { sessionStorage.removeItem("aivo_intent"); } catch (_) {}

      const msg = encodeURIComponent("Çıkış yapıldı");
      const target = (redirectTo || "/");
      const sep = target.includes("?") ? "&" : "?";
      window.location.replace(`${target}${sep}tf=info&tm=${msg}`);
      return;
    } finally {
      doLogout.__busy = false;
    }
  }

  document.addEventListener("click", (e) => {
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const el = e.target?.closest?.('[data-action="logout"]');
    if (!el) return;

    const tag = (el.tagName || "").toUpperCase();
    if (tag !== "BUTTON" && tag !== "A") return;
    if (!isVisible(el)) return;

    e.preventDefault();
    e.stopPropagation();

    const redirectTo = el.getAttribute("data-redirect") || "/";
    doLogout({ redirectTo });
  }, true);

  document.addEventListener("contextmenu", () => {}, true);
})();

/* =====================================
   AIVO CREDITS HYDRATE — GLOBAL (ALL PAGES)
   ===================================== */
(function initCreditsHydrateEverywhere() {
  if (window.__AIVO_CREDITS_HYDRATE__) return;
  window.__AIVO_CREDITS_HYDRATE__ = true;

  const MAX_MS = 8000;
  const started = Date.now();

  function paintUI(credits) {
    const n1 = document.getElementById("topCreditCount");
    if (n1) n1.textContent = String(credits);

    const pill = document.querySelector("#topCredits .credit-pill, .credit-pill.credit-pill--static, .credit-pill");
    if (pill && !n1) {
      const txt = pill.textContent || "";
      if (txt.toLowerCase().includes("kredi")) {
        pill.textContent = `Kredi ${credits}`;
      }
    }
  }

  (function tick() {
    const store = window.AIVO_STORE_V1;

    if (!store) {
      if (Date.now() - started < MAX_MS) return setTimeout(tick, 120);
      return;
    }

    (async () => {
      try {
        const r = await fetch("/api/credits/get", {
          credentials: "include",
          cache: "no-store",
          headers: { "Accept": "application/json" }
        });

        const j = await r.json().catch(() => null);
        if (!j?.ok || typeof j.credits !== "number") return;

        if (typeof store.setCredits === "function") store.setCredits(j.credits);

        if (typeof store.syncCreditsUI === "function") {
          try { store.syncCreditsUI(); } catch (_) {}
        }

        paintUI(j.credits);
      } catch (_) {}
    })();
  })();
})();

/* =========================================================
   PRODUCTS dropdown click (GLOBAL GATE / ROUTE)
   - Pricing + Kurumsal + diğer vitrinde çalışsın
   - login yoksa modal açsın
   - login varsa studio target'a gitsin
   ========================================================= */
(function bindProductsNav() {
  if (window.__AIVO_PRODUCTS_NAV_GATE__) return;
  window.__AIVO_PRODUCTS_NAV_GATE__ = true;

  function safeOpenLogin() {
    try {
      if (typeof window.openLoginModal === "function") { window.openLoginModal(); return; }
      if (typeof window.openAuthModal === "function") { window.openAuthModal("login"); return; }
      if (typeof window.openModal === "function") { window.openModal("login"); return; }
      const btn = document.getElementById("btnLoginTop");
      if (btn) { btn.click(); return; }
    } catch (_) {}
  }

  function safeIsLoggedIn() {
    try {
      if (localStorage.getItem("aivo_logged_in") === "1") return true;
      if ((localStorage.getItem("aivo_user_email") || "").trim()) return true;
      if ((localStorage.getItem("aivo_token") || "").trim()) return true;
      if ((localStorage.getItem("aivo_user") || "").trim()) return true;
      return false;
    } catch (_) {
      return false;
    }
  }

  document.addEventListener("click", (e) => {
    const card = e.target && e.target.closest ? e.target.closest(".product-card[data-product]") : null;
    if (!card) return;

    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

    const product = (card.getAttribute("data-product") || "").trim();
    if (!product) return;

    const isStudio =
      /\/studio(\.html)?$/i.test(location.pathname) ||
      /\/studio\.v2\.html$/i.test(location.pathname) ||
      /studio\.html/i.test(location.href) ||
      /studio\.v2\.html/i.test(location.href);

    const map = { music: "music", cover: "cover", video: "video" };
    const page = map[product] || product;

    if (!isStudio && !safeIsLoggedIn()) {
      try {
        sessionStorage.setItem("aivo_after_login", "/studio.v2.html#" + encodeURIComponent(page));
      } catch (_) {}
      safeOpenLogin();
      return;
    }

    try { localStorage.setItem("aivo_product_target", product); } catch (_) {}

    if (!isStudio) {
      location.href = "/studio.v2.html#" + encodeURIComponent(page);
      return;
    }

    if (typeof window.AIVO_SWITCH_PAGE === "function") {
      window.AIVO_SWITCH_PAGE(page);
      try { localStorage.removeItem("aivo_product_target"); } catch (_) {}
    }
  }, true);
})();
