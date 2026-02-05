// studio.music.generate.js — UI -> SERVICE -> JOBS (single authority)
(function bindMusicGenerate_UI_to_Service(){
  if (window.__AIVO_MUSIC_UI2SERVICE__) return;
  window.__AIVO_MUSIC_UI2SERVICE__ = true;

  function getPrompt(){
    return String(
      document.querySelector("#musicPrompt")?.value ||
      document.querySelector("textarea[name='prompt']")?.value ||
      document.querySelector("#prompt")?.value ||
      ""
    ).trim();
  }

  function safeUpsertJob(job){
    try {
      // En ideal: setAll/list getter patch’in varsa upsert zaten doğru çalışır
      if (window.AIVO_JOBS && typeof window.AIVO_JOBS.upsert === "function") {
        window.AIVO_JOBS.upsert(job);
        return true;
      }
      // fallback (hiç yoksa) — en azından global queue
      window.__AIVO_PENDING_JOBS__ = window.__AIVO_PENDING_JOBS__ || [];
      window.__AIVO_PENDING_JOBS__.push(job);
      return false;
    } catch (e) {
      console.warn("[MUSIC_UI2SERVICE] upsert failed:", e);
      return false;
    }
  }

  document.addEventListener("click", async (e) => {
    const btn = e.target?.closest?.("#musicGenerateBtn, [data-generate='music']");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const prompt = getPrompt();
    if (!prompt) {
      window.toast?.error?.("Prompt boş");
      return;
    }

    btn.disabled = true;

    try {
      // ✅ SERVICE ONLY
      const out = await window.AIVO_APP.generateMusic({ prompt, cost: 5 });
      if (!out?.ok || !out.job_id) throw new Error("service_failed");

      // ✅ SINGLE STORE WRITE (UI bundan sonra sadece buraya bakmalı)
      safeUpsertJob({
        job_id: out.job_id,
        id: out.job_id,
        type: "music",
        status: "queued",
        title: "Müzik Üretimi",
        ts: Date.now(),
        meta: { prompt }
      });

      // (opsiyonel) istersen sadece “başladı” toast
      window.toast?.success?.("Üretim başladı");
    } catch (err) {
      console.error("[MUSIC_UI2SERVICE]", err);
      window.toast?.error?.("Müzik başlatılamadı");
    } finally {
      btn.disabled = false;
    }
  }, true);
})();
