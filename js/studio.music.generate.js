// =========================================================
// 🔥 MUSIC GENERATE WIRE (HARD WIRED + DEBUG)
// - Buton kesin yakalanır
// - Click kesin loglanır
// - Service kesin çağrılır
// =========================================================

(function () {
  console.log("[music-generate] loaded");

  function findPrompt() {
    return (
      document.querySelector("#musicPrompt")?.value ||
      document.querySelector("textarea")?.value ||
      ""
    );
  }

  document.addEventListener("click", async function (e) {
    const btn = e.target.closest("#musicGenerateBtn");

    if (!btn) return;

    console.log("[music-generate] BUTTON CLICKED", btn);

    e.preventDefault();
    e.stopPropagation();

    if (!window.AIVO_APP || typeof window.AIVO_APP.generateMusic !== "function") {
      console.error("[music-generate] AIVO_APP.generateMusic MISSING");
      alert("generateMusic bulunamadı");
      return;
    }

    const prompt = findPrompt();
    console.log("[music-generate] prompt =", prompt);

    try {
      const res = await window.AIVO_APP.generateMusic({ prompt });
      console.log("[music-generate] service result", res);
    } catch (err) {
      console.error("[music-generate] ERROR", err);
      alert(err.message || "Müzik başlatılamadı");
    }
  });
})();
