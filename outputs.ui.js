/* outputs.ui.js — TEK OTORİTE OUTPUTS + TEK MP4 PLAYER (Right Panel)
   - Source of truth: localStorage["AIVO_OUTPUTS_V1"]
   - Legacy migrate (tek sefer): AIVO_OUTPUT_VIDEOS_V1 / AIVO_OUTPUT_VIDEOS_V1 / AIVO_OUTPUTS_V1
   - Video click => right panel mp4 player (#rpPlayer/#rpVideo)
*/
(function () {
  "use strict";

  // =========================
  // DOM helpers
  // =========================
  const $ = (q, root = document) => root.querySelector(q);
  const $$ = (q, root = document) => Array.from(root.querySelectorAll(q));

  // =========================
  // Storage keys (FINAL)
  // =========================
  const KEY_UNIFIED = "AIVO_OUTPUTS_V1";

  // Legacy keys you already have in Safari console
  const LEGACY_KEYS = [
    "AIVO_OUTPUT_VIDEOS_V1",
    "AIVO_OUTPUT_VIDEOS_V1",
    // some builds used this already but with legacy schema; we still normalize it
    "AIVO_OUTPUTS_V1",
  ];

  // =========================
  // Safe JSON
  // =========================
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

  // =========================
  // Normalization (legacy -> unified item)
  // Unified schema:
  // { id, type: "video"|"audio"|"image", title, sub, src, status:"queued"|"ready"|"error", createdAt }
  // =========================
  function toUnified(item) {
    if (!item || typeof item !== "object") return null;

    // legacy variants
    const id =
      item.id ||
      item.job_id ||
      item.output_id ||
      ("out-" + Math.random().toString(16).slice(2) + "-" + Date.now());

    // type inference
    let type = item.type;
    if (!type) {
      if (item.kind) type = item.kind;
      else if (item.mediaType) type = item.mediaType;
    }
    if (!type) {
      // legacy "videos list" items sometimes had only title/badge
      type = "video";
    }
    type = String(type).toLowerCase();
    if (type.includes("vid")) type = "video";
    else if (type.includes("aud") || type.includes("music")) type = "audio";
    else if (type.includes("img") || type.includes("cover") || type.includes("image")) type = "image";
    else type = "video";

    // title/sub
    const title =
      item.title ||
      item.name ||
      item.label ||
      (type === "video" ? "Video" : type === "audio" ? "Müzik" : "Görsel");

    const sub =
      item.sub ||
      item.subtitle ||
      item.desc ||
      item.badge || // legacy used badge like "Sırada"
      "";

    // src (IMPORTANT: can be empty while "işleniyor")
    const src =
      item.src ||
      item.url ||
      item.downloadUrl ||
      item.fileUrl ||
      item.output_url ||
      "";

    // status mapping
    let status = item.status;
    if (!status) {
      // legacy: badge: "Sırada" | "Hazır" | "Hata"
      const b = (item.badge || item.state || "").toString().toLowerCase();
      if (b.includes("haz")) status = "ready";
      else if (b.includes("hat") || b.includes("err")) status = "error";
      else if (b.includes("sır") || b.includes("sir") || b.includes("que") || b.includes("işlen")) status = "queued";
    }
    status = (status || "queued").toString().toLowerCase();
    if (status === "ok") status = "ready";
    if (status === "done") status = "ready";
    if (status === "processing") status = "queued";
    if (status === "pending") status = "queued";
    if (status === "fail") status = "error";
    if (!["queued", "ready", "error"].includes(status)) status = "queued";

    // createdAt
    const createdAt =
      Number(item.createdAt) ||
      Number(item.created_at) ||
      Number(item.ts) ||
      Number(item.time) ||
      Date.now();

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

  // =========================
  // MIGRATE (tek sefer, güvenli)
  // =========================
  function migrateIfNeeded() {
    const unifiedRaw = readLS(KEY_UNIFIED);
    const unifiedIsArray = Array.isArray(unifiedRaw);
    const unifiedList = unifiedIsArray ? unifiedRaw.map(toUnified).filter(Boolean) : [];

    // Collect legacy arrays
    const legacyCollected = [];
    for (const k of LEGACY_KEYS) {
      const v = readLS(k);
      if (Array.isArray(v)) legacyCollected.push(...v);
    }

    // If nothing legacy, just normalize unified and save back
    if (!legacyCollected.length) {
      const normalized = uniqById(unifiedList)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, 120);
      // only write if needed (avoid extra churn)
      if (!unifiedIsArray || normalized.length !== unifiedList.length) writeLS(KEY_UNIFIED, normalized);
      return normalized;
    }

    // Merge: legacy + unified (both normalized), then save to unified
    const merged = uniqById([
      ...legacyCollected.map(toUnified).filter(Boolean),
      ...unifiedList,
    ])
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 120);

    writeLS(KEY_UNIFIED, merged);

    // IMPORTANT: do NOT delete legacy keys automatically (risk).
    // But we stop reading them after this write; keeping them is harmless.

    return merged;
  }

  // =========================
  // State
  // =========================
  const state = {
    list: migrateIfNeeded(), // unified list
    tab: "video",            // video | audio | image
    q: "",
  };

  function persist() {
    writeLS(KEY_UNIFIED, state.list.slice(0, 120));
  }

  // =========================
  // Right Panel MP4 Player (TEK OTORİTE)
  // Expected DOM:
  //   #rpPlayer (wrap) + #rpVideo (video) + #rpVideoTitle (optional) + #rpPlayerClose (button)
  // =========================
  function openRightPanelVideo(src, title = "Video") {
    const wrap = document.getElementById("rpPlayer");
    const vid = document.getElementById("rpVideo");
    const ttl = document.getElementById("rpVideoTitle");

    if (!wrap || !vid) return;

    if (ttl) ttl.textContent = title;

    // Reset then set (Safari picky)
    try {
      vid.pause();
      vid.removeAttribute("src");
      vid.load();
    } catch {}

    vid.src = src || "";
    wrap.hidden = false;

    // autoplay best-effort
    try {
      const p = vid.play?.();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch {}
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
    if (wrap) wrap.hidden = true;
  }

  document.getElementById("rpPlayerClose")?.addEventListener("click", closeRightPanelVideo);

  // =========================
  // Mount (RIGHT CARD)
  // =========================
  function ensureMount() {
    let mount = document.getElementById("outputsMount");
    if (mount) return mount;

    const rightCard = $(".right-panel .right-card") || $(".right-panel .card.right-card") || $(".right-panel");
    if (!rightCard) return null;

    mount = document.createElement("div");
    mount.id = "outputsMount";

    // Put after header if exists, else append
    const hdr = rightCard.querySelector(".card-header");
    if (hdr && hdr.nextSibling) rightCard.insertBefore(mount, hdr.nextSibling);
    else rightCard.appendChild(mount);

    return mount;
  }

  // optional: hide old legacy list container if any
  function hideLegacyRightList() {
    const rightCard = $(".right-panel .right-card") || $(".right-panel .card.right-card");
    if (!rightCard) return;
    $$(":scope > .right-list", rightCard).forEach((el) => (el.style.display = "none"));
  }

  // =========================
  // Styles (inject once)
  // =========================
  function ensureStyles() {
    if (document.getElementById("outputsUIStyles")) return;
    const st = document.createElement("style");
    st.id = "outputsUIStyles";
    st.textContent = `
/* --- OUTPUTS UI --- */
#outputsMount { margin-top: 10px; min-width: 0; }
.outputs-shell{
  border-radius: 18px;
  overflow: hidden;
  background: rgba(12,14,24,.55);
  border: 1px solid rgba(255,255,255,.08);
  box-shadow: 0 10px 40px rgba(0,0,0,.35);
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
  height: 40px;
  padding: 0 12px;
  border-radius: 12px;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.09);
}
.os-ico{ opacity:.8; font-size: 14px; }
.os-input{
  flex:1;
  border:0; outline:0;
  background:transparent;
  color:#fff;
  font-size: 13px;
  min-width: 0;
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
  overflow: auto;
  padding: 12px;
}
.outputs-viewport::-webkit-scrollbar{ width: 10px; }
.outputs-viewport::-webkit-scrollbar-thumb{ background: rgba(255,255,255,.12); border-radius: 999px; }
.outputs-viewport::-webkit-scrollbar-track{ background: rgba(255,255,255,.04); }
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
  font-size: 34px;
  height: 140px;
  color: rgba(255,255,255,.9);
  background: radial-gradient(circle at 30% 20%, rgba(128,88,255,.22), rgba(0,0,0,.45));
}
.out-thumb--empty{
  display:flex; align-items:center; justify-content:center;
  font-size: 12px;
  height: 140px;
  color: rgba(255,255,255,.65);
  background: rgba(0,0,0,.28);
}
.out-badge{
  position:absolute;
  top: 10px; left: 10px;
  z-index: 2;
  font-size: 12px;
  padding: 6px 10px;
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
  color:#fff;
  font-size: 20px;
  backdrop-filter: blur(10px);
}
.out-meta{
  display:flex; gap: 10px;
  align-items:flex-start;
  padding: 12px;
}
.out-title{
  font-weight: 700;
  font-size: 13px;
  color: rgba(255,255,255,.95);
  white-space: nowrap;
  overflow:hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.out-sub{
  margin-top: 4px;
  font-size: 12px;
  color: rgba(255,255,255,.70);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  max-width: 100%;
}
.out-actions{ margin-left:auto; display:flex; gap:8px; }
.out-btn{
  display:inline-flex;
  align-items:center; justify-content:center;
  width: 34px; height: 34px;
  border-radius: 12px;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.10);
  color: rgba(255,255,255,.92);
  text-decoration:none;
}
.out-btn.is-disabled{
  opacity:.45;
  pointer-events:none;
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
  // UI rendering
  // =========================
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

  function cardHTML(item) {
    const safeSrc = escapeHtml(item.src || "");
    const sub =
      item.sub ||
      (item.type === "video" ? "MP4 çıktı" : item.type === "audio" ? "MP3/WAV çıktı" : "PNG/JPG çıktı");

    let thumb = "";
    if (!safeSrc) {
      thumb = `<div class="out-thumb out-thumb--empty">${item.status === "queued" ? "İşleniyor..." : "Dosya yok"}</div>`;
    } else if (item.type === "video") {
      thumb = `<video class="out-thumb" muted playsinline preload="metadata" src="${safeSrc}"></video>`;
    } else if (item.type === "audio") {
      thumb = `<div class="out-thumb out-thumb--audio">♪</div>`;
    } else {
      thumb = `<img class="out-thumb" alt="" src="${safeSrc}" />`;
    }

    const dlDisabled = !safeSrc ? "is-disabled" : "";

    return `
      <div class="out-card" data-out-id="${escapeHtml(item.id)}">
        <div class="out-badge ${badgeCls(item.status)}">${escapeHtml(badgeText(item.status))}</div>
        ${thumb}
        ${item.type === "video" && safeSrc ? `<div class="out-play"><span>▶</span></div>` : ``}
        <div class="out-meta">
          <div style="min-width:0;flex:1;">
            <div class="out-title">${escapeHtml(item.title || "Çıktı")}</div>
            <div class="out-sub">${escapeHtml(sub)}</div>
          </div>
          <div class="out-actions">
            <a class="out-btn ${dlDisabled}" href="${safeSrc || "#"}" ${safeSrc ? "download" : ""} title="İndir">⤓</a>
          </div>
        </div>
      </div>
    `;
  }

  // =========================
  // Preview Modal (audio/image)
  // =========================
  function ensureModal() {
    let m = document.getElementById("aivoPrev");
    if (m) return m;

    m = document.createElement("div");
    m.id = "aivoPrev";
    m.hidden = true;
    m.style.position = "fixed";
    m.style.inset = "0";
    m.style.zIndex = "9999";
    m.innerHTML = `
      <div data-close="1" style="position:absolute;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(10px);"></div>
      <div style="position:relative;max-width:820px;margin:6vh auto 0;border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,.10);background:rgba(12,14,24,.85);box-shadow:0 18px 60px rgba(0,0,0,.6);">
        <button data-close="1" style="position:absolute;top:10px;right:10px;z-index:2;width:38px;height:38px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;cursor:pointer;">✕</button>
        <div id="aivoPrevMedia" style="padding:18px;"></div>
        <div style="display:flex;gap:12px;align-items:center;justify-content:space-between;padding:14px 18px;border-top:1px solid rgba(255,255,255,.08);">
          <div id="aivoPrevTitle" style="font-weight:800;color:#fff;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Çıktı</div>
          <a id="aivoPrevDl" href="#" download
             style="text-decoration:none;display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 14px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);color:#fff;">İndir ⤓</a>
        </div>
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
    const title = document.getElementById("aivoPrevTitle");
    const dl = document.getElementById("aivoPrevDl");
    if (!media || !title || !dl) return;

    title.textContent = item.title || "Çıktı";
    dl.href = item.src || "#";
    media.innerHTML = "";

    if (item.type === "audio") {
      const a = document.createElement("audio");
      a.controls = true;
      a.preload = "metadata";
      a.src = item.src || "";
      a.style.width = "100%";
      media.appendChild(a);
      setTimeout(() => { try { a.play(); } catch {} }, 50);
    } else {
      const img = document.createElement("img");
      img.style.width = "100%";
      img.style.borderRadius = "14px";
      img.src = item.src || "";
      media.appendChild(img);
    }

    m.hidden = false;
  }

  function closePreview() {
    const m = document.getElementById("aivoPrev");
    const media = document.getElementById("aivoPrevMedia");
    if (media) media.innerHTML = "";
    if (m) m.hidden = true;
  }

  // =========================
  // Render
  // =========================
  function render() {
    ensureStyles();
    hideLegacyRightList();

    const mount = ensureMount();
    if (!mount) return;

    const videos = state.list.filter((x) => x.type === "video");
    const audios = state.list.filter((x) => x.type === "audio");
    const images = state.list.filter((x) => x.type === "image");

    const active = state.tab === "video" ? videos : state.tab === "audio" ? audios : images;

    const q = (state.q || "").trim().toLowerCase();
    const filtered = q
      ? active.filter((x) => {
          const hay = `${x.title || ""} ${x.sub || ""} ${badgeText(x.status)}`.toLowerCase();
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

    // tabs
    $$("[data-tab]", mount).forEach((b) => {
      b.addEventListener("click", () => {
        state.tab = b.dataset.tab;
        render();
      });
    });

    // search
    inp?.addEventListener("input", () => {
      state.q = inp.value || "";
      render();
    });
    clr?.addEventListener("click", () => {
      state.q = "";
      render();
    });

    // card click
    $$("[data-out-id]", mount).forEach((el) => {
      el.addEventListener("click", (e) => {
        // if download button clicked => don't open
        if (e.target && e.target.closest && e.target.closest(".out-btn")) return;

        const id = el.dataset.outId;
        const item = state.list.find((x) => x.id === id);
        if (!item) return;

        // selected state
        $$(".out-card.is-selected", mount).forEach((n) => n.classList.remove("is-selected"));
        el.classList.add("is-selected");

        // IMPORTANT:
        // - Video uses right panel player (single MP4 player for whole page)
        // - Audio/Image uses preview
        if (item.type === "video") {
          if (!item.src) return; // still processing; no src yet
          openRightPanelVideo(item.src, item.title || "Video");
          return;
        }

        if (!item.src) return;
        openPreview(item);
      });
    });
  }

  // =========================
  // Public API (tek otorite)
  // =========================
  window.AIVO_OUTPUTS = {
    add(payload) {
      const it = toUnified(payload || {});
      if (!it) return null;

      // newest first
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

      const merged = Object.assign({}, state.list[idx], toUnified(Object.assign({ id }, patch || {})) || {});
      // ensure id preserved
      merged.id = id;

      state.list[idx] = merged;
      persist();
      render();
      return true;
    },
    openTab(tab) {
      const t = (tab || "video").toString().toLowerCase();
      state.tab = t === "audio" || t === "image" ? t : "video";
      render();
    },
    list() {
      return state.list.slice();
    },
    openVideo(src, title) {
      openRightPanelVideo(src, title || "Video");
    },
    closeVideo() {
      closeRightPanelVideo();
    },
    reload() {
      state.list = migrateIfNeeded();
      render();
      return state.list.length;
    }
  };

  // =========================
  // Boot
  // =========================
  render();

  // ensure tab open after DOM ready (Safari timing)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(() => window.AIVO_OUTPUTS.openTab("video"), 30));
  } else {
    setTimeout(() => window.AIVO_OUTPUTS.openTab("video"), 30);
  }
})();
