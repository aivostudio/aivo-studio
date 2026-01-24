/* studio.backend-credits.off.js
   AMAÇ: Studio içinde backend kredi tüketimi KAPALI.
   - /api/credits/consume çağrılarını bypass eder (200 ok döner)
   - 400 redirect/fiyatlandırma atmalarını fiilen öldürür
*/
(() => {
  window.__AIVO_BACKEND_CREDITS_DISABLED__ = true;

  const isConsumeUrl = (input) => {
    try {
      const url = typeof input === "string" ? input : (input && input.url) || "";
      return url.includes("/api/credits/consume");
    } catch (_) {
      return false;
    }
  };

  const okJson = (obj) =>
    new Response(JSON.stringify(obj || { ok: true, bypass: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  const _fetch = window.fetch;
  if (typeof _fetch !== "function") return;

  window.fetch = async function (input, init) {
    // ✅ Backend credit consume tamamen bypass
    if (isConsumeUrl(input)) {
      return okJson({ ok: true, bypass: true, consumed: 0, reason: "studio_backend_credits_off" });
    }

    // Normal akış
    return _fetch(input, init);
  };
})();
