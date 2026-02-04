// studio.music.generate.js
window.__MUSIC_GENERATE__ = true;
console.log("[music-generate] FINAL script loaded");

(function () {
  if (window.__MUSIC_GENERATE_WIRED__) return;
  window.__MUSIC_GENERATE_WIRED__ = true;

  function findBtn() {
    return (
      document.getElementById("musicGenerateBtn") ||
      document.querySelector('button[data-generate="music"]')
    );
  }

  function getRightHost() {
    return document.getElementById("rightPanelHost");
  }

  function getTemplateCard() {
    // Sayfada HALİHAZIRDA çalışan gerçek player
    return document.querySelector(".aivo-player-card");
  }

  function ensurePlayerList(host) {
    let list = host.querySelector(".aivo-player-list");
    if (!list) {
      list = document.createElement("div");
      list.className = "aivo-player-list";
      list.style.display = "flex";
      list.style.flexDirection = "column";
      list.style.gap = "10px";
      list.style.padding = "10px";
      host.prepend(list);
    }
    return list;
  }

  function clonePlayer(label, jobId, suffix) {
    const tpl = getTemplateCard();
    if (!tpl) {
      console.error("[music-generate] TEMPLATE PLAYER BULUNAMADI");
      return null;
    }

    const c = tpl.cloneNode(true);

    const jid = jobId
      ? `${jobId}:${suffix}`
      : `pending:${suffix}:${Date.now()}`;

    c.setAttribute("data-job-id", jid);
    c.setAttribute("data-output-id", jid);
    c.setAttribute("data-title", label);
    c.classList.add("is-processing");

    // Play butonunu kapat (işleniyor)
    const playBtn = c.querySelector('[data-action="toggle-play"]');
    if (playBtn) {
      playBtn.disabled = true;
      playBtn.style.opacity = "0.5";
      playBtn.title = "İşleniyor";
    }

    // Download / delete / extra aksiyonları kapat
    c.querySelectorAll("button, a").forEach((el) => {
      const act = el.getAttribute("data-action");
      if (act && act !== "toggle-play") {
        el.style.display = "none";
      }
    });

    return c;
  }

  function addPair(jobId = null) {
    const host = getRightHost();
    if (!host) {
      console.error("[music-generate] rightPanelHost yok");
      return null;
    }

    const list = ensurePlayerList(host);

    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.gap = "10px";

    const v1 = clonePlayer("Original (v1)", jobId, "v1");
    const v2 = clonePlayer("Revize (v2)", jobId, "v2");

    if (!v1 || !v2) return null;

    wrap.appendChild(v1);
    wrap.appendChild(v2);

    list.prepend(wrap);

    console.log("[music-generate] REAL PLAYER PAIR CLONED", jobId || "pending");
    return { wrap, v1, v2 };
  }

  function updatePair(pair, jobId) {
    try {
      pair.v1.setAttribute("data-job-id", `${jobId}:v1`);
      pair.v2.setAttribute("data-job-id", `${jobId}:v2`);
    } catch (_) {}
  }

  function wire() {
    const btn = findBtn();
    if (!btn) {
      console.warn("[music-generate] button not found, retrying…");
      setTimeout(wire, 500);
      return;
    }

    if (btn.dataset.wired === "1") return;
    btn.dataset.wired = "1";

    console.log("[music-generate] wired", btn);

    btn.addEventListener(
      "click",
      async (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (btn.dataset.busy === "1") return;
        btn.dataset.busy = "1";
        btn.disabled = true;

        console.log("[music-generate] clicked");

        // ✅ GERÇEK PLAYER’DAN KLONLA
        const pair = addPair(null);

        try {
          const r = await fetch("/api/music/generate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ type: "music" }),
          });

          const j = await r.json().catch(() => null);
          console.log("[music-generate] response", j);

          const jobId = j?.job_id || j?.jobId || j?.id;
          if (!jobId) return;

          window.AIVO_JOBS?.upsert?.({
            job_id: jobId,
            type: "music",
            created_at: Date.now(),
          });

          if (pair) updatePair(pair, jobId);
        } catch (err) {
          console.error("[music-generate] error", err);
        } finally {
          btn.dataset.busy = "0";
          btn.disabled = false;
        }
      },
      true
    );
  }

  wire();
})();
