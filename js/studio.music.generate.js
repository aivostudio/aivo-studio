// =========================================================
// 🔥 MUSIC GENERATE WIRE (FORCE PANEL + FORCE JOB EVENT)
// - RightPanel'i music'e zorlar
// - queued job'u kesinlikle panel.music.js'e düşürür
// =========================================================
(function () {
  console.log("[music-generate] loaded (force event)");

  function pickPrompt() {
    return (
      document.querySelector("#musicPrompt")?.value ||
      document.querySelector("#prompt")?.value ||
      document.querySelector("[name='prompt']")?.value ||
      document.querySelector("textarea[placeholder*='Prompt']")?.value ||
      document.querySelector("textarea[placeholder*='detay']")?.value ||
      document.querySelector(".musicPage textarea")?.value ||
      document.querySelector("textarea")?.value ||
      ""
    ).trim();
  }

  async function onClick() {
    // 1) Paneli MUSIC'e zorla (mount garantisi)
    try { window.RightPanel?.force?.("music"); } catch (_) {}

    if (!window.AIVO_APP || typeof window.AIVO_APP.generateMusic !== "function") {
      console.error("[music-generate] AIVO_APP.generateMusic missing");
      alert("generateMusic yok");
      return;
    }

    const prompt = pickPrompt();
    if (!prompt) {
      alert("Prompt boş");
      return;
    }

    // 2) Service çağır (job_id bekliyoruz)
    const res = await window.AIVO_APP.generateMusic({ prompt });
    console.log("[music-generate] service result", res);

    const job_id = res?.job_id || res?.id || res?.jobId;
    if (!job_id) {
      console.error("[music-generate] job_id yok", res);
      alert("job_id gelmedi");
      return;
    }

    // 3) queued job objesi
    const job = {
      job_id,
      type: "music",
      status: "queued",
      title: "Yeni Müzik",
      prompt
    };

    // 4) Eğer AIVO_JOBS varsa upsert et (bazı buildlerde event'i o atıyor)
    try { window.AIVO_JOBS?.upsert?.(job); } catch (e) {
      console.warn("[music-generate] AIVO_JOBS.upsert failed", e);
    }

    // 5) Ne olursa olsun event’i BİZ yayınla (panel.music.js kesin duysun)
    try {
      window.dispatchEvent(new CustomEvent("aivo:job", { detail: job }));
      console.log("[music-generate] forced aivo:job dispatched", job);
    } catch (e) {
      console.error("[music-generate] dispatch failed", e);
    }

    // 6) Panel tekrar mount olursa kart uçmasın diye tekrar force
    try { window.RightPanel?.force?.("music"); } catch (_) {}
  }

  document.addEventListener("click", function (e) {
    const btn = e.target.closest("#musicGenerateBtn");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    onClick().catch((err) => {
      console.error("[music-generate] error", err);
      alert(err?.message || "Müzik başlatılamadı");
    });
  }, true);
})();
