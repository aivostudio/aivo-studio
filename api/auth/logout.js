(function initSingleAuthorityLogout() {
  if (window.__AIVO_LOGOUT_INIT__) return;
  window.__AIVO_LOGOUT_INIT__ = true;

  function isActuallyVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 5 && r.height > 5;
  }

  async function doLogout({ redirectTo = "/" } = {}) {
    if (doLogout.__busy) return;
    doLogout.__busy = true;

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      }).catch(() => {});

      // Auth + redirect intent cleanup
      [
        "aivo_logged_in",
        "aivo_user",
        "aivo_auth",
        "aivo_session",
        "aivo_after_login",
        "after_login_redirect",
        "return_after_login",
        "aivo_intent",
      ].forEach(k => {
        try { localStorage.removeItem(k); } catch (_) {}
        try { sessionStorage.removeItem(k); } catch (_) {}
      });

      location.replace(redirectTo);
    } finally {
      doLogout.__busy = false;
    }
  }

  document.addEventListener("click", (e) => {
    const candidate = e.target?.closest?.('[data-action="logout"]');
    if (!candidate) return;

    // 🔴 KRİTİK GUARD
    if (!isActuallyVisible(candidate)) return;

    e.preventDefault();
    e.stopPropagation();

    const redirectTo = candidate.getAttribute("data-redirect") || "/";
    doLogout({ redirectTo });
  }, true);
})();
