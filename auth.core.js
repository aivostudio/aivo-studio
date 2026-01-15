/* =========================================================
   AIVO AUTH CORE — SINGLE OWNER (NO CONFLICT)
   - Modal:  #loginModal
   - Submit: #btnAuthSubmit
   - Login:  POST /api/auth/login
   - Register: POST /api/auth/register
   ========================================================= */
(() => {
  if (window.__AIVO_AUTH_CORE__) return;
  window.__AIVO_AUTH_CORE__ = true;

  const MAX_MS = 20000;
  const started = Date.now();

  const byId = (id) => document.getElementById(id);

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

  function setMode(modal, mode){
    modal.setAttribute("data-mode", mode);
  }

  function applyModeUI(modal){
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

    const btn = byId("btnAuthSubmit");
    if (btn) btn.textContent = isReg ? "Hesap Oluştur" : "Giriş Yap";
  }

  function openModal(mode){
    const modal = byId("loginModal");
    if (!modal) return;

    setMode(modal, mode);
    applyModeUI(modal);

    modal.classList.add("is-open");
    modal.style.display = "block";
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal(){
    const modal = byId("loginModal");
    if (!modal) return;
    try {
      if (typeof window.closeAuthModal === "function") window.closeAuthModal();
      else {
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

  // --------- MODAL DOM’u gelene kadar bekle ----------
  function waitForModalReady(cb){
    (function tick(){
      const modal = byId("loginModal");
      const btn   = byId("btnAuthSubmit");
      if (modal && btn) return cb(modal, btn);
      if (Date.now() - started > MAX_MS) return;
      setTimeout(tick, 120);
    })();
  }

  // --------- SUBMIT handler (Login/Register) ----------
  async function handleSubmit(){
    const modal = byId("loginModal");
    const btn   = byId("btnAuthSubmit");
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
      if (!pass || pass.length < 6) { alert("Şifre en az 6 karakter olmalı."); return; }
      if (pass !== pass2) { alert("Şifreler aynı değil."); return; }
      if (!name) { alert("Ad Soyad gir."); return; }
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

    } catch (err){
      alert("Bağlantı hatası. Tekrar dene.");
    } finally {
      setBusy(btn, false, old || "Giriş Yap");
    }
  }

  // --------- GLOBAL CLICK CAPTURE (BUTONLAR “BASMIYOR” sorununu bitirir) ----------
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

    // Modal submit (Giriş Yap / Hesap Oluştur)
    if (t?.closest?.("#btnAuthSubmit")) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      handleSubmit();
      return;
    }

    // Modal kapat (X)
    if (t?.closest?.("#loginModal .close, #loginModal [data-close], #loginModal .x, #loginModal .btn-close")) {
      e.preventDefault(); e.stopPropagation();
      closeModal();
      return;
    }
  }, true);

  // Modal hazır olunca UI’ı senkronla
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
