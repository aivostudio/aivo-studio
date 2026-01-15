/* =========================================================
   AIVO AUTH CORE — SINGLE OWNER (NO CONFLICT)
   - Modal:  #loginModal
   - Submit: #btnAuthSubmit
   - Login:  POST /api/auth/login   (ONLY)
   - Register: (optional) POST /api/auth/register
   - NO auto-logout on page load
   ========================================================= */
(() => {
  if (window.__AIVO_AUTH_CORE__) return;
  window.__AIVO_AUTH_CORE__ = true;

  const MAX_MS = 20000;
  const started = Date.now();

  const qs  = (sel, root=document) => root.querySelector(sel);
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

  function waitForModal(cb){
    (function tick(){
      const modal = byId("loginModal");
      const btn   = byId("btnAuthSubmit");
      if (modal && btn) return cb(modal, btn);
      if (Date.now() - started > MAX_MS) return;
      setTimeout(tick, 120);
    })();
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

  function setBusy(btn, busy, text){
    btn.disabled = !!busy;
    if (text != null) btn.textContent = text;
  }

  function getAfter(){
    return sessionStorage.getItem("aivo_after_login") || "/studio.html";
  }

  function clearAfter(){
    try { sessionStorage.removeItem("aivo_after_login"); } catch(_){}
  }

  function setLoggedIn(email){
    try { localStorage.setItem("aivo_logged_in", "1"); } catch(_){}
    if (email) { try { localStorage.setItem("aivo_user_email", email); } catch(_){ } }
  }

  function setLoggedOut(){
    try { localStorage.removeItem("aivo_logged_in"); } catch(_){}
    try { localStorage.removeItem("aivo_token"); } catch(_){}
    // email’i istersen sakla, istersen sil:
    // try { localStorage.removeItem("aivo_user_email"); } catch(_){}
  }

  // PUBLIC logout helper (header butonu vb. çağırabilsin)
  window.AIVO_LOGOUT = async function(){
    try { await fetch("/api/auth/logout", { method:"POST", credentials:"include", cache:"no-store" }); } catch(_){}
    setLoggedOut();
    location.href = "/";
  };

  waitForModal((modal, btn) => {
    // modal DOM’u partials ile sonradan geliyorsa yakala
    if (!modal.__aivoModeObs){
      modal.__aivoModeObs = true;
      try {
        const obs = new MutationObserver(() => applyModeUI(modal));
        obs.observe(modal, { attributes:true, attributeFilter:["data-mode"] });
      } catch(_){}
    }

    applyModeUI(modal);

    // ✅ tek bind
    if (btn.__aivoBoundCore) return;
    btn.__aivoBoundCore = true;

    const v  = (id) => (byId(id)?.value || "").trim();
    const on = (id) => !!byId(id)?.checked;

    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();

      const mode = String(modal.getAttribute("data-mode") || "login").toLowerCase();
      const isReg = mode === "register";

      // --- REGISTER (opsiyonel) ---
      if (isReg){
        // Eğer backend yoksa burada net konuşalım:
        alert("Register endpoint şu an bağlı değil. (Sadece Login aktif)");
        setMode(modal, "login");
        return;
      }

      // --- LOGIN ---
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

        // başarı
        setLoggedIn(data?.user?.email || email);

        // kapat
        try {
          if (typeof window.closeAuthModal === "function") window.closeAuthModal();
          else { modal.classList.remove("is-open"); modal.setAttribute("aria-hidden","true"); }
        } catch(_){}

        const after = getAfter();
        clearAfter();
        location.href = after;

      } catch (err){
        alert("Bağlantı hatası. Tekrar dene.");
      } finally {
        setBusy(btn, false, old || "Giriş Yap");
      }
    }, true);
  });

})();
