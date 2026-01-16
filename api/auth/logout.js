(function initSingleAuthorityLogout() {
  if (window.__AIVO_LOGOUT_INIT__) return;
  window.__AIVO_LOGOUT_INIT__ = true;

  async function doLogout({ redirectTo = "/" } = {}) {
    if (doLogout.__busy) return;
    doLogout.__busy = true;

    try {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
        });
      } catch (_) {}

      // Auth + redirect intent cleanup (credits/jobs dokunma)
      const keys = [
        "aivo_logged_in",
        "aivo_user",
        "aivo_user_email",
        "aivo_auth",
        "aivo_session",
        "aivo_after_login",
        "after_login_redirect",
        "return_after_login",
        "aivo_intent",
      ];
      keys.forEach((k) => {
        try { localStorage.removeItem(k); } catch (_) {}
        try { sessionStorage.removeItem(k); } catch (_) {}
      });

      location.replace(redirectTo);
    } finally {
      doLogout.__busy = false;
    }
  }

  document.addEventListener("click", (e) => {
    // sadece SOL tık
    if (e.button !== 0) return;
    // ctrl/cmd/shift/alt ile tetikleme
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const candidate = e.target?.closest?.('[data-action="logout"]');
    if (!candidate) return;

    // sadece BUTTON/A
    const tag = (candidate.tagName || "").toUpperCase();
    if (tag !== "BUTTON" && tag !== "A") return;

    e.preventDefault();
    e.stopPropagation();

    const redirectTo = candidate.getAttribute("data-redirect") || "/";
    doLogout({ redirectTo });
  }, true);
})();
