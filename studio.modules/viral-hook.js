/* =========================================================
   AIVO — VIRAL HOOK MODULE (FINAL / FAKE JOB)
   - HTML selectors birebir uyumlu
   - Job oluşturur
   - Status akışı gösterir
   - 3 hook çıktısı üretir
   ========================================================= */

(function () {
  "use strict";

  if (!window.AIVO_APP) {
    console.warn("[VIRAL_HOOK] AIVO_APP bulunamadı");
    return;
  }

  const COST = 3;

  // ---- Helpers ----
  function getPrompt() {
    const el = document.getElementById("viralHookInput");
    return el ? el.value.trim() : "";
  }

  function getSelectedStyle() {
    const active = document.querySelector(".style-card.is-active");
    return active ? active.dataset.style : "Viral";
  }

  function generateHooks(prompt, style) {
    return [
      `Kimse bunun bu kadar hızlı olacağını beklemiyordu: ${prompt}`,
      `${style} bir gerçek: ${prompt}`,
      `Dur ve bak — ${prompt}`,
    ];
  }

  // ---- Style selection (UI state) ----
  document.addEventListener("click", function (e) {
    const card = e.target.closest(".style-card");
    if (!card) return;

    document
      .querySelectorAll(".style-card.is-active")
      .forEach((c) => c.classList.remove("is-active"));

    card.classList.add("is-active");
  });

  // ---- Generate button ----
  document.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-generate-viral-hook]");
    if (!btn) return;

    const prompt = getPrompt();
    if (!prompt) {
      alert("Lütfen kısa bir konu / mesaj gir.");
      return;
    }

    const style = getSelectedStyle();

    // 1) Job oluştur
    const job = window.AIVO_APP.createJob({
      type: "VIRAL_HOOK",
      title: "Viral Hook Üretimi",
      cost: COST,
    });

    // 2) Status akışı
    window.AIVO_APP.updateJobStatus(job.id, "Hazırlanıyor…");

    setTimeout(() => {
      window.AIVO_APP.updateJobStatus(job.id, "Hook’lar üretiliyor…");
    }, 700);

    setTimeout(() => {
      const hooks = generateHooks(prompt, style);

      window.AIVO_APP.completeJob(job.id, {
        title: "Viral Hook Çıktıları",
        items: hooks.map((text) => ({
          type: "text",
          value: text,
        })),
      });
    }, 1500);
  });
})();
<!-- 🔌 ÜRÜN MODÜLLERİ -->
<script src="/studio.modules/viral-hook.js?v=1"></script>
<script src="/studio.modules/socialpack.js?v=1"></script>

<!-- LEGACY (en son, dokunmuyoruz) -->
<script src="/studio.js?v=999"></script>
