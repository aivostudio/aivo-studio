/* =========================================================
   AIVO — VIRAL HOOK MODULE (FAKE JOB v1)
   - UI'den veri alır
   - Fake job oluşturur
   - Sağ panelde 3 hook gösterir
   ========================================================= */

(function () {
  "use strict";

  if (!window.AIVO_APP) {
    console.warn("AIVO_APP bulunamadı");
    return;
  }

  const COST = 3;

  function getSelectedStyle() {
    const active = document.querySelector(".style-card.is-active");
    return active ? active.dataset.style : "Viral";
  }

  function getPrompt() {
    const input = document.querySelector("#viralHookInput");
    return input ? input.value.trim() : "";
  }

  function fakeHooks(prompt, style) {
    return [
      `Kimse bunu beklemiyordu: ${prompt}`,
      `Bunu yapmadan önce bir kez daha düşün… ${prompt}`,
      `${style} modunda gelen gerçek: ${prompt}`,
    ];
  }

  document.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-generate-viral-hook]");
    if (!btn) return;

    const prompt = getPrompt();
    if (!prompt) {
      alert("Lütfen kısa bir konu / mesaj gir.");
      return;
    }

    const style = getSelectedStyle();

    // 1️⃣ Job oluştur
    const job = window.AIVO_APP.createJob({
      type: "VIRAL_HOOK",
      title: "Viral Hook Üretimi",
      cost: COST,
    });

    // 2️⃣ Status akışı
    window.AIVO_APP.updateJobStatus(job.id, "Üretiliyor…");

    setTimeout(() => {
      window.AIVO_APP.updateJobStatus(job.id, "Varyasyonlar hazırlanıyor…");
    }, 800);

    setTimeout(() => {
      const hooks = fakeHooks(prompt, style);

      window.AIVO_APP.completeJob(job.id, {
        hooks: hooks,
      });
    }, 1600);
  });
})();
