/* =========================================================
   AIVO — SOCIAL MEDIA PACK MODULE (FINAL / FAKE JOB)
   - SM Pack input + tema + platform okur
   - Job oluşturur
   - Status akışı gösterir
   - Fake çıktı üretir (text)
   ========================================================= */

(function () {
  "use strict";

  if (!window.AIVO_APP) {
    console.warn("[SM_PACK] AIVO_APP bulunamadı");
    return;
  }

  const COST = 5;

  /* -------------------- Helpers -------------------- */

  function getPrompt() {
    const el = document.getElementById("smPackInput");
    return el ? el.value.trim() : "";
  }

  function getSelectedTheme() {
    const active = document.querySelector(".smpack-choice.is-active");
    return active ? active.dataset.smpackTheme : "viral";
  }

  function getSelectedPlatform() {
    const active = document.querySelector(".smpack-pill.is-active");
    return active ? active.dataset.smpackPlatform : "tiktok";
  }

  function generatePack(prompt, theme, platform) {
    return [
      `🎯 ${prompt}`,
      `📌 Tema: ${theme.toUpperCase()}`,
      `📱 Platform: ${platform}`,
      `🔥 Paylaşılmaya hazır sosyal medya içeriği.`,
    ];
  }

  /* -------------------- Theme select -------------------- */
  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".smpack-choice");
    if (!btn) return;

    document
      .querySelectorAll(".smpack-choice.is-active")
      .forEach((b) => b.classList.remove("is-active"));

    btn.classList.add("is-active");
  });

  /* -------------------- Platform select -------------------- */
  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".smpack-pill");
    if (!btn) return;

    document
      .querySelectorAll(".smpack-pill.is-active")
      .forEach((b) => b.classList.remove("is-active"));

    btn.classList.add("is-active");
  });

  /* -------------------- Generate button -------------------- */
  document.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-generate-sm-pack]");
    if (!btn) return;

    const prompt = getPrompt();
    if (!prompt) {
      alert("Lütfen Marka / Ürün / Mesaj alanına 1 cümle yaz.");
      return;
    }

    const theme = getSelectedTheme();
    const platform = getSelectedPlatform();

    // 1) Job oluştur
    const job = window.AIVO_APP.createJob({
      type: "SM_PACK",
      title: "AI Sosyal Medya Paketi",
      cost: COST,
    });

    // 2) Status akışı
    window.AIVO_APP.updateJobStatus(job.id, "Hazırlanıyor…");

    setTimeout(() => {
      window.AIVO_APP.updateJobStatus(job.id, "Formatlar oluşturuluyor…");
    }, 700);

    setTimeout(() => {
      const items = generatePack(prompt, theme, platform);

      window.AIVO_APP.completeJob(job.id, {
        title: "Sosyal Medya Paketi Çıktıları",
        items: items.map((text) => ({
          type: "text",
          value: text,
        })),
      });
    }, 1500);
  });

  console.log("[SM_PACK] module loaded OK");
})();
