/* =========================================================
   AIVO — VIRAL HOOK MODULE (FINAL / FAKE JOB)
   - HTML selectors birebir uyumlu
   - Fake job oluşturur
   - Status akışı gösterir
   - 3 hook çıktısı üretir
   - Toast YOK
   - Tek bind + propagation fix
   - ❌ KREDİ DÜŞÜRME YOK (GLOBAL GATE TEK OTORİTE)
   ========================================================= */

(function () {
  "use strict";

  // ✅ BIND ONCE — KESİN
  if (window.__AIVO_VIRAL_HOOK_BOUND__) return;
  window.__AIVO_VIRAL_HOOK_BOUND__ = true;

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

    // 🔥 KRİTİK — GLOBAL HANDLER’LARI KES
    e.preventDefault();
    e.stopImmediatePropagation();
    e.stopPropagation();

    const prompt = getPrompt();
    if (!prompt) return;

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
    const style = getSelectedStyle();

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
