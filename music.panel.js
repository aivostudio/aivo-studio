// music.panel.js — minimal, outputs.ui.js bağımsız
(function () {
  "use strict";
  const mount =
    document.querySelector(".right-panel .right-card") ||
    document.querySelector(".right-panel") ||
    document.body;

  // küçük bir alan aç
  let box = document.getElementById("musicPanelMount");
  if (!box) {
    box = document.createElement("div");
    box.id = "musicPanelMount";
    box.style.cssText =
      "margin-top:12px;border:1px solid rgba(255,255,255,.10);border-radius:16px;padding:12px;background:rgba(12,14,24,.55);";
    mount.appendChild(box);
  }

  function safe(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[c]));
  }

  function pickAudios(list) {
    return (list || []).filter(x =>
      x && (x.type === "audio" || /mp3|wav|m4a|aac|ogg/i.test(x.src || "")));
  }

  function render() {
    const list = (window.AIVO_OUTPUTS?.list?.() || []);
    const audios = pickAudios(list).sort((a,b)=> (b.createdAt||0)-(a.createdAt||0));
    const firstReady = audios.find(x => (x.status || "") === "ready" && x.src) || audios.find(x=>x.src);

    box.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <div style="font-weight:800;color:#fff;">🎵 Müzik Player</div>
        <button id="mpReload" style="border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;border-radius:12px;padding:6px 10px;cursor:pointer;">Yenile</button>
      </div>

      <div style="margin-top:10px;">
        <audio id="mpAudio" controls preload="metadata" style="width:100%;"></audio>
      </div>

      <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px;">
        ${
          audios.length
            ? audios.map(x => `
              <button
                class="mpItem"
                data-src="${safe(x.src || "")}"
                style="text-align:left;border:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.18);color:#fff;border-radius:12px;padding:10px;cursor:pointer;"
              >
                <div style="font-weight:800;">${safe(x.title || "Müzik")}</div>
                <div style="opacity:.75;font-size:12px;">${safe(x.sub || x.status || "")}</div>
              </button>
            `).join("")
            : `<div style="opacity:.7;color:#fff;">Henüz müzik çıktısı yok.</div>`
        }
      </div>
    `;

    const audio = box.querySelector("#mpAudio");
    if (audio && firstReady?.src) audio.src = firstReady.src;

    box.querySelector("#mpReload")?.addEventListener("click", render);
    box.querySelectorAll(".mpItem").forEach(btn => {
      btn.addEventListener("click", () => {
        const src = btn.getAttribute("data-src");
        if (!src) return;
        audio.src = src;
        try { audio.play(); } catch {}
      });
    });
  }

  render();
  // dışarıdan güncellenirse tekrar çizmek için:
  window.__AIVO_MUSIC_PANEL_RELOAD__ = render;
})();
