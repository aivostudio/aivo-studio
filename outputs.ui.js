/* outputs.ui.js — TEK OTORİTE (migrate + premium right panel list + search + player hook) */
(function () {
  const $ = (q, root = document) => root.querySelector(q);

  // =========================
  // Storage (TEK KEY)
  // =========================
  const KEY = "AIVO_OUTPUTS_V1";

  // Legacy keys (sende görünenler)
  const LEGACY_KEYS = [
    "AIVO_OUTPUT_VIDEOS_V1", // bazen böyle yazılmış olabiliyor
    "AIVO_OUTPUT_VIDEOS_V1", // senin ekranda görünen (asıl)
    "AIVO_OUTPUTS_V1",       // eski denemeler
    "AIVO_JOBS",
    "AIVO_JOBS_V1",
    "AIVO_JOBS_V2",
  ];

  function safeParse(v, fallback) {
    try {
      const x = JSON.parse(v);
      return x ?? fallback;
    } catch {
      return fallback;
    }
  }

  function readKey(k) {
    const raw = localStorage.getItem(k);
    if (!raw) return null;
    const parsed = safeParse(raw, null);
    return parsed;
  }

  function writeKey(k, val) {
    try {
      localStorage.setItem(k, JSON.stringify(val));
    } catch {}
  }

  // =========================
  // Normalize / Migrate
  // =========================
  function normalizeOne(x) {
    // bazı eski formatlar: string ise src kabul et
    if (typeof x === "string") {
      return {
        id: "out-" + Math.random().toString(16).slice(2) + "-" + Date.now(),
        type: "video",
        title: "Video",
        sub: "MP4 çıktı",
        src: x,
        status: "ready",
        createdAt: Date.now(),
      };
    }

    const src = x?.src || x?.url || x?.href || "";
    const type = (x?.type || "video").toLowerCase(); // type yoksa video
    const status =
      x?.status === "ready" || x?.status === "error" || x?.status === "queued"
        ? x.status
        : (src ? "ready" : "queued");

    return {
      id: x?.id || ("out-" + Math.random().toString(16).slice(2) + "-" + Date.now()),
      type: type === "audio" || type === "image" || type === "video" ? type : "video",
      title: x?.title || (type === "audio" ? "Müzik" : type === "image" ? "Görsel" : "Video"),
      sub: x?.sub || (type === "audio" ? "MP3/WAV çıktı" : type === "image" ? "PNG/JPG çıktı" : "MP4 çıktı"),
      src,
      status,
      createdAt: Number(x?.createdAt || x?.ts || Date.now()),
    };
  }

  function normalizeList(list) {
    const arr = Array.isArray(list) ? list : [];
    const out = [];
    for (const x of arr) {
      const n = normalizeOne(x);
      // src boşsa da tutuyoruz ama en azından type var
      out.push(n);
    }
    // newest first
    out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    // limit
    return out.slice(0, 120);
  }

  function loadUnified() {
    const existing = readKey(KEY);
    if (Array.isArray(existing) && existing.length) return normalizeList(existing);

    // unified boşsa legacy’den topla
    for (const k of LEGACY_KEYS) {
      const v = readKey(k);
      if (Array.isArray(v) && v.length) {
        const migrated = normalizeList(v);
        writeKey(KEY, migrated);
        return migrated;
      }
    }
    return [];
  }

  function saveUnified(list) {
    writeKey(KEY, list.slice(0, 120));
  }

  // =========================
  // State
  // =========================
  const state = {
    list: loadUnified(),
    tab: "video",
    q: "",
    selectedId: null,
  };

  // =========================
  // Right Panel Player (varsa kullan)
  // =========================
  function openRightPanelVideo(src, title = "Video") {
    const wrap = document.getElementById("rpPlayer");
    const vid = document.getElementById("rpVideo");
    const ttl = document.getElementById("rpVideoTitle");

    if (ttl) ttl.textContent = title || "Video";
    if (!wrap || !vid) {
      // player yoksa sessizce geç (list yine çalışsın)
      return;
    }

    vid.src = src || "";
    wrap.hidden = false;
    try { vid.play?.(); } catch {}
  }

  document.getElementById("rpPlayerClose")?.addEventListener("click", () => {
    const wrap = document.getElementById("rpPlayer");
    const vid = document.getElementById("rpVideo");
    if (vid) {
      try { vid.pause(); } catch {}
      vid.removeAttribute("src");
      try { vid.load(); } catch {}
    }
    if (wrap) wrap.hidden = true;
  });

  // =========================
  // Mount (right card içine)
  // =========================
  function ensureMount() {
    let mount = document.getElementById("outputsMount");
    if (mount) return mount;

    const rightCard = $(".right-panel .right-card") || $(".right-panel .card.right-card") || $(".right-panel");
    if (!rightCard) return null;

    mount = document.createElement("div");
    mount.id = "outputsMount";

    // header varsa altına koy
    const hdr = rightCard.querySelector(".card-header");
    if (hdr && hdr.nextSibling) rightCard.insertBefore(mount, hdr.nextSibling);
    else rightCard.appendChild(mount);

    return mount;
  }

  // Legacy “son üretilen videolar” placeholder’ı gizle
  function hideLegacyBlocks() {
    const rightCard = $(".right-panel .right-card") || $(".right-panel .card.right-card");
    if (!rightCard) return;
    rightCard.querySelectorAll(":scope > .right-list").forEach((el) => (el.style.display = "none"));
    rightCard.querySelectorAll(":scope > .video-grid, :scope > .videos-grid").forEach((el) => (el.style.display = "none"));
  }

  // =========================
  // Styles (inject once)
  // =========================
  function ensureStyles() {
    if (document.getElementById("outputsUIStyles")) return;
    const st = document.createElement("style");
    st.id = "outputsUIStyles";
    st.textContent = `
#outputsMount{ display:block; width:100%; min-height: 260px; margin-top: 10px; }
.outputs-shell{
  border-radius: 18px;
  overflow: hidden;
  background: rgba(12,14,24,.55);
  border: 1px solid rgba(255,255,255,.08);
  box-shadow: 0 10px 40px rgba(0,0,0,.35);
  min-height: 260px;
}
.outputs-tabs{
  display:flex; gap:8px;
  padding: 10px 12px 12px;
  border-bottom: 1px solid rgba(255,255,255,.07);
  background: linear-gradient(to bottom, rgba(22,16,40,.72), rgba(12,14,24,.55));
  backdrop-filter: blur(10px);
}
.outputs-tab{
  flex:1; height: 36px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.05);
  color: rgba(255,255,255,.82);
  cursor:pointer;
  font-size: 13px;
  white-space: nowrap;
}
.outputs-tab.is-active{
  background: linear-gradient(90deg, rgba(128,88,255,.25), rgba(255,107,180,.18));
  border-color: rgba(167,139,255,.25);
  color:#fff;
}
.outputs-toolbar{
  position: sticky; top: 0; z-index: 3;
  padding: 10px 12px 12px;
  background: linear-gradient(to bottom, rgba(12,14,24,.92), rgba(12,14,24,.55));
  border-bottom: 1px solid rgba(255,255,255,.07);
  backdrop-filter: blur(10px);
}
.outputs-search{
  display:flex; align-items:center; gap:8px;
  height: 40px; padding: 0 12px;
  border-radius: 12px;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.09);
}
.os-ico{ opacity:.8; font-size: 14px; }
.os-input{
  flex:1; border:0; outline:0;
  background:transparent; color:#fff;
  font-size: 13px;
}
.os-input::placeholder{ color: rgba(255,255,255,.55); }
.os-clear{
  border:0;
  background: rgba(255,255,255,.08);
  color:#fff;
  height: 26px; width: 30px;
  border-radius: 10px;
  cursor:pointer;
}
.outputs-viewport{
  max-height: 58vh;
  min-height: 220px;
  overflow: auto;
  padding: 12px;
}
.outputs-viewport::-webkit-scrollbar{ width: 10px; }
.outputs-viewport::-webkit-scrollbar-thumb{
  background: rgba(255,255,255,.12);
  border-radius: 999px;
}
.outputs-viewport::-webkit-scrollbar-track{
  background: rgba(255,255,255,.04);
}
.out-grid{ display:grid; grid-template-columns: 1fr; gap: 12px; }
.out-card{
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.04);
  box-shadow: 0 10px 30px rgba(0,0,0,.28);
  cursor: pointer;
  transform: translateY(0);
  transition: transform .15s ease, border-color .15s ease, box-shadow .15s ease;
}
.out-card:hover{
  transform: translateY(-2px);
  border-color: rgba(170,140,255,.25);
  box-shadow: 0 16px 42px rgba(0,0,0,.36);
}
.out-card.is-selected{
  border-color: rgba(255,107,180,.35);
  box-shadow: 0 18px 50px rgba(0,0,0,.40);
}
.out-thumb{
  width: 100%;
  height: 160px;
  display:block;
  object-fit: cover;
  background: rgba(0,0,0,.35);
}
.out-thumb--audio{
  display:flex; align-items:center; justify-content:center;
  font-size: 34px; height: 140px;
  color: rgba(255,255,255,.9);
  background: radial-gradient(circle at 30% 20%, rgba(128,88,255,.22), rgba(0,0,0,.45));
}
.out-badge{
  position:absolute; top: 10px; left: 10px; z-index: 2;
  font-size: 12px; padding: 6px 10px;
  border-radius: 999px;
  background: rgba(0,0,0,.45);
  border: 1px solid rgba(255,255,255,.10);
  color: rgba(255,255,255,.9);
  backdrop-filter: blur(8px);
}
.out-badge.is-ready{ background: rgba(16,185,129,.18); border-color: rgba(16,185,129,.28); }
.out-badge.is-queued{ background: rgba(99,102,241,.16); border-color: rgba(99,102,241,.28); }
.out-badge.is-error{ background: rgba(239,68,68,.14); border-color: rgba(239,68,68,.25); }
.out-play{
  position:absolute; inset: 0;
  display:flex; align-items:center; justify-content:center;
  z-index: 1;
  background: radial-gradient(circle at 50% 50%, rgba(0,0,0,.08), rgba(0,0,0,.55));
  opacity: 0;
  transition: opacity .15s ease;
}
.out-card:hover .out-play{ opacity: 1; }
.out-play span{
  width: 54px; height: 54px;
  display:flex; align-items:center; justify-content:center;
  border-radius: 999px;
  background: rgba(255,255,255,.10);
  border: 1px solid rgba(255,255,255,.18);
  color:#fff; font-size: 20px;
  backdrop-filter: blur(10px);
}
.out-meta{
  display:flex; gap: 10px;
  align-items:flex-start;
  padding: 12px;
}
.out-title{
  font-weight: 700; font-size: 13px;
  color: rgba(255,255,255,.95);
  white-space: nowrap; overflow:hidden; text-overflow: ellipsis;
}
.out-sub{
  margin-top: 4px;
  font-size: 12px;
  color: rgba(255,255,255,.70);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.out-actions{ margin-left:auto; display:flex; gap:8px; }
.out-btn{
  display:inline-flex; align-items:center; justify-content:center;
  width: 34px; height: 34px;
  border-radius: 12px;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.10);
  color: rgba(255,255,255,.92);
  text-decoration:none;
}
.out-btn:hover{
  border-color: rgba(170,140,255,.25);
  background: rgba(255,255,255,.08);
}
.out-empty{
  padding: 14px 6px;
  text-align:center;
  color: rgba(255,255,255,.70);
  font-size: 13px;
}
    `;
    document.head.appendChild(st);
  }

  // =========================
  // Render
  // =========================
  function render() {
    ensureStyles();
    hideLegacyBlocks();

    const mount = ensureMount();
    if (!mount) return;

    // type yoksa video say
    const norm = state.list.map((x) => ({ ...x, type: (x.type || "video") }));

    const videos = norm.filter((x) => x.type === "video");
    const audios = norm.filter((x) => x.type === "audio");
    const images = norm.filter((x) => x.type === "image");

    const active = state.tab === "video" ? videos : state.tab === "audio" ? audios : images;

    const q = (state.q || "").trim().toLowerCase();
    const filtered = q
      ? active.filter((x) => {
          const badge = x.status === "ready" ? "hazır" : x.status === "error" ? "hata" : "sırada";
          const hay = `${x.title || ""} ${x.sub || ""} ${badge}`.toLowerCase();
          return hay.includes(q);
        })
      : active;

    mount.innerHTML = `
      <div class="outputs-shell">
        <div class="outputs-tabs">
          <button class="outputs-tab ${state.tab === "video" ? "is-active" : ""}" data-tab="video">🎬 Video (${videos.length})</button>
          <button class="outputs-tab ${state.tab === "audio" ? "is-active" : ""}" data-tab="audio">🎵 Müzik (${audios.length})</button>
          <button class="outputs-tab ${state.tab === "image" ? "is-active" : ""}" data-tab="image">🖼 Görsel (${images.length})</button>
        </div>

        <div class="outputs-toolbar">
          <div class="outputs-search">
            <span class="os-ico">⌕</span>
            <input class="os-input" id="outSearch" placeholder="Ara: başlık, durum..." autocomplete="off" />
            <button class="os-clear" id="outSearchClear" type="button" title="Temizle">✕</button>
          </div>
        </div>

        <div class="outputs-viewport">
          ${
            filtered.length
              ? `<div class="out-grid">${filtered.map(cardHTML).join("")}</div>`
              : `<div class="out-empty">Henüz çıktı yok.</div>`
          }
        </div>
      </div>
    `;

    const inp = mount.querySelector("#outSearch");
    const clr = mount.querySelector("#outSearchClear");
    if (inp) inp.value = state.q || "";

    mount.querySelectorAll("[data-tab]").forEach((b) => {
      b.addEventListener("click", () => {
        state.tab = b.dataset.tab;
        render();
      });
    });

    inp?.addEventListener("input", () => {
      state.q = inp.value || "";
      render();
    });
    clr?.addEventListener("click", () => {
      state.q = "";
      render();
    });

    mount.querySelectorAll("[data-out-id]").forEach((el) => {
      el.addEventListener("click", (e) => {
        const id = el.dataset.outId;
        const item = state.list.find((x) => x.id === id) || null;
        if (!item) return;

        if (e.target && e.target.closest && e.target.closest(".out-btn")) return;

        state.selectedId = id;
        mount.querySelectorAll(".out-card.is-selected").forEach((n) => n.classList.remove("is-selected"));
        el.classList.add("is-selected");

        if ((item.type || "video") === "video") {
          openRightPanelVideo(item.src, item.title || "Video");
        }
      });
    });
  }

  function cardHTML(item) {
    const type = (item.type || "video").toLowerCase();
    const badgeText = item.status === "ready" ? "Hazır" : item.status === "error" ? "Hata" : "Sırada";
    const badgeCls = item.status === "ready" ? "is-ready" : item.status === "error" ? "is-error" : "is-queued";
    const sub =
      item.sub ||
      (type === "video" ? "MP4 çıktı" : type === "audio" ? "MP3/WAV çıktı" : "PNG/JPG çıktı");

    const safeSrc = escapeHtml(item.src || "");

    const thumb =
      type === "video"
        ? `<video class="out-thumb" muted playsinline preload="metadata" src="${safeSrc}"></video>`
        : type === "audio"
        ? `<div class="out-thumb out-thumb--audio">♪</div>`
        : `<img class="out-thumb" alt="" src="${safeSrc}" />`;

    return `
      <div class="out-card" data-out-id="${escapeHtml(item.id)}">
        <div class="out-badge ${badgeCls}">${escapeHtml(badgeText)}</div>
        ${thumb}
        ${type === "video" ? `<div class="out-play"><span>▶</span></div>` : ``}
        <div class="out-meta">
          <div style="min-width:0;flex:1;">
            <div class="out-title">${escapeHtml(item.title || (type === "video" ? "Video" : "Çıktı"))}</div>
            <div class="out-sub">${escapeHtml(sub)}</div>
          </div>
          <div class="out-actions">
            <a class="out-btn" href="${safeSrc || "#"}" download title="İndir">⤓</a>
          </div>
        </div>
      </div>
    `;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // =========================
  // Public API (tek kapı)
  // =========================
  window.AIVO_OUTPUTS = {
    add(item) {
      const it = normalizeOne(
        Object.assign(
          {
            id: "out-" + Math.random().toString(16).slice(2) + "-" + Date.now(),
            type: "video",
            title: "Çıktı",
            sub: "",
            src: "",
            status: "queued",
            createdAt: Date.now(),
          },
          item || {}
        )
      );
      state.list.unshift(it);
      saveUnified(state.list);
      render();
      return it.id;
    },
    patch(id, patch) {
      const i = state.list.findIndex((x) => x.id === id);
      if (i === -1) return false;
      state.list[i] = normalizeOne(Object.assign({}, state.list[i], patch || {}));
      saveUnified(state.list);
      render();
      return true;
    },
    openTab(tab) {
      state.tab = tab || "video";
      render();
    },
    list() {
      return state.list.slice();
    },
    _debug() {
      return {
        key: KEY,
        len: state.list.length,
        sample: state.list.slice(0, 3),
      };
    },
  };

  // =========================
  // Boot
  // =========================
  render();

  // (isteğe bağlı) açılışta video tabını seç
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(() => window.AIVO_OUTPUTS?.openTab?.("video"), 50));
  } else {
    setTimeout(() => window.AIVO_OUTPUTS?.openTab?.("video"), 50);
  }

  // hızlı doğrulama log (görmek istersen)
  // console.log("[outputs.ui] loaded", window.AIVO_OUTPUTS?._debug?.());
})();
