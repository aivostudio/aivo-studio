/* auth-state.auto.js — SAFE v3 (Enter helper only)
   - NO /api/auth/me calls
   - NO localStorage auth state
   - NO UI class toggles
   - NO loader removal
   - NO autofill auto-submit
   Goal:
   - Login modal açıkken sadece Enter desteği sağlamak
   - Autofill/password manager alan doldursa bile kendi kendine login denememek
   - Mevcut auth.core submit yolunu ikinci bir auth beyni olmadan kullanmak
*/
(() => {
  "use strict";

  if (window.__AIVO_AUTH_STATE_AUTO__) return;
  window.__AIVO_AUTH_STATE_AUTO__ = true;

  const CFG = {
    emailId: "loginEmail",
    passId: "loginPass",
    submitId: "btnAuthSubmit",
    inflightWindowMs: 4500,
  };

  let armedForThisOpen = false;
  let triedForThisOpen = false;
  let resetWatchTimer = null;

  const qs = (id) => document.getElementById(id);
  const existsInBody = (el) => !!(el && document.body.contains(el));
  const rawVal = (el) => (el && typeof el.value === "string" ? el.value : "");
  const trimmed = (s) => (typeof s === "string" ? s.trim() : "");
  const emailNorm = (s) => trimmed(s).toLowerCase();

  function isProbablyVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function clearTimers() {
    if (resetWatchTimer) {
      clearInterval(resetWatchTimer);
      resetWatchTimer = null;
    }
  }

  function resetForNextOpen() {
    armedForThisOpen = false;
    triedForThisOpen = false;
    clearTimers();
  }

  function acquireInflightLock() {
    const now = Date.now();
    const key = "__AIVO_LOGIN_INFLIGHT_UNTIL__";
    const until = Number(window[key] || 0);
    if (until && until > now) return false;
    window[key] = now + CFG.inflightWindowMs;
    return true;
  }

  function dispatchSubmitFallback(btn) {
    try {
      btn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      btn.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      return true;
    } catch (_) {
      try {
        btn.click();
        return true;
      } catch (_) {}
      return false;
    }
  }

  function callKnownSubmitAPI() {
    try {
      if (window.__AIVO_AUTH__ && typeof window.__AIVO_AUTH__.submitLogin === "function") {
        window.__AIVO_AUTH__.submitLogin();
        return true;
      }
      if (typeof window.submitLogin === "function") {
        window.submitLogin();
        return true;
      }
      if (typeof window.doLogin === "function") {
        window.doLogin();
        return true;
      }
    } catch (_) {}
    return false;
  }

  function safeSubmitNow() {
    if (triedForThisOpen) return false;
    triedForThisOpen = true;

    if (!acquireInflightLock()) return false;

    if (callKnownSubmitAPI()) return true;

    const btn = qs(CFG.submitId);
    if (!btn) return false;

    return dispatchSubmitFallback(btn);
  }

  function handleEnterSubmit() {
    const emailEl = qs(CFG.emailId);
    const passEl = qs(CFG.passId);
    const btnEl = qs(CFG.submitId);

    if (!emailEl || !passEl || !btnEl) return false;
    if (!existsInBody(emailEl) || !existsInBody(passEl) || !existsInBody(btnEl)) return false;
    if (!isProbablyVisible(passEl) && !isProbablyVisible(btnEl)) return false;

    const email = emailNorm(rawVal(emailEl));
    const pass = trimmed(rawVal(passEl));

    if (!email || !pass) return false;

    return safeSubmitNow();
  }

  function armIfLoginDomReady() {
    const email = qs(CFG.emailId);
    const pass = qs(CFG.passId);
    const btn = qs(CFG.submitId);

    if (!email || !pass || !btn) return false;
    if (!isProbablyVisible(pass) && !isProbablyVisible(btn)) return false;

    if (armedForThisOpen) return true;
    armedForThisOpen = true;
    triedForThisOpen = false;

    if (!pass.__aivoEnterBound) {
      pass.__aivoEnterBound = true;

      pass.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        handleEnterSubmit();
      });
    }

    if (!email.__aivoEnterBound) {
      email.__aivoEnterBound = true;

      email.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        handleEnterSubmit();
      });
    }

    // Autofill auto-submit KAPALI.
    // Chrome/Safari password manager alanları doldursa bile kendi kendine login denenmez.
    // Submit sadece kullanıcının Enter basması veya normal buton tıklamasıyla olur.

    if (!resetWatchTimer) {
      resetWatchTimer = setInterval(() => {
        const p = qs(CFG.passId);
        const b = qs(CFG.submitId);

        if ((!p || !b) && (armedForThisOpen || triedForThisOpen)) {
          resetForNextOpen();
        }
      }, 600);
    }

    return true;
  }

  function boot() {
    armIfLoginDomReady();

    const mo = new MutationObserver(() => {
      armIfLoginDomReady();
    });

    mo.observe(document.documentElement, { childList: true, subtree: true });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) armIfLoginDomReady();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
