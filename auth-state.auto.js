/* auth-state.auto.js — V2 (NO FETCH OVERRIDE) */
(() => {
  const KEY_LOGGED = "aivo_logged_in";
  const KEY_EMAIL  = "aivo_user_email";
  const KEY_FALLBACK = "aivo_auth";

  const setLoggedOut = () => {
    try {
      localStorage.setItem(KEY_LOGGED, "0");
      localStorage.removeItem(KEY_EMAIL);
      // fallback temizliği (varsa)
      const raw = localStorage.getItem(KEY_FALLBACK);
      if (raw) {
        try {
          const o = JSON.parse(raw);
          if (o && typeof o === "object") {
            o.loggedIn = false;
            delete o.email;
            localStorage.setItem(KEY_FALLBACK, JSON.stringify(o));
          }
        } catch {}
      }
    } catch {}
    document.body.dataset.userLoggedIn = "0";
  };

  const setLoggedIn = (email) => {
    try {
      localStorage.setItem(KEY_LOGGED, "1");
      if (email) localStorage.setItem(KEY_EMAIL, email);
      // fallback update (varsa)
      const raw = localStorage.getItem(KEY_FALLBACK);
      if (raw) {
        try {
          const o = JSON.parse(raw);
          if (o && typeof o === "object") {
            o.loggedIn = true;
            if (email) o.email = email;
            localStorage.setItem(KEY_FALLBACK, JSON.stringify(o));
          }
        } catch {}
      }
    } catch {}
    document.body.dataset.userLoggedIn = "1";
  };

  const killLoaderIfAny = () => {
    // "Studio hazırlanıyor..." veya global loader varsa
    const el =
      document.querySelector(".studio-prep, .preloader, #pageLoader, #studioPreparing, [data-loader]");
    if (el) el.remove();
    document.documentElement.classList.remove("is-loading");
    document.body.classList.remove("is-loading");
  };

  const bootstrap = async () => {
    // optimistic: local state'e göre dataset bas (UI hızlı gelsin)
    try {
      const logged = localStorage.getItem(KEY_LOGGED);
      document.body.dataset.userLoggedIn = logged === "1" ? "1" : "0";
    } catch {}

    // server truth
    try {
      const r = await fetch("/api/auth/me", { method: "GET" });
      if (!r.ok) {
        setLoggedOut();
        killLoaderIfAny();
        return;
      }
      const data = await r.json().catch(() => ({}));
      // beklenen: { loggedIn: true/false, email?: "..." } (senin API şekline göre uyarlanabilir)
      if (data && (data.loggedIn === true || data.ok === true || data.user)) {
        const email = data.email || (data.user && data.user.email) || "";
        setLoggedIn(email);
      } else {
        setLoggedOut();
      }
    } catch (e) {
      // network fail: local state ile kal ama pending'e düşmemeli
      // burada resolve olmazsa zaten fetch native ise düşmez.
    } finally {
      killLoaderIfAny();
    }
  };

  // DOM hazır olunca koş
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
(async function authBootstrap() {
  try {
    const res = await fetch('/api/auth/me', {
      credentials: 'include'
    });

    if (res.status === 401) {
      if (typeof window.openLoginModal === 'function') {
        window.openLoginModal();
      } else {
        document.documentElement.classList.add('is-guest');
      }
    } else if (res.status === 200) {
      document.documentElement.classList.add('is-auth');
    }
  } catch (e) {
    console.warn('auth bootstrap failed', e);
  }
})();
