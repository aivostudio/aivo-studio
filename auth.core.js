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

     if (!isValidEmail(email)) { try{ if(window.toast) toast.error("Geçersiz email","Geçerli email gir."); }catch(_){} return; }
if (!name) { try{ if(window.toast) toast.error("Eksik bilgi","Ad Soyad gir."); }catch(_){} return; }
if (!pass || pass.length < 6) { try{ if(window.toast) toast.error("Zayıf şifre","Şifre en az 6 karakter olmalı."); }catch(_){} return; }
if (pass !== pass2) { try{ if(window.toast) toast.error("Şifre uyuşmuyor","Şifreler aynı değil."); }catch(_){} return; }
if (!kvkk) { try{ if(window.toast) toast.warning("Onay gerekli","KVKK ve şartları kabul etmelisin."); }catch(_){} return; }


      const old = btn.textContent;
      setBusy(btn, true, "Hesap oluşturuluyor...");

      try {
        const { res, text, data } = await postJSON("/api/auth/register", { email, password: pass, name });

        if (!res.ok || data?.ok === false){
          try{ if(window.toast) toast.error("Kayıt başarısız", safeMsg(data?.error || data?.message || text || "Kayıt başarısız.")); }catch(_){} 

          return;
        }

        try{ if(window.toast) toast.success("Kayıt başarılı","Doğrulama için e-postanı kontrol et. (Spam’i de kontrol et)"); }catch(_){} 

        setMode(modal, "login");
        applyModeUI(modal);

     } catch (err){
  console.error("AIVO_LOGIN_FETCH_FAIL:", err);
  try{ if(window.toast) toast.error("Bağlantı hatası","Tekrar dene."); }catch(_){} 



      } finally {
        setBusy(btn, false, old || "Hesap Oluştur");
      }
      return;
    }

    // LOGIN
    const email = v("loginEmail").toLowerCase();
    const pass  = v("loginPass");

    if (!isValidEmail(email) || !pass){
     try{ if(window.toast) toast.error("Eksik bilgi","E-posta ve şifre gir."); }catch(_){} 

      return;
    }

    const old = btn.textContent;
    setBusy(btn, true, "Giriş yapılıyor...");

    try {
      const { res, text, data } = await postJSON("/api/auth/login", { email, password: pass });

      if (!res.ok || data?.ok === false){
      try{ if(window.toast) toast.error("Giriş başarısız", safeMsg(data?.error || data?.message || text || "E-posta veya şifre hatalı.")); }catch(_){} 

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
// AIVO AUTH CORE — SINGLE AUTHORITY LOGOUT
// Trigger: [data-action="logout"]
// Action : POST /api/auth/logout -> cleanup -> redirect
// Notes  : only LEFT click, ignore right-click/inspect, reduce false hits
// ===============================
(function initSingleAuthorityLogout() {
  if (window.__AIVO_LOGOUT_INIT__) return;
  window.__AIVO_LOGOUT_INIT__ = true;

  function isVisible(el) {
    try {
      const r = el.getBoundingClientRect();
      if (!r || (r.width === 0 && r.height === 0)) return false;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return false;
      return true;
    } catch (_) {
      return true; // fail-open
    }
  }

  async function doLogout({ redirectTo = "/" } = {}) {
    if (doLogout.__busy) return;
    doLogout.__busy = true;

    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      try { await res.json(); } catch (_) {}

      // auth + redirect intentlerini TAM temizle (credits/jobs vs. dokunma)
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
      lsKeysToDelete.forEach((k) => { try { localStorage.removeItem(k); } catch (_) {} });

      const ssKeysToDelete = [
        "aivo_after_login",
        "after_login_redirect",
        "return_after_login",
        "returnAfterLogin",
        "aivo_intent",
        "login_redirect",
        "post_login_redirect",
        "aivo_login_state",
      ];
      ssKeysToDelete.forEach((k) => { try { sessionStorage.removeItem(k); } catch (_) {} });

      window.location.replace(redirectTo);
    } catch (_) {
      try {
        localStorage.removeItem("aivo_logged_in");
        localStorage.removeItem("aivo_user");
        localStorage.removeItem("aivo_token");
        sessionStorage.removeItem("after_login_redirect");
        sessionStorage.removeItem("return_after_login");
        sessionStorage.removeItem("aivo_intent");
      } catch (_) {}
      window.location.replace(redirectTo);
    } finally {
      doLogout.__busy = false;
    }
  }

  // Global delegated listener (tek otorite)
  document.addEventListener("click", (e) => {
    // ✅ sadece SOL tık
    if (e.button !== 0) return;

    // ✅ inspect / yeni sekme / ctrl+click gibi davranışları dışla
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const el = e.target?.closest?.('[data-action="logout"]');
    if (!el) return;

    // ✅ sadece button/a hedefle (yanlış eşleşmeyi azalt)
    const tag = (el.tagName || "").toUpperCase();
    if (tag !== "BUTTON" && tag !== "A") return;

    // ✅ görünür değilse tetikleme (rect 0 sorunun için koruma)
    if (!isVisible(el)) return;

    e.preventDefault();
    e.stopPropagation();

    const redirectTo = el.getAttribute("data-redirect") || "/";
    doLogout({ redirectTo });
  }, true);

  // ✅ ekstra güvenlik: right-click contextmenu asla logout tetiklemesin
  document.addEventListener("contextmenu", () => {}, true);
})();



// ===============================
// GLOBAL LOGOUT (TEK OTORİTE)
// ===============================
async function doLogout(redirectTo = "/") {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include"
    });
  } catch (e) {
    // network olsa bile client temizlenecek
  }

   
  // Client-side canonical cleanup
  try { localStorage.removeItem("aivo_logged_in"); } catch(e){}
  try { localStorage.removeItem("aivo_user_email"); } catch(e){}
  try { localStorage.removeItem("aivo_auth"); } catch(e){}

  location.replace(redirectTo);
} 
