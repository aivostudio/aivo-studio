/* =========================================================
   AIVO AUTH CORE — SINGLE OWNER (NO CONFLICT)  ✅ FINAL
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

  async function handleSubmit(){
    const modal = byId("loginModal") || q(".login-modal");
    const btn   = byId("btnAuthSubmit");
    if (!modal || !btn) return;

    const mode = String(modal.getAttribute("data-mode") || "login").toLowerCase();
    const isReg = mode === "register";

    const v  = (id) => (byId(id)?.value || "").trim();
    const on = (id) => !!byId(id)?.checked;

    if (isReg){
      const email = v("loginEmail").toLowerCase();
      const pass  = v("loginPass");
      const name  = v("registerName");
      const pass2 = v("registerPass2");
      const kvkk  = on("kvkkCheck");

      if (!isValidEmail(email)) { toast.error("Geçersiz e-posta"); return; }
      if (!name) { toast.error("Ad Soyad gerekli"); return; }
      if (!pass || pass.length < 6) { toast.error("Şifre en az 6 karakter"); return; }
      if (pass !== pass2) { toast.error("Şifreler aynı değil"); return; }
      if (!kvkk) { toast.warning("KVKK onayı gerekli"); return; }

      const old = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Hesap oluşturuluyor...";

      try {
        const { res, text, data } = await postJSON("/api/auth/register", { email, password: pass, name });

        if (!res.ok || data?.ok === false){
          toast.error("Kayıt başarısız", safeMsg(data?.error || data?.message || text));
          return;
        }

        toast.success("Kayıt başarılı", "Doğrulama için e-postanı kontrol et.");
        modal.setAttribute("data-mode", "login");

      } catch (err){
        console.error("AIVO_REGISTER_FAIL:", err);
        toast.error("Bağlantı hatası", "Tekrar dene.");
      } finally {
        btn.disabled = false;
        btn.textContent = old || "Hesap Oluştur";
      }
      return;
    }

    const email = v("loginEmail").toLowerCase();
    const pass  = v("loginPass");

    if (!isValidEmail(email) || !pass){
      toast.error("E-posta ve şifre gerekli");
      return;
    }

    const old = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Giriş yapılıyor...";

    try {
      const { res, text, data } = await postJSON("/api/auth/login", { email, password: pass });

      if (!res.ok || data?.ok === false){
        toast.error("Giriş başarısız", safeMsg(data?.error || data?.message || text));
        return;
      }

      location.href = "/studio.html";

    } catch (err){
      console.error("AIVO_LOGIN_FAIL:", err);
      toast.error("Bağlantı hatası", "Tekrar dene.");
    } finally {
      btn.disabled = false;
      btn.textContent = old || "Giriş Yap";
    }
  }

  document.addEventListener("click", function(e){
    if (e.target?.closest?.("#btnAuthSubmit")) {
      e.preventDefault();
      handleSubmit();
    }
  }, true);

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

