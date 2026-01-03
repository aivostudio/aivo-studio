/* ---------------------------------------------------------
   BIND UI (MUSIC GENERATE BUTTON)
   - #musicGenerateBtn tıklanınca AIVO_APP.generateMusic çağrılır
   - Tek kez bağlanır
--------------------------------------------------------- */

(function bindGenerateOnce() {
  if (window.__aivoGenerateBound) return;
  window.__aivoGenerateBound = true;

  function toastSafe(msg, type) {
    if (typeof window.showToast === "function") window.showToast(msg, type || "ok");
    else console.log("[toast]", type || "ok", msg);
  }

  function getEmailSafe() {
    try {
      if (window.AIVO_STORE_V1) {
        if (typeof window.AIVO_STORE_V1.getUser === "function") {
          const u = window.AIVO_STORE_V1.getUser();
          if (u && u.email) return String(u.email).trim().toLowerCase();
        }
        if (typeof window.AIVO_STORE_V1.get === "function") {
          const s = window.AIVO_STORE_V1.get();
          if (s && s.email) return String(s.email).trim().toLowerCase();
        }
      }
    } catch (_) {}

    try {
      const raw = localStorage.getItem("aivo_user") || localStorage.getItem("user") || "";
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && obj.email) return String(obj.email).trim().toLowerCase();
      }
    } catch (_) {}

    return "";
  }

  function val(sel) {
    const el = document.querySelector(sel);
    return el ? String(el.value || "").trim() : "";
  }

  document.addEventListener("click", async function (e) {
    const btn = e.target && e.target.closest && e.target.closest("#musicGenerateBtn, [data-generate='music']");
    if (!btn) return;

    // studio.js legacy handler'larını kesin bypass
    e.preventDefault();
    e.stopImmediatePropagation();

    if (!window.AIVO_APP || typeof window.AIVO_APP.generateMusic !== "function") {
      toastSafe("AIVO_APP hazır değil (studio.app.js).", "error");
      return;
    }

    const email = getEmailSafe();
    if (!email) {
      toastSafe("Email bulunamadı. Giriş/Store kontrol.", "error");
      return;
    }

    const prompt =
      val("#musicPrompt") ||
      val("textarea[name='prompt']") ||
      val("#prompt") ||
      "";

    const mode = val("#musicMode") || "instrumental";
    const quality = val("#musicQuality") || "standard";
    const durationSec = Math.max(5, Number(val("#musicDuration") || "30") || 30);

    await window.AIVO_APP.generateMusic({
      buttonEl: btn,
      email,
      prompt,
      mode,
      durationSec,
      quality
    });
  }, true); // capture=true
})();
