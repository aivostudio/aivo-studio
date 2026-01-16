(() => {
  if (window.__AIVO_LOGOUT_INIT__) return;
  window.__AIVO_LOGOUT_INIT__ = true;

  async function doLogout(redirectTo = "/") {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
    } catch (e) {
      // network olsa bile client temizle
    }

    // client cleanup (auth ile ilgili)
    try { localStorage.removeItem("aivo_logged_in"); } catch(e){}
    try { localStorage.removeItem("aivo_user_email"); } catch(e){}
    try { localStorage.removeItem("aivo_user"); } catch(e){}
    try { localStorage.removeItem("aivo_session"); } catch(e){}
    try { sessionStorage.removeItem("aivo_after_login"); } catch(e){}
    try { sessionStorage.removeItem("aivo_selected_pack"); } catch(e){}

    // auth.core state
    try { window.__AIVO_SESSION__ = { ok:false }; } catch(e){}

    location.replace(redirectTo);
  }

  document.addEventListener("click", (e) => {
    // sadece sol tık
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const el = e.target?.closest?.('[data-action="logout"]');
    if (!el) return;

    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();

    const redirectTo = el.getAttribute("data-redirect") || "/";
    doLogout(redirectTo);
  }, true);
})();
