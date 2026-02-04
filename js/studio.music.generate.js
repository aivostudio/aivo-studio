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
      const wrap = document.createElement("div");
      wrap.id = "__musicPairsWrap";
      wrap.style.cssText = "display:flex; flex-direction:column; gap:10px; margin:10px 0;";
      wrap.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <div style="font-weight:700;">Müzik (Player Inject)</div>
          <div style="opacity:.6; font-size:12px;">gen-v2</div>
        </div>
        <div id="__musicPairsList" style="display:flex; flex-direction:column; gap:10px;"></div>
      `;
      host.prepend(wrap);
      list = host.querySelector("#__musicPairsList");
    }
    return list;
  }

  function tryInitPlayer() {
    const p = window.__AIVO_PLAYER_V1__;
    if (!p) {
      console.warn("[music-generate] __AIVO_PLAYER_V1__ yok");
      return;
    }

    // “ne varsa dene” – hata yutuyoruz
    const fns = ["scan", "init", "mountAll", "refresh", "boot"];
    for (const fn of fns) {
      try {
        if (typeof p[fn] === "function") {
          console.log("[music-generate] player init via", fn);
          p[fn]();
          return;
        }
      } catch (e) {
        console.warn("[music-generate] player init failed:", fn, e);
      }
    }

    console.warn("[music-generate] player init fn bulunamadı (scan/init/mountAll/refresh/boot)");
  }

  // ✅ bizim player’ın anlayacağı “aivo-player-card” DOM’u bas
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

    // data-job-id + data-src: player bu pattern’i kullanıyor (mevcut UI’da gördüğünüz gibi)
    const v1Job = jobId ? esc(jobId) + ":v1" : "";
    const v2Job = jobId ? esc(jobId) + ":v2" : "";

    card.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <div style="font-weight:600;">${esc(title)}</div>
        <div style="opacity:.7; font-size:12px;" data-job>${jobId ? "job: " + esc(jobId) : "job: (pending)"}</div>
      </div>

      <div style="margin-top:10px; display:flex; flex-direction:column; gap:10px;">
        <div>
          <div style="font-size:12px; opacity:.75; margin-bottom:6px;">Original (v1)</div>
          <div class="aivo-player-card is-ready"
               data-job-id="${v1Job}"
               data-src=""
               data-title="Original (v1)"
               style="border:1px solid rgba(255,255,255,.08); border-radius:12px; padding:10px;">
          </div>
        </div>

        <div>
          <div style="font-size:12px; opacity:.75; margin-bottom:6px;">Revize (v2)</div>
          <div class="aivo-player-card is-ready"
               data-job-id="${v2Job}"
               data-src=""
               data-title="Revize (v2)"
               style="border:1px solid rgba(255,255,255,.08); border-radius:12px; padding:10px;">
          </div>
        </div>
      </div>
    `;

    list.appendChild(card);

    // player “scan” edebilsin diye bir tick sonra init dene
    setTimeout(tryInitPlayer, 0);

    console.log("[music-generate] pair injected (player dom)", id);
    return { id, card };
  }

  function setPairJob(pair, jobId) {
    try {
      const jobEl = pair?.card?.querySelector("[data-job]");
      if (jobEl) jobEl.textContent = "job: " + jobId;

      // iki card’ın data-job-id’sini de güncelle
      const cards = pair?.card?.querySelectorAll(".aivo-player-card");
      if (cards && cards.length >= 2) {
        cards[0].setAttribute("data-job-id", jobId + ":v1");
        cards[1].setAttribute("data-job-id", jobId + ":v2");
      }

      setTimeout(tryInitPlayer, 0);
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

        // ✅ placeholder: bizim player DOM’u
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
