/* =========================================================
   studio.music.generate.js  (NO-PLAYER-INJECT VERSION)
   - Only creates job
   - Writes to AIVO_JOBS.upsert (paneller buradan dinler)
   - DOES NOT add any player/card HTML
   ========================================================= */

(function MUSIC_GENERATE_WIRE() {
  console.log("[music-generate] REAL-mode script loaded");

  const BTN_ID = "musicGenerateBtn";
  const CREDIT_ATTR = "data-credit-cost";

  function qs(sel, root = document) { return root.querySelector(sel); }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function safeJSON(r) { return r.json().catch(() => null); }

  async function createMusicJob(payload) {
    const r = await fetch("/api/jobs/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    }).catch(() => null);

    if (!r || !r.ok) return { ok: false, error: "request_failed" };
    const data = await safeJSON(r);
    if (!data) return { ok: false, error: "bad_json" };
    return data;
  }

  function collectPayload(btn) {
    const creditCost = Number(btn.getAttribute(CREDIT_ATTR) || 5);
    return {
      type: "music",
      credit_cost: creditCost,
      mode: "basic",
      prompt: "",
      lyrics: "",
      meta: { source: "studio.music.generate.js" },
    };
  }

  async function onClick(e) {
    e.preventDefault();
    e.stopPropagation();

    const btn = e.currentTarget;
    btn.disabled = true;

    console.log("[music-generate] clicked");

    try {
      const payload = collectPayload(btn);
      const resp = await createMusicJob(payload);

      console.log("[music-generate] response", resp);

      if (!resp || resp.ok !== true || !resp.job_id) {
        alert("Job oluşturulamadı. (create response geçersiz)");
        return;
      }

      const jobId = resp.job_id;

      // SADECE store'a yazıyoruz. UI/panel buradan render etsin.
      if (window.AIVO_JOBS && typeof window.AIVO_JOBS.upsert === "function") {
        window.AIVO_JOBS.upsert({
          job_id: jobId,
          status: resp.status || "queued",
          type: "music",
        });
      }

      console.log("[music-generate] job created (no card injected)", jobId);

    } catch (err) {
      console.error("[music-generate] error", err);
      alert("Beklenmeyen hata: console'a bak");
    } finally {
      btn.disabled = false;
    }
  }

  async function wire() {
    for (let i = 0; i < 40; i++) {
      const btn = qs(`#${BTN_ID}`);
      if (btn) {
        if (!btn.__aivoWired) {
          btn.__aivoWired = true;
          btn.addEventListener("click", onClick);
          console.log("[music-generate] wired ->", btn);
        }
        return;
      }
      if (i === 0) console.warn("[music-generate] button not found, retrying...");
      await sleep(250);
    }
    console.error("[music-generate] button not found окончательно:", BTN_ID);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
