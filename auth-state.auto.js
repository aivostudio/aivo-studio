/* auth-state.auto.js — SAFE v2 (only auto-login helper)
   - NO /api/auth/me calls
   - NO localStorage auth state
   - NO UI class toggles
   - NO loader removal
   Goal: When login modal is open and password is autofilled (or Enter pressed),
         trigger existing login submit path WITHOUT becoming a second auth brain.

   Improvements:
   - Stabilization delay (autofill race fix)
   - In-flight lock (prevents double submit)
   - Email normalize (trim + lower)
   - Robust reset when modal removed
*/
(() => {
  "use strict";

  const CFG = {
    emailId: "loginEmail",
    passId: "loginPass",
    submitId: "btnAuthSubmit",

    pollMs: 150,
    maxPollMs: 9000,

    // Autofill bazen value'yu kademeli yazar; dolu görünür görünmez basmayalım
    stabilizeMs: 450,

    // Aynı açılışta sadece 1 defa dene
    oncePerOpen: true,

    // Global kilit: aynı anda ikinci submit’i engeller
    inflightWindowMs: 4500,
  };

  let armedForThisOpen = false;
  let triedForThisOpen = false;

  let pollTimer = null;
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
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (resetWatchTimer) { clearInterval(resetWatchTimer); resetWatchTimer = null; }
  }

  function resetForNextOpen() {
    armedForThisOpen = false;
    triedForThisOpen = false;
    clearTimers();
  }

  // Basit global kilit (çift submit’i engeller)
  function acquireInflightLock() {
    const now = Date.now();
    const key = "__AIVO_LOGIN_INFLIGHT_UNTIL__";
    const until = Number(window[key] || 0);
    if (until && until > now) return false;
    window[key] = now + CFG.inflightWindowMs;
    return true;
  }

  // submit denemesi bitince kilidi erken bırakmak istersen burada bırakabilirsin.
  // Biz fail-safe için window süresini kullanıyoruz.

  function dispatchSubmitFallback(btn) {
    try {
      // Bazı delegation senaryoları mousedown ile başlıyor
      btn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      btn.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      return true;
    } catch (_) {
      try { btn.click(); return true; } catch (_) {}
      return false;
    }
  }

  function callKnownSubmitAPI() {
    // Eğer auth.core ileride bir API expose ederse burada direkt çağırırız.
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
    // “bir açılışta bir deneme” kuralı
    if (triedForThisOpen) return false;
    triedForThisOpen = true;

    // global kilit
    if (!acquireInflightLock()) return false;

    // Önce direkt API (varsa)
    if (callKnownSubmitAPI()) return true;

    // Fallback: buton event zinciri
    const btn = qs(CFG.submitId);
    if (!btn) return false;
    return dispatchSubmitFallback(btn);
  }

  // Autofill race çözümü: stabilizeMs bekle, sonra tekrar oku, hala doluysa submit et
  function safeSubmitStabilized() {
    const emailEl = qs(CFG.emailId);
    const passEl  = qs(CFG.passId);
    const btnEl   = qs(CFG.submitId);

    if (!emailEl || !passEl || !btnEl) return false;
    if (!isProbablyVisible(passEl) && !isProbablyVisible(btnEl)) return false;

    // İlk anda snapshot al
    const e1 = emailNorm(rawVal(emailEl));
    const p1 = trimmed(rawVal(passEl));

    if (!e1 || !p1) return false;

    // Stabilize bekle
    setTimeout(() => {
      // Modal kapandıysa vazgeç
      if (!existsInBody(passEl) || !existsInBody(btnEl)) return;

      const e2 = emailNorm(rawVal(emailEl));
      const p2 = trimmed(rawVal(passEl));

      // Hala doluysa ve (opsiyonel) aynıysa devam
      if (e2 && p2 && (e2 === e1) && (p2 === p1)) {
        safeSubmitNow();
      } else if (e2 && p2) {
        // değer değişmiş ama doluysa yine de deneyebiliriz
        // (Keychain bazen geç günceller)
        safeSubmitNow();
      }
    }, CFG.stabilizeMs);

    return true;
  }

  function armIfLoginDomReady() {
    const email = qs(CFG.emailId);
    const pass  = qs(CFG.passId);
    const btn   = qs(CFG.submitId);

    if (!email || !pass || !btn) return false;
    if (!isProbablyVisible(pass) && !isProbablyVisible(btn)) return false;

    if (CFG.oncePerOpen && armedForThisOpen) return true;
    armedForThisOpen = true;

    // Enter ile (stabilize + tek deneme)
    pass.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        // Enter anında value tam oturmamış olabilir -> stabilized submit
        safeSubmitStabilized();
      }
    });

    // Autofill için polling (stabilize + tek deneme)
    let elapsed = 0;
    pollTimer = setInterval(() => {
      elapsed += CFG.pollMs;

      if (!existsInBody(pass) || !existsInBody(btn)) {
        resetForNextOpen();
        return;
      }

      if (!triedForThisOpen) {
        const e = emailNorm(rawVal(email));
        const p = trimmed(rawVal(pass));
        if (e && p) {
          // doldu -> stabilize bekle
          clearInterval(pollTimer);
          pollTimer = null;
          safeSubmitStabilized();
          return;
        }
      }

      if (elapsed >= CFG.maxPollMs) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }, CFG.pollMs);

    // Modal kapanıp tekrar açılınca resetlemek için watcher
    resetWatchTimer = setInterval(() => {
      const p = qs(CFG.passId);
      const b = qs(CFG.submitId);
      // DOM’dan kalktıysa reset
      if ((!p || !b) && (armedForThisOpen || triedForThisOpen)) {
        resetForNextOpen();
      }
    }, 600);

    return true;
  }

  function boot() {
    // ilk deneme
    armIfLoginDomReady();

    // Modal/partials sonradan geliyorsa izle
    const mo = new MutationObserver(() => {
      armIfLoginDomReady();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });

    // Safari: autofill bazen sayfa geri gelince/focus sonrası tamamlanır
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
