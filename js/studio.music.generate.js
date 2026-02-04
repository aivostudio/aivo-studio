// studio.music.generate.js
window.__MUSIC_GENERATE__ = true;
console.log("[music-generate] FINAL+POLL script loaded");

(function () {
  if (window.__MUSIC_GENERATE_WIRED__) return;
  window.__MUSIC_GENERATE_WIRED__ = true;

  function findBtn() {
    return (
      document.getElementById("musicGenerateBtnn") ||
      document.getElementById("musicGenerateBtn") ||
      document.querySelector('button[data-generate="music"]')
    );
  }

  function getHost() {
    return document.getElementById("rightPanelHost");
  }

  function getTemplateCard() {
    return document.querySelector(".aivo-player-card");
  }

  function ensureList(host) {
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

  function setTextFirst(el, selectors, text) {
    for (const sel of selectors) {
      const t = el.querySelector(sel);
      if (t) {
        t.textContent = text;
        return true;
      }
    }
    return false;
  }

  function setReadyBadge(card) {
    card.querySelectorAll("*").forEach((node) => {
      if (!node || !node.textContent) return;
      const txt = node.textContent.trim();
      if (txt === "İşleniyor" || txt === "Hazırlanıyor…" || txt === "Processing") {
        node.textContent = "Hazır";
      }
    });
  }

  function sanitizeToProcessing(card, { label, jobId, suffix }) {
    const jid = jobId ? `${jobId}:${suffix}` : `pending:${suffix}:${Date.now()}`;

    card.setAttribute("data-job-id", jid);
    card.setAttribute("data-output-id", jid);
    card.setAttribute("data-title", label);
    card.setAttribute("data-src", ""); // <-- hazır olunca dolduracağız
    card.classList.add("is-processing");

    const playBtn = card.querySelector('[data-action="toggle-play"], .aivo-player-btn');
    if (playBtn) {
      playBtn.disabled = true;
      playBtn.style.opacity = "0.55";
      playBtn.title = "İşleniyor";
      playBtn.setAttribute("aria-label", "İşleniyor");
    }

    card.querySelectorAll("button, a").forEach((el) => {
      const act = el.getAttribute("data-action") || "";
      if (act && act !== "toggle-play") el.style.display = "none";
    });

    const titleSelectors = [
      ".aivo-player-title",
      ".aivo-player-name",
      ".aivo-player-meta .title",
      ".aivo-player-meta strong",
      "strong",
      "h4",
      "h3",
    ];
    const subSelectors = [
      ".aivo-player-subtitle",
      ".aivo-player-desc",
      ".aivo-player-meta small",
      "small",
      ".subtitle",
    ];

    setTextFirst(card, titleSelectors, label);
    setTextFirst(card, subSelectors, "Hazırlanıyor…");

    return jid;
  }

  function injectPair(jobId = null) {
    const host = getHost();
    if (!host) {
      console.error("[music-generate] #rightPanelHost yok");
      return null;
    }

    const tpl = getTemplateCard();
    if (!tpl) {
      console.error("[music-generate] template .aivo-player-card bulunamadı (sayfada en az 1 hazır kart olmalı)");
      return null;
    }

    const list = ensureList(host);

    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.gap = "10px";

    const v1 = tpl.cloneNode(true);
    const v2 = tpl.cloneNode(true);

    sanitizeToProcessing(v1, { label: "Original (v1)", jobId, suffix: "v1" });
    sanitizeToProcessing(v2, { label: "Revize (v2)", jobId, suffix: "v2" });

    wrap.appendChild(v1);
    wrap.appendChild(v2);
    list.prepend(wrap);

    return { wrap, v1, v2 };
  }

  function bindSrc(card, src) {
    if (!src) return false;

    // src’yi card’a bas
    card.setAttribute("data-src", src);

    // play aç
    const playBtn = card.querySelector('[data-action="toggle-play"], .aivo-player-btn');
    if (playBtn) {
      playBtn.disabled = false;
      playBtn.style.opacity = "1";
      playBtn.title = "Oynat";
      playBtn.setAttribute("aria-label", "Oynat");
    }

    // “processing” sınıfı kalksın
    card.classList.remove("is-processing");
    setReadyBadge(card);

    return true;
  }

  // job status’tan audio url bulmaya çalış (çok toleranslı)
  function extractAudioUrl(statusJson) {
    if (!statusJson) return null;

    // olası alanlar: outputs, output, result, files, media...
    const candidates = [];

    const pushAny = (v) => {
      if (!v) return;
      if (typeof v === "string") candidates.push(v);
      else if (Array.isArray(v)) v.forEach(pushAny);
      else if (typeof v === "object") {
        Object.values(v).forEach(pushAny);
      }
    };

    pushAny(statusJson.outputs);
    pushAny(statusJson.output);
    pushAny(statusJson.result);
    pushAny(statusJson.files);
    pushAny(statusJson.media);
    pushAny(statusJson.data);

    // audio gibi görünen ilk URL
    const url = candidates.find((s) =>
      typeof s === "string" &&
      (s.includes("/files/play?") || s.includes(".mp3") || s.includes(".wav") || s.includes(".m4a") || s.includes("audio"))
    );

    return url || null;
  }

  async function pollUntilReady(jobId, pair, timeoutMs = 120000) {
    const t0 = Date.now();

    while (Date.now() - t0 < timeoutMs) {
      try {
        const r = await fetch(`/api/jobs/status?job_id=${encodeURIComponent(jobId)}`, {
          headers: { "accept": "application/json" },
        });
        const j = await r.json().catch(() => null);

        const url = extractAudioUrl(j);
        if (url) {
          // v1/v2 için şimdilik aynı src basıyoruz (backend v1/v2 ayrı veriyorsa sonra ayırırız)
          const ok1 = bindSrc(pair.v1, url);
          const ok2 = bindSrc(pair.v2, url);
          console.log("[music-generate] READY", { jobId, url, ok1, ok2 });
          return true;
        }
      } catch (e) {
        // status endpoint bazen 500 atıyor; devam
      }

      await new Promise((res) => setTimeout(res, 1500));
    }

    console.warn("[music-generate] poll timeout", jobId);
    return false;
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

        const pair = injectPair(null);

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

          // job id’leri bas
          if (pair) {
            sanitizeToProcessing(pair.v1, { label: "Original (v1)", jobId, suffix: "v1" });
            sanitizeToProcessing(pair.v2, { label: "Revize (v2)", jobId, suffix: "v2" });
          }

          // ✅ hazır olana kadar poll → src bağla → “canlı” olur
          if (pair) pollUntilReady(jobId, pair);
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
