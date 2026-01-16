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

  const q = (sel, root=document) => root.querySelector(sel);

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

  async function postJSON(url, body){
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

  // Modal’i her yerde aynı şekilde bul (id/class toleransı)
  function getModal(){
    return (
      byId("loginModal") ||
      byId("login-modal") ||
      q(".login-modal") ||
      q("#loginModal") ||
      null
    );
  }

  function getSubmitBtn(){
    return byId("btnAuthSubmit") || q("#btnAuthSubmit") || null;
  }

  function setMode(modal, mode){
    if (!modal) return;
    modal.setAttribute("data-mode", mode);
  }

  function applyModeUI(modal){
    if (!modal) return;

    const mode = String(modal.getAttribute("data-mode") || "login").toLowerCase();
    const isReg = mode === "register";

    const show = (id, on) => { const el = byId(id); if (el) el.style.display = on ? "" : "none"; };
    const setText = (id, txt) => { const el = byId(id); if (el) el.textContent = txt; };

    setText("loginTitle", isReg ? "Email ile Kayıt" : "Tekrar hoş geldin 👋");
    setText(
      "loginDesc",
      isReg
        ? "AIVO Studio’ya erişmek için ücretsiz hesabını oluştur."
        : "AIVO Studio’ya giriş yap veya ücretsiz hesap oluştur."
    );

    show("registerName",  isReg);
    show("registerPass2", isReg);
    show("kvkkRow",       isReg);

    show("googleBlock",   !isReg);
    show("loginMeta",     !isReg);
    show("registerMeta",  isReg);

    const btn = getSubmitBtn();
    if (btn) btn.textContent = isReg ? "Hesap Oluştur" : "Giriş Yap";
  }

  function openModal(mode){
    const modal = getModal();
    if (!modal) return;

    setMode(modal, mode);
    applyModeUI(modal);

    modal.classList.add("is-open");
    modal.style.display = "block";
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal(){
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
    } catch(_){}
  }

  function setBusy(btn, busy, text){
    if (!btn) return;
    // NOTE: disable kalabilir ama click’i biz capture phase’de yakaladığımız için sorun yaşamaz.
    btn.disabled = !!busy;
    if (text != null) btn.textContent = text;
  }

  function waitForModalReady(cb){
    (function tick(){
      const btn = getSubmitBtn();
      const modal = getModal() || btn?.closest?.(".login-modal") || null;

      if (btn) return cb(modal || document.body, btn);

      if (Date.now() - started > MAX_MS) return;
      setTimeout(tick, 120);
    })();
  }

  // --------- SUBMIT handler (Login/Register) ----------
  async function handleSubmit(){
    const modal = getModal();
    const btn   = getSubmitBtn();
    if (!modal || !btn) return;

    const mode = String(modal.getAttribute("data-mode") || "login").toLowerCase();
    const isReg = mode === "register";

    const v  = (id) => (byId(id)?.value || "").trim();
    const on = (id) => !!byId(id)?.checked;

    // REGISTER
    if (isReg){
      const email = v("loginEmail").toLowerCase();
      const pass  = v("loginPass");
      const name  = v("registerName");
      const pass2 = v("registerPass2");
      const kvkk  = on("kvkkCheck");

      if (!isValidEmail(email)) { alert("Geçerli email gir."); return; }
      if (!name) { alert("Ad Soyad gir."); return; }
      if (!pass || pass.length < 6) { alert("Şifre en az 6 karakter olmalı."); return; }
      if (pass !== pass2) { alert("Şifreler aynı değil."); return; }
      if (!kvkk) { alert("KVKK ve şartları kabul etmelisin."); return; }

      const old = btn.textContent;
      setBusy(btn, true, "Hesap oluşturuluyor...");

      try {
        const { res, text, data } = await postJSON("/api/auth/register", { email, password: pass, name });

        if (!res.ok || data?.ok === false){
          alert(safeMsg(data?.error || data?.message || text || "Kayıt başarısız."));
          return;
        }

        alert("Kayıt alındı ✅ Email doğrulama gönderildi. (Spam’ı da kontrol et)");
        setMode(modal, "login");
        applyModeUI(modal);

     } catch (err){
  console.error("AIVO_LOGIN_FETCH_FAIL:", err);
  alert("Bağlantı hatası. Tekrar dene.");


      } finally {
        setBusy(btn, false, old || "Hesap Oluştur");
      }
      return;
    }

    // LOGIN
    const email = v("loginEmail").toLowerCase();
    const pass  = v("loginPass");

    if (!isValidEmail(email) || !pass){
      alert("E-posta ve şifre gir.");
      return;
    }

    const old = btn.textContent;
    setBusy(btn, true, "Giriş yapılıyor...");

    try {
      const { res, text, data } = await postJSON("/api/auth/login", { email, password: pass });

      if (!res.ok || data?.ok === false){
        alert(safeMsg(data?.error || data?.message || text || "Giriş başarısız."));
        return;
      }

      try { localStorage.setItem("aivo_logged_in", "1"); } catch(_){}
      try { localStorage.setItem("aivo_user_email", data?.user?.email || email); } catch(_){}

      closeModal();

      const after = sessionStorage.getItem("aivo_after_login") || "/studio.html";
      try { sessionStorage.removeItem("aivo_after_login"); } catch(_){}
      location.href = after;

    } catch (_){
      alert("Bağlantı hatası. Tekrar dene.");
    } finally {
      setBusy(btn, false, old || "Giriş Yap");
    }
  }

  // --------- GLOBAL CLICK CAPTURE (üst üste JS olsa bile yakalar) ----------
  document.addEventListener("click", function(e){
    const t = e.target;

    // Topbar: Giriş Yap / Kayıt Ol
    if (t?.closest?.("#btnLoginTop")) {
      e.preventDefault(); e.stopPropagation();
      openModal("login");
      return;
    }
    if (t?.closest?.("#btnRegisterTop")) {
      e.preventDefault(); e.stopPropagation();
      openModal("register");
      return;
    }

    // Modal submit
    if (t?.closest?.("#btnAuthSubmit")) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      handleSubmit();
      return;
    }

    // Modal kapat (X) — toleranslı
    if (t?.closest?.(".login-modal .close, .login-modal [data-close], .login-modal .x, .login-modal .btn-close")) {
      e.preventDefault(); e.stopPropagation();
      closeModal();
      return;
    }
  }, true);

  // Modal hazır olunca UI senkron
  waitForModalReady((modal) => {
    applyModeUI(modal);

    if (!modal.__aivoModeObs){
      modal.__aivoModeObs = true;
      try {
        const obs = new MutationObserver(() => applyModeUI(modal));
        obs.observe(modal, { attributes:true, attributeFilter:["data-mode"] });
      } catch(_){}
    }
  });

})();
// ===============================
// AIVO AUTH CORE — SINGLE AUTHORITY LOGOUT (FINAL)
// Trigger: [data-action="logout"]
// Action : POST /api/auth/logout -> cleanup -> redirect
// Notes  : left-click only + sets "aivo_logged_out" guard for auto-redirect blockers
// ===============================
(function initSingleAuthorityLogout() {
  if (window.__AIVO_LOGOUT_INIT__) return;
  window.__AIVO_LOGOUT_INIT__ = true;

  async function doLogout({ redirectTo = "/" } = {}) {
    if (doLogout.__busy) return;
    doLogout.__busy = true;

    // ✅ Guard: logout sonrası auto-studio redirect varsa kırmak için
    try { sessionStorage.setItem("aivo_logged_out", String(Date.now())); } catch (_) {}

    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      // body boş olabilir -> text ile güvenli oku
      try { await res.text(); } catch (_) {}

      // 2) Client cleanup — auth + redirect intentlerini TAM temizle
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
      ];
      for (const k of lsKeysToDelete) {
        try { localStorage.removeItem(k); } catch (_) {}
      }

      const ssKeysToDelete = [
        "aivo_after_login",
        "after_login_redirect",
        "return_after_login",
        "returnAfterLogin",
        "aivo_intent",
        "login_redirect",
        "post_login_redirect",
        "aivo_login_state",
        // NOTE: aivo_logged_out kalsın (guard)
      ];
      for (const k of ssKeysToDelete) {
        try { sessionStorage.removeItem(k); } catch (_) {}
      }

      window.location.replace(redirectTo);
    } catch (_) {
      // fail-safe: yine redirect
      window.location.replace(redirectTo);
    } finally {
      doLogout.__busy = false;
    }
  }

  document.addEventListener(
    "click",
    (e) => {
      // ✅ Sağ tık / orta tık logout tetiklemesin
      if (typeof e.button === "number" && e.button !== 0) return;

      const btn = e.target?.closest?.('[data-action="logout"]');
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();

      // İsteğe bağlı: buton busy
      try { btn.setAttribute("aria-busy", "true"); } catch (_) {}

      const redirectTo = btn.getAttribute("data-redirect") || "/";
      doLogout({ redirectTo });
    },
    true
  );
})();
