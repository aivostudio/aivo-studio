// =========================================================
// 🔥 MUSIC GENERATE WIRE (ROBUST PROMPT PICKER)
// =========================================================

(function () {
  console.log("[music-generate] loaded");

  function pickPrompt() {
    return (
      // açıkça bilinen ihtimaller
      document.querySelector("#musicPrompt")?.value ||
      document.querySelector("#prompt")?.value ||
      document.querySelector("[name='prompt']")?.value ||
      document.querySelector("[name='musicPrompt']")?.value ||

      // Ek Açıklama / Prompt alanı (en olası)
      document.querySelector("textarea[placeholder*='detay']")?.value ||
      document.querySelector("textarea[placeholder*='Prompt']")?.value ||

      // fallback: music page içindeki ilk textarea
      document.querySelector(".musicPage textarea")?.value ||

      ""
    ).trim();
  }

  document.addEventListener("click", async function (e) {
    const btn = e.target.closest("#musicGenerateBtn");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const prompt = pickPrompt();
    console.log("[music-generate] picked prompt:", prompt);

    if (!prompt) {
      alert("Prompt boş");
      return;
    }

    try {
      const res = await window.AIVO_APP.generateMusic({ prompt });
      console.log("[music-generate] service result", res);
    } catch (err) {
      console.error("[music-generate] error", err);
      alert(err.message || "Müzik başlatılamadı");
    }
  });
})();
