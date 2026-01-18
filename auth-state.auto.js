/* auth-state.auto.js — SAFE (only auto-login helper)
   - NO /api/auth/me calls
   - NO localStorage auth state
   - NO UI class toggles
   - NO loader removal
   Goal: When login modal is open and password is autofilled (or Enter pressed),
         trigger the existing login submit path WITHOUT becoming a second auth brain.
*/
(() => {
  "use strict";

  const CFG = {
    emailId: "loginEmail",
    passId: "loginPass",
    submitId: "btnAuthSubmit",
    // Autofill bazen event üretmez; kısa bir süre polling yaparız.
    pollMs: 120,
    maxPollMs: 8000,
    // Bir kez dener, spam yapmaz.
    oncePerOpen: true,
  };

  let armedForThisOpen = false;
  let triedForThisOpen = false;
  let pollTimer = null;
  let mo = null;

  const qs = (id) => document.getElementById(id);

  const val = (el) => (el && typeof el.value === "string" ? el.value.trim() : "");
  const has = (el) => val(el).length > 0;

  function isProbablyVisible(el) {
    if (!el) return false;
    // basit görünürlük kontrolü
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function resetForNextOpen() {
    armedForThisOpen = false;
    triedForThisOpen = false;
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  function safeSubmit() {
    if (triedForThisOpen) return false;
    triedForThisOpen = true;

    // 1) Eğer auth.core bir global API expose ettiyse (ileride Initiator ile netleştirip buraya bağlayacağız)
    // Bu isimleri mevcut koduna göre genişletebilirsin; yoksa hiçbir şey olmaz (safe).
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

    // 2) Fallback: buton event zinciri (çalışmazsa sorun değil)
    const btn = qs(CFG.submitId);
    if (!btn) return false;

    try {
      // pointerdown/mousedown bazı delegation sistemlerinde gerekli olabiliyor
      btn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      btn.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      return true;
    } catch (_) {
      try { btn.click(); } catch (_) {}
      return true;
    }
  }

  function armIfLoginDomReady() {
    const email = qs(CFG.emailId);
    const pass  = qs(CFG.passId);
    const btn   = qs(CFG.submitId);

    // Modal henüz yoksa
    if (!email || !pass || !btn) return false;

    // Modal kapalı/ görünmezse spam kurma
    if (!isProbablyVisible(pass) && !isProbablyVisible(btn)) return false;

    if (CFG.oncePerOpen && armedForThisOpen) return true;
    armedForThisOpen = true;

    // Enter ile
    pass.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        if (has(email) && has(pass)) safeSubmit();
      }
    });

    // Autofill için kısa polling
    let elapsed = 0;
    pollTimer = setInterval(() => {
      elapsed += CFG.pollMs;

      // Modal kapanmışsa dur
      if (!document.body.contains(pass) || !document.body.contains(btn)) {
        resetForNextOpen();
        return;
      }

      if (!triedForThisOpen && has(email) && has(pass)) {
        clearInterval(pollTimer);
        pollTimer = null;
        safeSubmit();
        return;
      }

      if (elapsed >= CFG.maxPollMs) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }, CFG.pollMs);

    return true;
  }

  function boot() {
    // İlk deneme
    armIfLoginDomReady();

    // Modal/partials sonradan geliyorsa izle
    mo = new MutationObserver(() => {
      armIfLoginDomReady();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });

    // Sayfa görünürlük değişince (Safari autofill bazen focus sonrası olur)
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) armIfLoginDomReady();
    });

    // Eğer modal kapanıp tekrar açılıyorsa reset için: DOM’dan kalkınca reset.
    // (Bu “reset” minimal; bir sonraki açılışta yeniden kurar.)
    setInterval(() => {
      const pass = qs(CFG.passId);
      const btn  = qs(CFG.submitId);
      if ((!pass || !btn) && (armedForThisOpen || triedForThisOpen)) resetForNextOpen();
    }, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
