/* =========================================================
   outputs.ui.js — FINAL TEK BLOK
   TEK OTORİTE OUTPUTS + LEGACY KAPALI
   ========================================================= */
(function () {
  "use strict";

  /* ------------------ Utils ------------------ */
  const $ = (q, r = document) => r.querySelector(q);
  const $$ = (q, r = document) => Array.from(r.querySelectorAll(q));

  /* ------------------ Storage ------------------ */
  const KEY = "AIVO_OUTPUTS_V1";

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
    catch { return []; }
  }
  function write(v) {
    localStorage.setItem(KEY, JSON.stringify(v.slice(0, 120)));
  }

  /* ------------------ State ------------------ */
  const state = {
    list: read(),
    tab: "video",
    q: ""
  };

  /* ------------------ FORCE LEGACY OFF ------------------ */
  function killLegacy() {
    const root =
      document.querySelector(".right-panel") ||
      document.querySelector(".right-card") ||
      document.body;

    $$(
      `
      .right-list,
      .legacy-right-list,
      .old-output-list,
      .out-videos,
      #outVideosGrid,
      #videoList,
      #videoEmpty,
      .video-card,
      .vplay,
      .vactions
    `,
      root
    ).forEach(el => {
      el.style.display = "none";
      el.style.visibility = "hidden";
      el.style.pointerEvents = "none";
    });
  }

  /* ------------------ Styles (INLINE) ------------------ */
  function injectCSS() {
    if ($("#outputsUIStyles")) return;
    const s = document.createElement("style");
    s.id = "outputsUIStyles";
    s.textContent = `
#outputsMount{display:block!important;min-height:360px}
.outputs-shell{border-radius:18px;overflow:hidden;
background:rgba(12,14,24,.65);
border:1px solid rgba(255,255,255,.1)}
.outputs-tabs{display:flex;gap:8px;padding:10px}
.outputs-tab{flex:1;height:36px;border-radius:12px;
background:rgba(255,255,255,.06);
border:1px solid rgba(255,255,255,.12);
color:#fff;cursor:pointer}
.outputs-tab.is-active{background:linear-gradient(90deg,#8058ff55,#ff6bb455)}
.outputs-viewport{padding:12px}
.out-grid{display:grid;grid-template-columns:1fr;gap:12px}
.out-card{border-radius:16px;overflow:hidden;
border:1px solid rgba(255,255,255,.12);
background:rgba(255,255,255,.05)}
.out-thumb{width:100%;height:160px;object-fit:cover;background:#000}
.out-meta{display:flex;gap:10px;padding:12px}
.out-title{font-weight:700;color:#fff}
.out-actions{margin-left:auto;display:flex;gap:8px}
.out-btn{width:34px;height:34px;border-radius:10px;
background:rgba(255,255,255,.08);
border:1px solid rgba(255,255,255,.2);
color:#fff;cursor:pointer}
.out-btn.is-danger{background:#ef444433;border-color:#ef4444}
.out-empty{text-align:center;color:#aaa;padding:20px}
`;
    document.head.appendChild(s);
  }

  /* ------------------ Mount ------------------ */
  function ensureMount() {
    let m = document.getElementById("outputsMount");
    if (m) return m;

    const host =
      document.querySelector(".right-panel .right-card") ||
      document.querySelector(".right-panel") ||
      document.body;

    m = document.createElement("div");
    m.id = "outputsMount";
    host.appendChild(m);
    return m;
  }

  /* ------------------ Render ------------------ */
  function render() {
    injectCSS();
    killLegacy();

    const m = ensureMount();
    if (!m) return;

    const items = state.list.filter(x => x.type === "video");
    const visible = state.tab === "video" ? items : [];

    m.innerHTML = `
      <div class="outputs-shell">
        <div class="outputs-tabs">
          <button class="outputs-tab is-active" data-tab="video">
            🎬 Video (${items.length})
          </button>
        </div>
        <div class="outputs-viewport">
          ${
            visible.length
              ? `<div class="out-grid">
                  ${visible
                    .map(
                      v => `
                    <div class="out-card" data-id="${v.id}">
                      <video class="out-thumb" src="${v.src}" preload="metadata"></video>
                      <div class="out-meta">
                        <div>
                          <div class="out-title">${v.title}</div>
                          <div style="opacity:.7">${v.sub || ""}</div>
                        </div>
                        <div class="out-actions">
                          <button class="out-btn" data-act="open">▶</button>
                          <button class="out-btn" data-act="download">⤓</button>
                          <button class="out-btn is-danger" data-act="delete">🗑</button>
                        </div>
                      </div>
                    </div>`
                    )
                    .join("")}
                </div>`
              : `<div class="out-empty">Henüz video yok</div>`
          }
        </div>
      </div>
    `;
  }

  /* ------------------ Events ------------------ */
  document.addEventListener("click", e => {
    const card = e.target.closest(".out-card");
    if (!card) return;
    const id = card.dataset.id;
    const item = state.list.find(x => x.id === id);
    if (!item) return;

    const act = e.target.dataset.act;
    if (!act) return;

    e.stopPropagation();
    e.preventDefault();

    if (act === "open") {
      const rp = document.getElementById("rpVideo");
      const wrap = document.getElementById("rpPlayer");
      if (rp && wrap) {
        rp.src = item.src;
        wrap.hidden = false;
        rp.play().catch(() => {});
      }
    }

    if (act === "download") {
      const a = document.createElement("a");
      a.href = item.src;
      a.download = "";
      a.click();
    }

    if (act === "delete") {
      if (!confirm("Silinsin mi?")) return;
      state.list = state.list.filter(x => x.id !== id);
      write(state.list);
      render();
    }
  });

  /* ------------------ API ------------------ */
  window.AIVO_OUTPUTS = {
    add(o) {
      const it = {
        id: o.id || "out-" + Date.now(),
        type: o.type || "video",
        title: o.title || "Video",
        sub: o.sub || "",
        src: o.src || "",
        status: o.status || "ready"
      };
      state.list.unshift(it);
      write(state.list);
      render();
      return it.id;
    },
    list() {
      return state.list.slice();
    },
    openTab() {
      render();
    }
  };

  /* ------------------ BOOT ------------------ */
  render();
  setTimeout(render, 300);
  setTimeout(render, 1200);
})();
