/* =========================================================
   AIVO AUTH CORE — SINGLE OWNER (NO CONFLICT)  ✅ FINAL
   - Modal:  #loginModal OR .login-modal (toleranslı)
   - Submit: #btnAuthSubmit   (text: "Giriş Yap" / "Hesap Oluştur")
   - Login:  POST /api/auth/login
   - Register: POST /api/auth/register
   - Session: GET  /api/auth/me  -> window.__AIVO_SESSION__ (tek otorite)
   - Logout : POST /api/auth/logout (tek otorite)
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

  // ===============================
  // ✅ SESSION REFRESH (TEK OTORITE)
  // ===============================
  async function refreshSession(){
    try {
      const res = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { "Accept": "application/json" },
      });

      if (res.status === 200) {
        let data = {};
        try { data = await res.json(); } catch(_){}
        // ✅ TEK KAYNAK
        window.__AIVO_SESSION__ = data && typeof data === "object"
          ? { ...data, ok: true }
          : { ok: true };

        // legacy fallback (şimdilik dursun)
        try {
          if (window.__AIVO_SESSION__?.email) localStorage.setItem("aivo_user_email", window.__AIVO_SESSION__.email);
          localStorage.setItem("aivo_logged_in", "1");
        } catch(_){}

        return window.__AIVO_SESSION__;
      }

      // 401/403 vs → net false
      window.__AIVO_SESSION__ = { ok: false };
      try { localStorage.removeItem("aivo_logged_in"); } catch(_){}
      return window.__AIVO_SESSION__;
    } catch(_) {
      // network fail → fail-closed
      window.__AIVO_SESSION__ = { ok: false };
      return window.__AIVO_SESSION__;
    }
  }

  // dışarıya küçük yardımcılar (PricingHub / diğer sayfalar için)
  window.AIVO_AUTH = window.AIVO_AUTH || {};
  window.AIVO_AUTH.refreshSession = refreshSession;
  window.AIVO_AUTH.isAuthed = function(){
    try { return !!(window.__AIVO_SESSION__ && window.__AIVO_SESSION__.ok); } catch(_) { return false; }
  };
  window.AIVO_AUTH.getEmail = function(){
    try {
      const e = (window.__AIVO_SESSION__ && window.__AIVO_SESSION__.email) ? String(window.__AIVO_SESSION__.email).trim() : "";
      if (e) return e;
    } catch(_){}
    try { return (localStorage.getItem("aivo_user_email") || "").trim(); } catch(_){}
    return "";
  };

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

      // legacy (şimdilik)
      try { localStorage.setItem("aivo_logged_in", "1"); } catch(_){}
      try { localStorage.setItem("aivo_user_email", data?.user?.email || email); } catch(_){}

      // ✅ hemen session'ı güncelle (tek otorite)
      await refreshSession();

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

  // ===============================
  // ✅ LOGOUT (TEK OTORITE)
  // Trigger: [data-action="logout"]
  // ===============================
  async function doLogout(redirectTo = "/"){
    if (doLogout.__busy) return;
    doLogout.__busy = true;

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Accept": "application/json" }
      });
    } catch(_){}

    // ✅ canonical cleanup (auth ile ilgili olanlar)
    const lsKeys = ["aivo_logged_in","aivo_user_email","aivo_user","aivo_token","aivo_session","aivo_auth"];
    const ssKeys = ["aivo_after_login","aivo_selected_pack","aivo_return_after_payment"];
    lsKeys.forEach(k => { try{ localStorage.removeItem(k);}catch(_){ } });
    ssKeys.forEach(k => { try{ sessionStorage.removeItem(k);}catch(_){ } });

    window.__AIVO_SESSION__ = { ok:false };

    location.replace(redirectTo);
  }
  window.AIVO_AUTH.logout = doLogout;

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

    // ✅ Logout (her yerde)
    const lo = t?.closest?.('[data-action="logout"]');
    if (lo) {
      e.preventDefault(); e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      const redirectTo = lo.getAttribute("data-redirect") || "/";
      doLogout(redirectTo);
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

  // ✅ sayfa açılışında session'ı bir kez dene (topbar doğru çizilsin)
  refreshSession();

})();
