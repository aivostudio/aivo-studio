// =========================================================
// 🔥 MUSIC GENERATE WIRE (UI → SERVICE ONLY)
// =========================================================

(function () {
  document.addEventListener("click", async function (e) {
    const btn = e.target.closest("#musicGenerateBtn");
    if (!btn) return;

    e.preventDefault();

    const prompt =
      document.querySelector("#musicPrompt")?.value ||
      document.querySelector("textarea")?.value ||
      "";

    try {
      await window.AIVO_APP.generateMusic({ prompt });
    } catch (err) {
      console.error("[music-generate]", err);
      window.toast?.error?.(err.message || "Müzik başlatılamadı");
    }
  });
})();
