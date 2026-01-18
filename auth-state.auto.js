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
// auth-state.auto.js
(function () {
  let armed = false;
  let tried = false;

  function qs(id) { return document.getElementById(id); }

  function hasValue(el) {
    return !!(el && typeof el.value === "string" && el.value.trim().length > 0);
  }

  function doSubmit() {
    const btn = qs("btnAuthSubmit");
    if (!btn) return false;

    // 1) Eğer sistem bir global fonksiyon expose ediyorsa (ileride Initiator ile netleşince buraya bağlayacağız)
    if (typeof window.doLogin === "function") { window.doLogin(); return true; }
    if (typeof window.authSubmit === "function") { window.authSubmit(); return true; }

    // 2) Fallback: gerçek handler click değilse bile bazı sistemlerde pointerdown tetikler
    try {
      btn.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
      btn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      return true;
    } catch (_) {
      // Safari PointerEvent yoksa
      btn.click();
      return true;
    }
  }

  function armAutoLoginOnceReady() {
    const email = qs("loginEmail");
    const pass  = qs("loginPass");
    const btn   = qs("btnAuthSubmit");
    if (!email || !pass || !btn) return false;

    if (armed) return true;
    armed = true;

    // Enter ile
    pass.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        // form submit yok; biz submit yolunu çağırıyoruz
        if (hasValue(email) && hasValue(pass) && !tried) {
          tried = true;
          doSubmit();
        }
      }
    });

    // Autofill event çoğu zaman düşmez → küçük bir “poll”
    let ticks = 0;
    const timer = setInterval(() => {
      ticks++;

      // 8 saniye sonra vazgeç (sonsuz interval kalmasın)
      if (ticks > 80) { clearInterval(timer); return; }

      // Kullanıcı zaten logged-in olduysa veya modal kapandıysa istersen burada ek kontrol yaparsın
      if (!tried && hasValue(email) && hasValue(pass)) {
        // burada istersen email valid mi diye kontrol ekleyebilirsin
        tried = true;
        clearInterval(timer);
        doSubmit();
      }
    }, 100);

    return true;
  }

  // Modal DOM’u bazen partial ile sonradan geldiği için:
  function boot() {
    // hemen dene
    if (armAutoLoginOnceReady()) return;

    // gelene kadar izle
    const mo = new MutationObserver(() => {
      if (armAutoLoginOnceReady()) mo.disconnect();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
