/* outputs.ui.js — TEK OTORİTE OUTPUTS + TEK MP4 PLAYER (Right Panel)
   - Source of truth: localStorage["AIVO_OUTPUTS_V1"]
   - Legacy migrate (tek sefer): AIVO_OUTPUT_VIDEOS_V1
   - DEMO/LEGACY VIDEO DROP: flower.mp4 / BigBuckBunny / test-videos vb. otomatik silinir
   - NO MutationObserver
   - SADECE 2 TAB: Video + Müzik
   - Default tab: Video → "video" | Müzik/Ses → "audio" | Diğer → "audio"
   - Public API: window.AIVO_OUTPUTS.{add,patch,list,reload,openTab,openVideo,closeVideo,open}
*/
(function () {
  "use strict";

  const $ = (q, root = document) => root.querySelector(q);
  const $$ = (q, root = document) => Array.from(root.querySelectorAll(q));

  const KEY = "AIVO_OUTPUTS_V1";
  const LEGACY_KEY = "AIVO_OUTPUT_VIDEOS_V1";

  const DEMO_SRC_RE =
    /(cc0-videos\/flower\.mp4|\/flower\.mp4|big[_-]?buck[_-]?bunny|test-videos\.co\.uk|commondatastorage\.googleapis\.com\/gtv-videos-bucket|mdn\/.*flower\.mp4)/i;

  const RE_AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|flac)(\?|#|$)/i;
  const RE_VIDEO_EXT = /\.(mp4|webm|mov|mkv|m4v)(\?|#|$)/i;
  const RE_IMG_EXT = /\.(png|jpg|jpeg|webp|gif)(\?|#|$)/i;

  function readLS(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  function writeLS(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch {
      return false;
    }
  }

  function detectPageKey() {
    const b = document.body;
    const fromBody = b?.getAttribute("data-page") || b?.dataset?.page || b?.id || "";

    let fromUrl = "";
    try {
      const u = new URL(location.href);
      fromUrl = u.searchParams.get("to") || u.searchParams.get("page") || u.searchParams.get("tab") || "";
    } catch {}

    return String(fromUrl || fromBody || "").toLowerCase();
  }

  function defaultTabForPageKey(key) {
    key = String(key || "").toLowerCase();
    if (key.includes("video") || key.includes("clip") || key.includes("movie")) return "video";

    if (
      key.includes("muzik") ||
      key.includes("müzik") ||
      key.includes("music") ||
      key.includes("ses") ||
      key.includes("kayit") ||
      key.includes("kayıt") ||
      key.includes("audio") ||
      key.includes("record")
    ) {
      return "audio";
    }

    return "audio";
  }

  // { id, type:"video"|"audio", title, sub, src, status:"queued"|"ready"|"error", createdAt }
  function toUnified(item) {
    if (!item || typeof item !== "object") return null;

    const id =
      item.id ||
      item.job_id ||
      item.output_id ||
      ("out-" + Math.random().toString(16).slice(2) + "-" + Date.now());

    const src = item.src || item.url || item.downloadUrl || item.fileUrl || item.output_url || "";
    const titleGuess = (item.title || item.name || item.label || "").toString().toLowerCase();
    const subGuess = (item.sub || item.subtitle || item.desc || item.badge || "").toString().toLowerCase();

    if (src && DEMO_SRC_RE.test(String(src))) return null;

    let type = (item.type || item.kind || item.mediaType || "").toString().toLowerCase();
    if (type.includes("vid")) type = "video";
    else if (type.includes("aud") || type.includes("music")) type = "audio";
    else type = "";

    if (!type && src) {
      const s = String(src);
      if (RE_AUDIO_EXT.test(s)) type = "audio";
      else if (RE_VIDEO_EXT.test(s)) type = "video";
      else if (RE_IMG_EXT.test(s)) type = "audio";
    }

    if (!type) {
      if (
        titleGuess.includes("müzik") ||
        titleGuess.includes("muzik") ||
        titleGuess.includes("audio") ||
        subGuess.includes("mp3") ||
        subGuess.includes("wav")
      )
        type = "audio";
      else if (titleGuess.includes("video") || subGuess.includes("mp4")) type = "video";
    }

    if (!type) type = "audio";
    if (!["video", "audio"].includes(type)) type = "audio";

    const title = item.title || item.name || item.label || (type === "video" ? "Video" : "Müzik");
    const sub = item.sub || item.subtitle || item.desc || item.badge || "";

    let status = item.status;
    if (!status) {
      const b = (item.badge || item.state || "").toString().toLowerCase();
      if (b.includes("haz")) status = "ready";
      else if (b.includes("hat") || b.includes("err")) status = "error";
      else if (b.includes("sır") || b.includes("sir") || b.includes("que") || b.includes("işlen") || b.includes("islen"))
        status = "queued";
    }

    status = (status || "queued").toString().toLowerCase();
    if (status === "ok" || status === "done") status = "ready";
    if (status === "processing" || status === "pending") status = "queued";
    if (status === "fail") status = "error";
    if (!["queued", "ready", "error"].includes(status)) status = "queued";

    const createdAt = Number(item.createdAt) || Number(item.created_at) || Number(item.ts) || Number(item.time) || Date.now();

    return { id, type, title, sub, src, status, createdAt };
  }

  function uniqById(list) {
    const seen = new Set();
    const out = [];
    for (const x of list) {
      if (!x || !x.id) continue;
      if (seen.has(x.id)) continue;
      seen.add(x.id);
      out.push(x);
    }
    return out;
  }

  function migrateIfNeeded() {
    const unifiedRaw = readLS(KEY);
    const unifiedList = Array.isArray(unifiedRaw) ? unifiedRaw.map(toUnified).filter(Boolean) : [];

    if (unifiedList.length) {
      const normalized = uniqById(unifiedList)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, 120);
      writeLS(KEY, normalized);
      return normalized;
    }

    const legacyRaw = readLS(LEGACY_KEY);
    if (Array.isArray(legacyRaw) && legacyRaw.length) {
      const migrated = uniqById(legacyRaw.map(toUnified).filter(Boolean))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, 120);
      writeLS(KEY, migrated);
      return migrated;
    }

    writeLS(KEY, []);
    return [];
  }

  const state = {
    list: migrateIfNeeded(),
    tab: defaultTabForPageKey(detectPageKey()),
    q: "",
    selectedId: null,
  };

  function persist() {
    writeLS(KEY, state.list.slice(0, 120));
  }

  // ===== Right Panel MP4 Player (TEK OTORİTE) =====
  function openRightPanelVideo(src, title = "Video") {
    if (!src || DEMO_SRC_RE.test(String(src))) return false;

    const wrap = document.getElementById("rpPlayer");
    const vid = document.getElementById("rpVideo");
    const ttl = document.getElementById("rpVideoTitle");

    if (wrap && vid) {
      if (ttl) ttl.textContent = title;

      try {
        vid.pause();
        vid.removeAttribute("src");
        vid.load();
      } catch {}

      vid.src = src;

      wrap.hidden = false;
      wrap.removeAttribute("hidden");
      wrap.classList.add("is-open");

      try {
        const p = vid.play?.();
        if (p && typeof p.catch === "function") p.catch(() => {});
      } catch {}

      return true;
    }

    // fallback
    openPreview({
      id: "tmp",
      type: "video",
      title: title || "Video",
      sub: "",
      src,
      status: "ready",
      createdAt: Date.now(),
    });
    return true;
  }

  function closeRightPanelVideo() {
    const wrap = document.getElementById("rpPlayer");
    const vid = document.getElementById("rpVideo");

    if (vid) {
      try {
        vid.pause();
        vid.removeAttribute("src");
        vid.load();
      } catch {}
    }

    if (wrap) {
      wrap.hidden = true;
      wrap.setAttribute("hidden", "");
      wrap.classList.remove("is-open");
    }
  }

  document.getElementById("rpPlayerClose")?.addEventListener("click", closeRightPanelVideo);

  // ===== Mount / Title =====
  function ensureMount() {
    let mount = document.getElementById("outputsMount");
    if (mount) return mount;

    const rightCard =
      document.querySelector(".right-panel .right-card") ||
      document.querySelector(".right-panel .card.right-card") ||
      document.querySelector(".right-panel") ||
      document.querySelector("[data-panel='right']") ||
      document.querySelector("#rightPanel") ||
      document.querySelector("#right-panel") ||
      document.body;

    mount = document.createElement("div");
    mount.id = "outputsMount";
    rightCard.appendChild(mount);
    return mount;
  }

  function findRightPanelTitleNode() {
    const right =
      document.querySelector(".right-panel .right-card") ||
      document.querySelector(".right-panel .card.right-card") ||
      document.querySelector(".right-panel") ||
      document.querySelector("#rightPanel") ||
      document.querySelector("#right-panel");
    if (!right) return null;

    return right.querySelector("h1") || right.querySelector("h2") || right.querySelector("h3") || right.querySelector(".title") || right.querySelector(".card-title");
  }

  function renamePanelTitleToOutputs() {
    const n = findRightPanelTitleNode();
    if (!n) return;
    if ((n.textContent || "").trim() !== "Çıktılarım") n.textContent = "Çıktılarım";
  }

  function hideLegacyRightList() {
    const roots = [];
    const rightCard =
      document.querySelector(".right-panel .right-card") ||
      document.querySelector(".right-panel .card.right-card") ||
      document.querySelector(".right-panel") ||
      document.querySelector("#rightPanel") ||
      document.querySelector("#right-panel");

    if (rightCard) roots.push(rightCard);
    roots.push(document);

    const legacySelectors = [
      ".right-list",
      ".legacy-right-list",
      ".old-output-list",
      "#videoList",
      "#recordList",
      "#outVideosGrid",
      ".out-videos",
      ".video-card",
      ".vplay",
      ".vactions",
      ".right-empty",
      ".right-empty-wrap",
    ];

    roots.forEach((root) => {
      legacySelectors.forEach((sel) => {
        const nodes = root.querySelectorAll ? root.querySelectorAll(sel) : [];
        nodes.forEach((el) => {
          el.setAttribute("data-legacy-hidden", "1");
          el.style.setProperty("display", "none", "important");
          el.style.setProperty("visibility", "hidden", "important");
          el.style.setProperty("pointer-events", "none", "important");
          el.style.setProperty("opacity", "0", "important");
          el.style.setProperty("height", "0", "important");
          el.style.setProperty("min-height", "0", "important");
          el.style.setProperty("margin", "0", "important");
          el.style.setProperty("padding", "0", "important");
        });
      });
    });
  }

  // ===== Styles (inject once) =====
  function ensureStyles() {
    if (document.getElementById("outputsUIStyles")) return;
    const st = document.createElement("style");
    st.id = "outputsUIStyles";
    st.textContent = `
/* === AIVO AUDIO PLAYER BAR === */
.aivo-audio-player{
  margin: 10px 12px 0;
  padding: 10px 12px 12px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(0,0,0,.18);
}
.aivo-audio-title{
  font-size: 12.5px;
  font-weight: 800;
  color: rgba(255,255,255,.90);
  margin-bottom: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
#musicPlayer{
  width: 100%;
  display: block;
}

/* --- Outputs UI (V2) --- */
#outputsMount{ display:block !important; min-height: 360px !important; margin-top: 10px; min-width:0; position:relative; z-index: 50; }

.outputs-shell{ border-radius: 18px; overflow: hidden; background: rgba(12,14,24,.55); border: 1px solid rgba(255,255,255,.08); box-shadow: 0 10px 40px rgba(0,0,0,.35); position:relative; z-index: 50; }
.outputs-tabs{ display:flex; gap:8px; padding: 10px 12px 12px; border-bottom: 1px solid rgba(255,255,255,.07); background: linear-gradient(to bottom, rgba(22,16,40,.72), rgba(12,14,24,.55)); backdrop-filter: blur(10px); }
.outputs-tab{ flex:1; height: 36px; border-radius: 12px; border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.05); color: rgba(255,255,255,.82); cursor:pointer; font-size: 13px; white-space: nowrap; }
.outputs-tab.is-active{ background: linear-gradient(90deg, rgba(128,88,255,.25), rgba(255,107,180,.18)); border-color: rgba(167,139,255,.25); color:#fff; }

.outputs-toolbar{ padding: 10px 12px 12px; background: linear-gradient(to bottom, rgba(12,14,24,.92), rgba(12,14,24,.55)); border-bottom: 1px solid rgba(255,255,255,.07); backdrop-filter: blur(10px); }
.outputs-search{ display:flex; align-items:center; gap:8px; height: 40px; padding: 0 12px; border-radius: 12px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.09); }
.os-input{ flex:1; border:0; outline:0; background:transparent; color:#fff; font-size: 13px; min-width:0; }
.os-input::placeholder{ color: rgba(255,255,255,.55); }
.os-clear{ border:0; background: rgba(255,255,255,.08); color:#fff; height: 26px; width: 30px; border-radius: 10px; cursor:pointer; }

.outputs-viewport{ max-height: 52vh; overflow: auto; padding: 12px; }

#outputsMount .out-grid{
  display: grid !important;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)) !important;
  gap: 12px !important;
  align-items: stretch !important;
}
@media (max-width: 360px){
  #outputsMount .out-grid{ grid-template-columns: 1fr !important; }
}

#outputsMount .out-card{
  height: auto !important;
  min-height: 0 !important;
  display: flex !important;
  flex-direction: column !important;
}

.out-card{ position: relative; border-radius: 14px; overflow: hidden; border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.04); box-shadow: 0 10px 30px rgba(0,0,0,.28); cursor: pointer; transition: transform .15s ease, border-color .15s ease, box-shadow .15s ease; }
.out-card:hover{ transform: translateY(-2px); border-color: rgba(170,140,255,.25); box-shadow: 0 16px 42px rgba(0,0,0,.36); }
.out-card.is-selected{ border-color: rgba(255,107,180,.35); box-shadow: 0 18px 50px rgba(0,0,0,.40); }

#outputsMount .out-thumb{ flex: 0 0 auto !important; height: 120px !important; max-height: 120px !important; }

.out-thumb{ width: 100%; height: 120px; display:block; object-fit: cover; background: rgba(0,0,0,.35); }

.out-thumb--audio{
  width:100%; height:120px; display:flex; align-items:center; justify-content:center;
  font-size: 34px; color: rgba(255,255,255,.92);
  background: radial-gradient(circle at 30% 20%, rgba(128,88,255,.24), rgba(0,0,0,.46));
}
.out-thumb--empty{ display:flex; align-items:center; justify-content:center; font-size: 12px; height: 120px; color: rgba(255,255,255,.65); background: rgba(0,0,0,.28); }

.out-badge{ position:absolute; top: 8px; left: 8px; z-index: 2; font-size: 11px; padding: 5px 9px; border-radius: 999px; background: rgba(0,0,0,.45); border: 1px solid rgba(255,255,255,.10); color: rgba(255,255,255,.9); backdrop-filter: blur(8px); }
.out-badge.is-ready{ background: rgba(16,185,129,.18); border-color: rgba(16,185,129,.28); }
.out-badge.is-queued{ background: rgba(99,102,241,.16); border-color: rgba(99,102,241,.28); }
.out-badge.is-error{ background: rgba(239,68,68,.14); border-color: rgba(239,68,68,.25); }

.out-play{ position:absolute; inset: 0; display:flex; align-items:center; justify-content:center; z-index: 1; background: radial-gradient(circle at 50% 50%, rgba(0,0,0,.08), rgba(0,0,0,.55)); opacity: 0; transition: opacity .15s ease; pointer-events:none; }
.out-card:hover .out-play{ opacity: 1; }
.out-play span{ width: 50px; height: 50px; display:flex; align-items:center; justify-content:center; border-radius: 999px; background: rgba(255,255,255,.10); border: 1px solid rgba(255,255,255,.18); color:#fff; font-size: 18px; backdrop-filter: blur(10px); }

#outputsMount .out-meta{
  flex: 1 1 auto !important;
  display:flex !important;
  gap: 10px !important;
  align-items:flex-start !important;
  padding: 10px !important;
}
.out-title{ font-weight: 800; font-size: 12.5px; color: rgba(255,255,255,.95); white-space: nowrap; overflow:hidden; text-overflow: ellipsis; max-width: 100%; }
.out-sub{ margin-top: 3px; font-size: 11.5px; color: rgba(255,255,255,.70); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; max-width: 100%; }

#outputsMount .out-actions{
  margin-left:auto !important;
  display:flex !important;
  gap:6px !important;
  flex-wrap:wrap !important;
  justify-content:flex-end !important;
  row-gap:6px !important;
}
.out-btn{ display:inline-flex; align-items:center; justify-content:center; width: 30px; height: 30px; border-radius: 10px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.10); color: rgba(255,255,255,.92); cursor:pointer; user-select:none; }
.out-btn.is-disabled{ opacity:.45; pointer-events:none; }
.out-btn.is-danger{ background: rgba(239,68,68,.12); border-color: rgba(239,68,68,.22); }

.out-empty{ padding: 14px 6px; text-align:center; color: rgba(255,255,255,.70); font-size: 13px; }

#outputsMount{ position:relative !important; z-index: 9999 !important; }
#outputsMount .outputs-shell,
#outputsMount .outputs-viewport,
#outputsMount .out-grid,
#outputsMount .out-card{ position:relative !important; z-index: 9999 !important; }
#outputsMount .out-actions,
#outputsMount .out-btn{ position:relative !important; z-index: 10000 !important; pointer-events:auto !important; }
.right-panel, .right-card, #rightPanel, #right-panel{ position:relative !important; }
.right-panel *[data-legacy-hidden="1"]{ pointer-events:none !important; }
.right-panel .right-card::before,
.right-panel .right-card::after{ pointer-events:none !important; }
    `;
    document.head.appendChild(st);
  }

  function badgeText(s) {
    return s === "ready" ? "Hazır" : s === "error" ? "Hata" : "Sırada";
  }
  function badgeCls(s) {
    return s === "ready" ? "is-ready" : s === "error" ? "is-error" : "is-queued";
  }
  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ===== Audio Bar (top) =====
  function openAudioBar(item) {
    const a = document.getElementById("musicPlayer");
    const t = document.getElementById("musicNow");
    if (!a) return false;

    const src = item?.src || "";
    if (!src) return false;

    if (t) t.textContent = item.title || "Müzik";

    try {
      a.pause();
      a.removeAttribute("src");
      a.load();
    } catch {}

    a.src = src;

    try {
      const p = a.play?.();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch {}

    return true;
  }

  // ===== Preview Modal (fallback only) =====
  function ensureModal() {
    let m = document.getElementById("aivoPrev");
    if (m) return m;

    m = document.createElement("div");
    m.id = "aivoPrev";
    m.hidden = true;
    m.style.position = "fixed";
    m.style.inset = "0";
    m.style.zIndex = "999999";
    m.innerHTML = `
      <div data-close="1" style="position:absolute;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(10px);"></div>
      <div style="position:relative;max-width:820px;margin:6vh auto 0;border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,.10);background:rgba(12,14,24,.85);box-shadow:0 18px 60px rgba(0,0,0,.6);">
        <button data-close="1" style="position:absolute;top:10px;right:10px;z-index:2;width:38px;height:38px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;cursor:pointer;">✕</button>
        <div id="aivoPrevMedia" style="padding:18px;"></div>
      </div>
    `;
    document.body.appendChild(m);

    m.addEventListener("click", (e) => {
      if (e.target && e.target.dataset && e.target.dataset.close === "1") closePreview();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !m.hidden) closePreview();
    });

    return m;
  }

  function openPreview(item) {
    const m = ensureModal();
    const media = document.getElementById("aivoPrevMedia");
    if (!media) return;

    media.innerHTML = "";

    if (item.type === "audio") {
      const a = document.createElement("audio");
      a.controls = true;
      a.preload = "metadata";
      a.src = item.src || "";
      a.style.width = "100%";
      media.appendChild(a);
      setTimeout(() => {
        try {
          a.play();
        } catch {}
      }, 50);
    } else {
      const v = document.createElement("video");
      v.controls = true;
      v.playsInline = true;
      v.preload = "metadata";
      v.src = item.src || "";
      v.style.width = "100%";
      v.style.borderRadius = "14px";
      media.appendChild(v);
      setTimeout(() => {
        try {
          v.play();
        } catch {}
      }, 50);
    }

    m.hidden = false;
  }

  function closePreview() {
    const m = document.getElementById("aivoPrev");
    const media = document.getElementById("aivoPrevMedia");
    if (media) media.innerHTML = "";
    if (m) m.hidden = true;
  }

  // ✅ Audio kart içinde native <audio> göstermiyoruz
  function cardHTML(item) {
    const safeSrc = escapeHtml(item.src || "");
    const sub = item.sub || (item.type === "video" ? "MP4 çıktı" : "MP3/WAV çıktı");

    let thumb = "";
    if (!safeSrc) {
      thumb = `<div class="out-thumb out-thumb--empty">${item.status === "queued" ? "İşleniyor..." : "Dosya yok"}</div>`;
    } else if (item.type === "video") {
      thumb = `<video class="out-thumb" muted playsinline preload="metadata" src="${safeSrc}"></video>`;
    } else {
      thumb = `<div class="out-thumb out-thumb--audio">🎵</div>`;
    }

    const disabled = !safeSrc || item.status !== "ready" ? "is-disabled" : "";

    return `
      <div class="out-card" data-out-id="${escapeHtml(item.id)}" data-type="${escapeHtml(item.type)}">
        <div class="out-badge ${badgeCls(item.status)}">${escapeHtml(badgeText(item.status))}</div>
        ${thumb}
        ${item.type === "video" && safeSrc ? `<div class="out-play"><span>▶</span></div>` : ``}
        <div class="out-meta">
          <div style="min-width:0;flex:1;">
            <div class="out-title">${escapeHtml(item.title || "Çıktı")}</div>
            <div class="out-sub">${escapeHtml(sub)}</div>
          </div>
          <div class="out-actions">
            <button class="out-btn ${disabled}" data-action="open" title="Aç">⤢</button>
            <button class="out-btn ${disabled}" data-action="download" title="İndir">⤓</button>
            <button class="out-btn ${disabled}" data-action="share" title="Paylaş">↗</button>
            <button class="out-btn ${disabled}" data-action="copy" title="Link">⛓</button>
            <button class="out-btn is-danger" data-action="delete" title="Sil">🗑</button>
          </div>
        </div>
      </div>
    `;
  }

  // ===== Render =====
  function render() {
    ensureStyles();
    hideLegacyRightList();
    renamePanelTitleToOutputs();

    const mount = ensureMount();
    if (!mount) return;

    const cleaned = state.list.filter((x) => !(x?.src && DEMO_SRC_RE.test(String(x.src))));
    if (cleaned.length !== state.list.length) {
      state.list = cleaned;
      persist();
    }

    const videos = state.list.filter((x) => x.type === "video");
    const audios = state.list.filter((x) => x.type === "audio");

    const active = state.tab === "video" ? videos : audios;

    const q = (state.q || "").trim().toLowerCase();
    const filtered = q
      ? active.filter((x) => `${x.title || ""} ${x.sub || ""} ${badgeText(x.status)}`.toLowerCase().includes(q))
      : active;

    mount.innerHTML = `
      <div class="outputs-shell">
        <div class="outputs-tabs">
          <button class="outputs-tab ${state.tab === "video" ? "is-active" : ""}" data-tab="video">🎬 Video (${videos.length})</button>
          <button class="outputs-tab ${state.tab === "audio" ? "is-active" : ""}" data-tab="audio">🎵 Müzik (${audios.length})</button>
        </div>

        ${
          state.tab === "audio"
            ? `
              <div class="aivo-audio-player">
                <div class="aivo-audio-title" id="musicNow">Müzik seç</div>
                <audio id="musicPlayer" controls preload="metadata"></audio>
              </div>
            `
            : ``
        }

        <div class="outputs-toolbar">
          <div class="outputs-search">
            <span style="opacity:.8;font-size:14px;">⌕</span>
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

    $$("[data-tab]", mount).forEach((b) => {
      b.addEventListener("click", () => {
        state.tab = b.dataset.tab === "video" ? "video" : "audio";
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
  }

  // ===== Click Delegation (bind once) =====
  function bindOnce() {
    const mount = ensureMount();
    if (!mount || mount.__outBound) return;
    mount.__outBound = true;

    mount.addEventListener("click", async (e) => {
      const btn = e.target?.closest?.("[data-action]");
      const card = e.target?.closest?.("[data-out-id]");
      if (!card) return;

      const id = card.getAttribute("data-out-id");
      const item = state.list.find((x) => x.id === id);
      if (!item) return;

      const src = item.src || "";

      if (btn) {
        const action = btn.dataset.action;

        if (btn.classList.contains("is-disabled") && action !== "delete") {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        if (action === "delete") {
          const ok = confirm("Bu çıktıyı silmek istiyor musun?");
          if (!ok) return;
          state.list = state.list.filter((x) => x.id !== id);
          persist();
          render();
          return;
        }

        if (action === "open") {
          if (!src) return;
          if (item.type === "video") return openRightPanelVideo(src, item.title || "Video");
          // ✅ audio -> üstteki bar
          return openAudioBar(item);
        }

        if (action === "download") {
          if (!src) return;
          const a = document.createElement("a");
          a.href = src;
          a.download = "";
          document.body.appendChild(a);
          a.click();
          a.remove();
          return;
        }

        if (action === "copy") {
          if (!src) return;
          try {
            await navigator.clipboard.writeText(src);
          } catch {
            const ta = document.createElement("textarea");
            ta.value = src;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            ta.remove();
          }
          return;
        }

        if (action === "share") {
          if (!src) return;
          try {
            if (navigator.share) await navigator.share({ title: item.title || "AIVO Çıktı", url: src });
            else await navigator.clipboard.writeText(src);
          } catch {}
          return;
        }

        return;
      }

      // Kart tıklaması = open
      state.selectedId = id;
      $$(".out-card.is-selected", mount).forEach((n) => n.classList.remove("is-selected"));
      card.classList.add("is-selected");

      if (!src) return;
      if (item.type === "video") return openRightPanelVideo(src, item.title || "Video");
      // ✅ audio -> üstteki bar
      return openAudioBar(item);
    });
  }

  // ===== Public API =====
  window.AIVO_OUTPUTS = {
    add(payload) {
      const it = toUnified(payload || {});
      if (!it) return null;

      state.list.unshift(it);
      state.list = uniqById(state.list)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, 120);

      persist();
      render();
      return it.id;
    },

    patch(id, patch) {
      const idx = state.list.findIndex((x) => x.id === id);
      if (idx === -1) return false;

      const incoming = toUnified(Object.assign({ id }, patch || {}));
      if (!incoming) return false;

      const merged = Object.assign({}, state.list[idx], incoming);
      merged.id = id;

      state.list[idx] = merged;
      persist();
      render();
      return true;
    },

    openTab(tab) {
      const t = String(tab || "").toLowerCase();
      state.tab = t === "video" ? "video" : "audio";
      render();
    },

    list() {
      return state.list.slice();
    },

    openVideo(src, title) {
      return openRightPanelVideo(src, title || "Video");
    },

    closeVideo() {
      closeRightPanelVideo();
    },

    open(id) {
      try {
        const item = (state.list || []).find((o) => o && o.id === id);
        if (!item) return false;
        const src = item.src || item.url || "";
        if (!src) return false;

        if (item.type === "video") return openRightPanelVideo(src, item.title || "Video");
        // ✅ audio -> bar
        return openAudioBar(item);
      } catch {
        return false;
      }
    },

    reload() {
      state.list = migrateIfNeeded();
      state.tab = defaultTabForPageKey(detectPageKey());
      render();
      return state.list.length;
    },
  };

  /* AUTO TAB ROUTER (Observer yok) */
  (function attachOutputsAutoTabRouter() {
    let lastKey = "";

    function applyTabFromPage() {
      try {
        const key = detectPageKey();
        if (!key || key === lastKey) return;
        lastKey = key;

        const wanted = defaultTabForPageKey(key);
        if (wanted && wanted !== state.tab) {
          state.tab = wanted;
          state.q = "";
          closeRightPanelVideo?.();
          render();
        }
      } catch {}
    }

    const _ps = history.pushState;
    history.pushState = function () {
      _ps.apply(this, arguments);
      setTimeout(applyTabFromPage, 0);
    };

    const _rs = history.replaceState;
    history.replaceState = function () {
      _rs.apply(this, arguments);
      setTimeout(applyTabFromPage, 0);
    };

    window.addEventListener("popstate", () => setTimeout(applyTabFromPage, 0));

    document.addEventListener(
      "click",
      (e) => {
        const hit = e.target && e.target.closest && e.target.closest("a,[data-page],[data-to],[data-tab]");
        if (hit) setTimeout(applyTabFromPage, 0);
      },
      true
    );

    setTimeout(applyTabFromPage, 0);
  })();

  // ===== Boot =====
  state.tab = defaultTabForPageKey(detectPageKey());
  bindOnce();
  render();

  // Right panel DOM geç gelirse: kısa retry
  setTimeout(() => {
    try {
      render();
    } catch {}
  }, 250);
  setTimeout(() => {
    try {
      render();
    } catch {}
  }, 1000);
  setTimeout(() => {
    try {
      render();
    } catch {}
  }, 2500);
})();
