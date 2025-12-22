// credits-ui.js (SAFE) — studio.js'ten bağımsız çalışır
document.addEventListener("DOMContentLoaded", function () {
  try {
    var el = document.getElementById("creditCount");
    if (!el) return;

    // legacy okuyalım
    var legacy = Number(localStorage.getItem("aivo_credits") || 0);

    // store varsa oku
    var credits = legacy;
    if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.getCredits === "function") {
      credits = Number(window.AIVO_STORE_V1.getCredits() || 0);

      // Eğer store 0 ama legacy doluysa (migrate kaçtıysa), store'u legacy ile doldur
      if (credits === 0 && legacy > 0 && typeof window.AIVO_STORE_V1.setCredits === "function") {
        window.AIVO_STORE_V1.setCredits(legacy);
        credits = legacy;
      }
    }

    el.textContent = String(Number(credits) || 0);
  } catch (e) {
    // sessiz
  }
});
