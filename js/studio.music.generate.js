/* =========================================================
   js/studio.music.generate.js
   - ONLY creates music job
   - ONLY upserts to AIVO_JOBS
   - DOES NOT render / inject / touch any player UI
   ========================================================= */

(function MUSIC_GENERATE() {
  console.log("[music-generate] REAL-mode script loaded");

  const BTN_ID = "musicGenerateBtn";
  const CREDIT_ATTR = "data-credit-cost";

  function qs(sel, root = document) {
    return root.querySelector(sel);
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  async function createJob(payload) {
    const r = await fetch("/api/jobs/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    }).catch(() => null);

    if (!r || !r.ok) return null;
    return r.json().catch(() => null);
  }

  function buildPayload(btn) {
    return {
      type: "music",
      mode: "basic",
      credit_cost: Number(btn.getAttribute(CREDIT_ATTR) || 5),
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
      const payload = buildPayload(btn);
      const res = await createJob(payload);

      console.log("[music-generate] response", res);

      if (!res || res.ok !== true || !res.job_id) {
        alert("Job oluşturulamadı");
        return;
      }

      // 🔴 TEK ŞEY: store'a yaz
      if (window.AIVO_JOBS && typeof window.AIVO_JOBS.upsert === "function") {
        window.AIVO_JOBS.upsert({
          job_id: res.job_id,
          status: res.status || "queued",
          type: "music",
        });
      }

      console.log("[music-generate] job upserted", res.job_id);

    } catch (err) {
      console.error("[music-generate] error", err);
      alert("Beklenmeyen hata (console)");
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
    console.error("[music-generate] button not found:", BTN_ID);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
