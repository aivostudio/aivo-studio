// =========================================================
// studio.music.generate.js — REAL "OUR PLAYER" PATH
// ✅ UI card => window.AIVO_PLAYER.add()
// ✅ Job create => /api/jobs/create
// ✅ Music generate => /api/music/generate
// ✅ Ready bind => /api/jobs/status (varsa)
// =========================================================
(function () {
  console.log("[music-generate] loaded (AIVO_PLAYER.add path)");

  const BTN_SEL = "#musicGenerateBtn";
  const PANEL_FORCE_KEY = "music";

  const POLL_INTERVAL = 2500;
  const TIMEOUT = 1000 * 60 * 6; // 6 dk

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function pickPrompt() {
    // sayfadaki en mantıklı prompt alanlarını dene
    const cands = [
      "#musicPrompt",
      "#prompt",
      "textarea[name='prompt']",
      "textarea[name='description']",
      "textarea[placeholder*='Prompt']",
      "textarea[placeholder*='detay']",
      ".musicPage textarea",
      "textarea"
    ];
    for (const sel of cands) {
      const el = document.querySelector(sel);
      if (el && String(el.value || "").trim()) return String(el.value || "").trim();
    }
    return "";
  }

  function forceMusicPanel() {
    try { window.RightPanel?.force?.(PANEL_FORCE_KEY); } catch (_) {}
  }

  function buildQueuedCardHTML({ job_id, title, sub }) {
    // player.js’in dinlediği yapı:
    // - .aivo-player-card
    // - play butonu: [data-action="toggle-play"]
    // - progress: .aivo-progress i
    // - time: [data-bind="time"]
    return `
      <div class="aivo-player-card is-loadingState"
        data-src=""
        data-job-id="${esc(job_id)}"
        data-output-id="">

        <div class="aivo-player-left">
          <button class="aivo-player-btn"
            data-action="toggle-play"
            aria-label="Oynat"
            title="Oynat"></button>

          <div class="aivo-player-spinner" title="İşleniyor"></div>
        </div>

        <div class="aivo-player-mid">
          <div class="aivo-player-titleRow">
            <div class="aivo-player-title">${esc(title || "Yeni Müzik")}</div>
            <div class="aivo-player-tags">
              <span class="aivo-tag is-queued">Hazırlanıyor</span>
            </div>
          </div>

          <div class="aivo-player-sub">${esc(sub || "")}</div>

          <div class="aivo-player-meta">
            <span data-bind="time">0:00</span>
          </div>

          <div class="aivo-player-controls">
            <div class="aivo-progress" title="İlerleme"><i style="width:0%"></i></div>
          </div>
        </div>

        <div class="aivo-player-actions">
          <button class="aivo-action is-blue" data-action="download" title="İndir" aria-label="İndir">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 3v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M8 10l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M5 20h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
          <button class="aivo-action is-danger" data-action="delete" title="Sil" aria-label="Sil">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M3 6h18" stroke="currentColor" stroke-width="2"/>
              <path d="M8 6V4h8v2" stroke="currentColor" stroke-width="2"/>
              <path d="M7 6l1 14h8l1-14" stroke="currentColor" stroke-width="2"/>
              <path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  function addQueuedCard({ job_id, title, sub }) {
    if (!window.AIVO_PLAYER?.add) {
      console.error("[music-generate] AIVO_PLAYER.add missing");
      return false;
    }

    forceMusicPanel();

    // Panel container yoksa bile add() root’a basmaya çalışır
    const ok = window.AIVO_PLAYER.add(`
      <div class="aivo-player-list">
        ${buildQueuedCardHTML({ job_id, title, sub })}
      </div>
    `);

    // Eğer zaten list varsa, ikinci kez list basmasın diye fallback:
    // add() başarısızsa direkt root’a tek kart basalım
    if (!ok) {
      window.AIVO_PLAYER.add(buildQueuedCardHTML({ job_id, title, sub }));
    }

    return true;
  }

  function findCard(job_id) {
    return document.querySelector(`.aivo-player-card[data-job-id="${CSS.escape(job_id)}"]`);
  }

  function markReady(job_id, src, output_id) {
    const card = findCard(job_id);
    if (!card) return;

    if (src) card.setAttribute("data-src", src);
    if (output_id) card.setAttribute("data-output-id", output_id);

    card.classList.remove("is-loadingState");
    card.classList.add("is-ready");

    const tag = card.querySelector(".aivo-tag");
    if (tag) {
      tag.classList.remove("is-queued");
      tag.classList.add("is-ready");
      tag.textContent = "Hazır";
    }

    const sp = card.querySelector(".aivo-player-spinner");
    if (sp) sp.style.display = "none";
  }

  function pickSrcFromStatus(j) {
    if (!j) return "";

    // en olası alanlar
    const direct =
      j.play_url || j.playUrl ||
      j.audio_url || j.audioUrl ||
      j.url || j.file_url || j.fileUrl;

    if (direct) return direct;

    // outputs array
    const outs = Array.isArray(j.outputs) ? j.outputs : [];
    for (const o of outs) {
      const s = o.play_url || o.playUrl || o.url || o.audio_url || o.audioUrl || o.file_url || o.fileUrl;
      if (s) return s;
    }

    return "";
  }

  function pickOutputIdFromStatus(j) {
    if (!j) return "";
    return j.output_id || j.outputId || (Array.isArray(j.outputs) && j.outputs[0] && (j.outputs[0].output_id || j.outputs[0].outputId)) || "";
  }

  async function waitForReady(job_id) {
    const deadline = Date.now() + TIMEOUT;

    while (Date.now() < deadline) {
      const r = await fetch(`/api/jobs/status?job_id=${encodeURIComponent(job_id)}`, { cache: "no-store" })
        .catch(() => null);

      if (!r || !r.ok) { await sleep(POLL_INTERVAL); continue; }

      const j = await r.json().catch(() => null);
      if (!j) { await sleep(POLL_INTERVAL); continue; }

      const st = String(j.status || "").toLowerCase();
      const src = pickSrcFromStatus(j);
      const outId = pickOutputIdFromStatus(j);

      if (src && (st === "ready" || st === "done" || st === "completed" || st === "success" || st === "finished" || st === "")) {
        return { src, outId, raw: j };
      }

      await sleep(POLL_INTERVAL);
    }

    return null;
  }

  async function createJob() {
    const jr = await fetch("/api/jobs/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "music" })
    });

    const j = await jr.json().catch(() => ({}));
    if (!jr.ok || !j.job_id) throw new Error("job_create_failed");
    return j.job_id;
  }

  async function fireGenerate(job_id, prompt) {
    // generate endpoint job_id ile tetikleniyor (response beklemiyoruz)
    fetch("/api/music/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id, prompt })
    }).catch(() => {});
  }

  async function handleClick() {
    const prompt = pickPrompt();
    if (!prompt) {
      alert("Prompt boş");
      return;
    }

    forceMusicPanel();

    const job_id = await createJob();
    console.log("[music-generate] job created", job_id);

    // mini store (debug / panel dinleyicileri için)
    try {
      window.AIVO_JOBS?.upsert?.({ job_id, type: "music", status: "queued", prompt, title: "Yeni Müzik" });
    } catch (_) {}

    // ✅ Bizim player’a KARTI BAS (tek doğru yol)
    addQueuedCard({ job_id, title: "Yeni Müzik", sub: prompt.slice(0, 60) });

    // generate tetikle
    fireGenerate(job_id, prompt);

    // status varsa ready bind et
    const ready = await waitForReady(job_id);
    if (ready?.src) {
      console.log("[music-generate] ready", ready);
      markReady(job_id, ready.src, ready.outId);
    } else {
      console.warn("[music-generate] status polling timeout/failed (card stays queued)", job_id);
    }
  }

  // delegated click (router remount olsa da çalışır)
  document.addEventListener("click", function (e) {
    const btn = e.target.closest(BTN_SEL);
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    handleClick().catch((err) => {
      console.error("[music-generate] error", err);
      alert(err?.message || "Müzik başlatılamadı");
    });
  }, true);
})();
