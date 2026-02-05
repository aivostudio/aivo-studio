/* =========================================================
   studio.music.generate.js  (ONE-BLOCK DROP-IN)
   - Finds #musicGenerateBtn
   - POST /api/jobs/create (music)
   - On success: injects a loading card via window.AIVO_PLAYER.add(cardHTML)
   ========================================================= */

(function MUSIC_GENERATE_WIRE() {
  console.log("[music-generate] REAL-mode script loaded");

  const BTN_ID = "musicGenerateBtn";
  const CREDIT_ATTR = "data-credit-cost";

  function qs(sel, root = document) { return root.querySelector(sel); }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function safeJSON(r) {
    return r.json().catch(() => null);
  }

  function buildCardHTML(jobId) {
    return `
      <div class="aivo-player-card is-loadingState"
           data-job-id="${jobId}"
           data-output-id=""
           data-src="">
        <div class="aivo-left">
          <button class="aivo-play" data-action="toggle-play" aria-label="Oynat" title="Oynat"></button>
          <div class="aivo-meta">
            <div class="aivo-title">Yeni Müzik (hazırlanıyor)</div>
            <div class="aivo-sub">${jobId}</div>
          </div>
        </div>

        <div class="aivo-progress"><i style="width:0%"></i></div>
        <div class="aivo-time" data-bind="time">0:00</div>

        <div class="aivo-actions">
          <button class="aivo-action" data-action="download" title="İndir">⬇</button>
          <button class="aivo-action" data-action="delete" title="Sil">🗑</button>
        </div>
      </div>
    `;
  }

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
    // Minimum payload. İstersen burayı sonra genişletirsin.
    const creditCost = Number(btn.getAttribute(CREDIT_ATTR) || 5);

    return {
      type: "music",
      credit_cost: creditCost,
      mode: "basic",
      // backend prompt alanlarını boş bırakmak genelde sorun çıkarmaz:
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

      // store'a da yaz (paneller dinliyorsa)
      if (window.AIVO_JOBS && typeof window.AIVO_JOBS.upsert === "function") {
        window.AIVO_JOBS.upsert({ job_id: jobId, status: resp.status || "queued", type: "music" });
      }

      // player kartını bas
      if (window.AIVO_PLAYER && typeof window.AIVO_PLAYER.add === "function") {
        window.AIVO_PLAYER.add(buildCardHTML(jobId));
        console.log("[music-generate] card added", jobId);
      } else {
        console.warn("[music-generate] AIVO_PLAYER.add yok (player.js API hazır değil)");
        alert("Player API hazır değil (AIVO_PLAYER.add yok).");
      }

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
