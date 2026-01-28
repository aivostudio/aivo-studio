/* =========================================================
   AIVO — VIRAL HOOK MODULE (FINAL / FAKE JOB)
   - HTML selectors birebir uyumlu
   - Fake job oluşturur
   - Status akışı gösterir
   - 3 hook çıktısı üretir
   ========================================================= */

(function () {
  "use strict";

  const COST = 4; // ✅ DOĞRU KREDİ

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

  // ---- Style selection ----
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
      window.toast?.error?.("Lütfen kısa bir konu / mesaj gir.");
      return;
    }

    // ---- CREDIT (TEK OTORİTE) ----
    if (!window.AIVO_STORE_V1 || typeof AIVO_STORE_V1.consumeCredits !== "function") {
      window.toast?.error?.("Kredi sistemi hazır değil.");
      return;
    }

    const ok = AIVO_STORE_V1.consumeCredits(COST);
    if (!ok) {
      window.toast?.error?.("Yetersiz kredi.");
      window.redirectToPricing?.();
      return;
    }

    // ✅ UI SADECE STORE’DAN SYNC
    AIVO_STORE_V1.syncCreditsUI?.();

    // ✅ TEK SUCCESS TOAST
    window.toast?.success?.(`Üretim başladı. ${COST} kredi düşüldü.`);

    const style = getSelectedStyle();

    // ---- FAKE JOB UI ----
    const rightList = document.querySelector(".right-list");
    if (!rightList) return;

    const jobEl = document.createElement("div");
    jobEl.className = "right-job";

    jobEl.innerHTML = `
      <div class="right-job__top">
        <div>
          <div class="right-job__title">Viral Hook</div>
          <div class="card-subtitle">3 varyasyon</div>
        </div>
        <div class="right-job__status" data-status>Hazırlanıyor…</div>
      </div>
      <div class="right-job__body"></div>
    `;

    rightList.prepend(jobEl);

    const statusEl = jobEl.querySelector("[data-status]");
    const bodyEl = jobEl.querySelector(".right-job__body");

    setTimeout(() => {
      statusEl.textContent = "Hook’lar üretiliyor…";
    }, 700);

    setTimeout(() => {
      const hooks = generateHooks(prompt, style);

      bodyEl.innerHTML = hooks
        .map(
          (h, i) => `
          <div class="right-job__line">
            <div class="right-job__badge">${i + 1}</div>
            <div class="right-job__text">${h}</div>
            <div class="right-job__state is-done">Hazır</div>
          </div>`
        )
        .join("");

      statusEl.textContent = "Tamamlandı";
    }, 1500);
  });
})();
