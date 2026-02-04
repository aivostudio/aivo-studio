// studio.music.generate.js
window.__MUSIC_GENERATE__ = true;
console.log("[music-generate] script loaded");

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

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[m]));
  }

  function ensureList(host) {
    let list = host.querySelector("#__musicPairsList");
    if (!list) {
      // host’un mevcut içeriğini bozmadan en üste bir alan ekle
      const wrap = document.createElement("div");
      wrap.id = "__musicPairsWrap";
      wrap.style.cssText = "display:flex; flex-direction:column; gap:10px; margin:10px 0;";
      wrap.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <div style="font-weight:700;">Müzik (Live Inject)</div>
          <div style="opacity:.6; font-size:12px;">gen-v1</div>
        </div>
        <div id="__musicPairsList" style="display:flex; flex-direction:column; gap:10px;"></div>
      `;
      host.prepend(wrap);
      list = host.querySelector("#__musicPairsList");
    }
    return list;
  }

  function addPairCard({ title = "Processing", jobId = null } = {}) {
    const host = getHost();
    if (!host) {
      console.warn("[music-generate] #rightPanelHost yok");
      return null;
    }

    const list = ensureList(host);

    const id = "mp_" + Math.random().toString(16).slice(2);
    const card = document.createElement("div");
    card.className = "aivo-card";
    card.dataset.pairId = id;
    card.style.cssText = "border:1px solid rgba(255,255,255,.10); border-radius:12px; padding:10px;";

    card.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <div style="font-weight:600;">${esc(title)}</div>
        <div style="opacity:.7; font-size:12px;" data-job>${jobId ? "job: " + esc(jobId) : "job: (pending)"}</div>
      </div>

      <div style="margin-top:10px; display:flex; flex-direction:column; gap:10px;">
        <div>
          <div style="font-size:12px; opacity:.75; margin-bottom:4px;">Original (v1)</div>
          <audio controls preload="none" style="width:100%"></audio>
        </div>
        <div>
          <div style="font-size:12px; opacity:.75; margin-bottom:4px;">Revize (v2)</div>
          <audio controls preload="none" style="width:100%"></audio>
        </div>
      </div>
    `;

    list.appendChild(card);
    console.log("[music-generate] pair injected", id);
    return { id, card };
  }

  function setPairJob(pair, jobId) {
    try {
      const jobEl = pair?.card?.querySelector("[data-job]");
      if (jobEl) jobEl.textContent = "job: " + jobId;
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

        if (btn.dataset.busy === "1") {
          console.warn("[music-generate] busy, ignore click");
          return;
        }
        btn.dataset.busy = "1";
        btn.disabled = true;

        console.log("[music-generate] clicked");

        // ✅ HER TIKTA anında 2 player bas (RightPanel zincirinden bağımsız)
        const pair = addPairCard({ title: "Processing", jobId: null });

        try {
          const r = await fetch("/api/music/generate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ type: "music" }),
          });

          const j = await r.json().catch(() => null);
          console.log("[music-generate] response", j);

          const jobId = j?.job_id || j?.jobId || j?.id;
          if (!jobId) {
            console.error("[music-generate] job_id yok", j);
            return;
          }

          window.AIVO_JOBS?.upsert?.({
            job_id: jobId,
            type: "music",
            created_at: Date.now(),
          });

          if (pair) setPairJob(pair, jobId);

          // debug map
          try {
            window.__MUSIC_JOB_PAIR__ = window.__MUSIC_JOB_PAIR__ || {};
            window.__MUSIC_JOB_PAIR__[jobId] = pair;
            console.log("[music-generate] job->pair mapped", jobId, pair?.id);
          } catch (_) {}

          // event (opsiyonel)
          try {
            window.dispatchEvent(
              new CustomEvent("aivo:music:job", {
                detail: { job_id: jobId, ts: Date.now() }
              })
            );
          } catch (_) {}
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
