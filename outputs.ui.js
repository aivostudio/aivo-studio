(function () {
  const $ = (q, root = document) => root.querySelector(q);

  // ✅ Tek otorite KEY
  const KEY = "AIVO_OUTPUT_VIDEOS_V1";

  // ✅ Eski key’lerden okuma (sadece migrate için)
  const LEGACY_KEYS = ["AIVO_OUTPUTS_V1", "AIVO_OUTPUTS", "AIVO_OUTPUTS_V0"];

  function safeParse(v, fb) {
    try { return JSON.parse(v || fb); } catch { return JSON.parse(fb); }
  }

  // ✅ normalize: type uyumsuzluklarını düzelt
  function normalizeItem(x) {
    const it = Object.assign({}, x || {});
    const rawType = (it.type || it.kind || it.media || "").toString().toLowerCase().trim();

    let t = rawType;
    if (!t) t = "video";
    if (t === "mp4" || t === "vid" || t === "movie") t = "video";
    if (t === "mp3" || t === "wav" || t === "audio") t = "audio";
    if (t === "png" || t === "jpg" || t === "jpeg" || t === "image") t = "image";
    if (t === "video" || t === "audio" || t === "image") it.type = t;
    else it.type = "video";

    it.id = it.id || ("out-" + Math.random().toString(16).slice(2) + "-" + Date.now());
    it.title = it.title || it.name || "Çıktı";
    it.sub = it.sub || it.desc || "";
    it.src = it.src || it.url || "";
    it.status = it.status || it.state || "queued";
    it.createdAt = it.createdAt || Date.now();

    return it;
  }

  function load() {
    // 1) yeni KEY
    const main = safeParse(localStorage.getItem(KEY), "[]");
    let list = Array.isArray(main) ? main : [];

    // 2) legacy migrate (ekle-birleştir)
    if (!list.length) {
      for (const k of LEGACY_KEYS) {
        const v = safeParse(localStorage.getItem(k), "[]");
        if (Array.isArray(v) && v.length) { list = v; break; }
      }
    }

    return (list || []).map(normalizeItem);
  }

  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify((list || []).slice(0, 80))); } catch {}
  }

  const state = {
    list: load(),
    tab: "video",
    q: "",
    selectedId: ""
  };

  // ========= RIGHT-PANEL MP4 PLAYER (TEK OTORİTE) =========
  function openRightPanelVideo(src, title = "Video") {
    const wrap = document.getElementById("rpPlayer");
    const vid  = document.getElementById("rpVideo");
    const ttl  = document.getElementById("rpVideoTitle");
    if (!wrap || !vid) return;

    if (ttl) ttl.textContent = title;
    vid.src = src || "";
    wrap.hidden = false;
    vid.play?.().catch(() => {});
  }

  document.getElementById("rpPlayerClose")?.addEventListener("click", () => {
    const wrap = document.getElementById("rpPlayer");
    const vid  = document.getElementById("rpVideo");
    if (vid) { vid.pause(); vid.removeAttribute("src"); vid.load(); }
    if (wrap) wrap.hidden = true;
  });

  // ========= Ensure Right Panel Mount =========
  function ensureMount() {
    let mount = document.getElementById("outputsMount");
    if (mount) return mount;

    const rightCard = $(".right-panel .right-card");
    if (!rightCard) return null;

    mount = document.createElement("div");
    mount.id = "outputsMount";

    const hdr = rightCard.querySelector(".card-header");
    if (hdr && hdr.nextSibling) rightCard.insertBefore(mount, hdr.nextSibling);
    else rightCard.appendChild(mount);

    return mount;
  }

  // ========= Hide legacy right-list (temporary) =========
  function hideLegacyRightList() {
    const rightCard = $(".right-panel .right-card");
    if (!rightCard) return;
    rightCard.querySelectorAll(":scope > .right-list").forEach((el) => {
      el.style.display = "none";
    });
  }

  // ========= Styles (inject once) =========
  function ensureStyles() {
    if (document.getElementById("outputsUIStyles")) return;
    const st = document.createElement("style");
    st.id = "outputsUIStyles";
    st.textContent = `
#outputsMount{ margin-top: 10px; width:100%; min-width:0; }
.outputs-shell{ border-radius:18px; overflow:hidden; background:rgba(12,14,24,.55); border:1px solid rgba(255,255,255,.08); box-shadow:0 10px 40px rgba(0,0,0,.35); }
.outputs-tabs{ display:flex; gap:8px; padding:10px 12px 12px; border-bottom:1px solid rgba(255,255,255,.07); background:linear-gradient(to bottom, rgba(22,16,40,.72), rgba(12,14,24,.55)); backdrop-filter:blur(10px); }
.outputs-tab{ flex:1; height:36px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.05); color:rgba(255,255,255,.82); cursor:pointer; font-size:13px; white-space:nowrap; }
.outputs-tab.is-active{ background:linear-gradient(90deg, rgba(128,88,255,.25), rgba(255,107,180,.18)); border-color:rgba(167,139,255,.25); color:#fff; }

.outputs-toolbar{ position:sticky; top:0; z-index:3; padding:10px 12px 12px; background:linear-gradient(to bottom, rgba(12,14,24,.92), rgba(12,14,24,.55)); border-bottom:1px solid rgba(255,255,255,.07); backdrop-filter:blur(10px); }
.outputs-search{ display:flex; align-items:center; gap:8px; height:40px; padding:0 12px; border-radius:12px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.09); }
.os-ico{ opacity:.8; font-size:14px; }
.os-input{ flex:1; border:0; outline:0; background:transparent; color:#fff; font-size:13px; min-width:0; }
.os-input::placeholder{ color:rgba(255,255,255,.55); }
.os-clear{ border:0; background:rgba(255,255,255,.08); color:#fff; height:26px; width:30px; border-radius:10px; cursor:pointer; }

.outputs-viewport{ max-height:58vh; overflow:auto; padding:12px; }
.outputs-viewport::-webkit-scrollbar{ width:10px; }
.outputs-viewport::-webkit-scrollbar-thumb{ background:rgba(255,255,255,.12); border-radius:999px; }
.outputs-viewport::-webkit-scrollbar-track{ background:rgba(255,255,255,.04); }

.out-grid{ display:grid; grid-template-columns:1fr; gap:12px; }
.out-card{ position:relative; border-radius:16px; overflow:hidden; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.04); box-shadow:0 10px 30px rgba(0,0,0,.28); cursor:pointer; transform:translateY(0); transition:transform .15s ease, border-color .15s ease, box-shadow .15s ease; }
.out-card:hover{ transform:translateY(-2px); border-color:rgba(170,140,255,.25); box-shadow:0 16px 42px rgba(0,0,0,.36); }
.out-card.is-selected{ border-color:rgba(255,107,180,.35); box-shadow:0 18px 50px rgba(0,0,0,.40); }

.out-thumb{ width:100%; height:160px; display:block; object-fit:cover; background:rgba(0,0,0,.35); }
.out-thumb--audio{ display:flex; align-items:center; justify-content:center; font-size:34px; height:140px; color:rgba(255,255,255,.9); background:radial-gradient(circle at 30% 20%, rgba(128,88,255,.22), rgba(0,0,0,.45)); }

.out-badge{ position:absolute; top:10px; left:10px; z-index:2; font-size:12px; padding:6px 10px; border-radius:999px; background:rgba(0,0,0,.45); border:1px solid rgba(255,255,255,.10); color:rgba(255,255,255,.9); backdrop-filter:blur(8px); }
.out-badge.is-ready{ background:rgba(16,185,129,.18); border-color:rgba(16,185,129,.28); }
.out-badge.is-queued{ background:rgba(99,102,241,.16); border-color:rgba(99,102,241,.28); }
.out-badge.is-error{ background:rgba(239,68,68,.14); border-color:rgba(239,68,68,.25); }

.out-play{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; z-index:1; background:radial-gradient(circle at 50% 50%, rgba(0,0,0,.08), rgba(0,0,0,.55)); opacity:0; transition:opacity .15s ease; }
.out-card:hover .out-play{ opacity:1; }
.out-play span{ width:54px; height:54px; display:flex; align-items:center; justify-content:center; border-radius:999px; background:rgba(255,255,255,.10); border:1px solid rgba(255,255,255,.18); color:#fff; font-size:20px; backdrop-filter:blur(10px); }

.out-meta{ display:flex; gap:10px; align-items:flex-start; padding:12px; }
.out-title{ font-weight:700; font-size:13px; color:rgba(255,255,255,.95); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.out-sub{ margin-top:4px; font-size:12px; color:rgba(255,255,255,.70); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.out-actions{ margin-left:auto; display:flex; gap:8px; }
.out-btn{ display:inline-flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:12px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.10); color:rgba(255,255,255,.92); text-decoration:none; }
.out-btn:hover{ border-color:rgba(170,140,255,.25); background:rgba(255,255,255,.08); }

.out-empty{ padding:14px 6px; text-align:center; color:rgba(255,255,255,.70); font-size:13px; }
    `;
    document.head.appendChild(st);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function cardHTML(item) {
    const badgeText = item.status === "ready" ? "Hazır" : item.status === "error" ? "Hata" : "Sırada";
    const badgeCls  = item.status === "ready" ? "is-ready" : item.status === "error" ? "is-error" : "is-queued";
    const sub = item.sub || (item.type==="video" ? "MP4 çıktı" : item.type==="audio" ? "MP3/WAV çıktı" : "PNG/JPG çıktı");
    const safeSrc = escapeHtml(item.src || "");

    const thumb =
      item.type === "video"
        ? `<video class="out-thumb" muted playsinline preload="metadata" src="${safeSrc}"></video>`
        : item.type === "audio"
          ? `<div class="out-thumb out-thumb--audio">♪</div>`
          : `<img class="out-thumb" alt="" src="${safeSrc}" />`;

    return `
      <div class="out-card ${state.selectedId===item.id ? "is-selected":""}" data-out-id="${escapeHtml(item.id)}">
        <div class="out-badge ${badgeCls}">${escapeHtml(badgeText)}</div>
        ${thumb}
        ${item.type === "video" ? `<div class="out-play"><span>▶</span></div>` : ``}
        <div class="out-meta">
          <div style="min-width:0;flex:1;">
            <div class="out-title">${escapeHtml(item.title || "Çıktı")}</div>
            <div class="out-sub">${escapeHtml(sub)}</div>
          </div>
          <div class="out-actions">
            <a class="out-btn" href="${safeSrc || "#"}" download title="İndir">⤓</a>
          </div>
        </div>
      </div>
    `;
  }

  // ========= PREVIEW MODAL (audio / image) =========
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
          <a id="aivoPrevDl" href="#" download style="text-decoration:none;display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 14px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);color:#fff;">İndir ⤓</a>
        </div>
      </div>
    `;
    document.body.appendChild(m);

    m.addEventListener("click", (e) => { if (e.target?.dataset?.close === "1") closePreview(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !m.hidden) closePreview(); });

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

  // ========= Render =========
  function render() {
    ensureStyles();
    hideLegacyRightList();

    // ✅ her render’da normalize + persist
    state.list = (state.list || []).map(normalizeItem);
    save(state.list);

    const mount = ensureMount();
    if (!mount) return;

    const videos = state.list.filter((x) => x.type === "video");
    const audios = state.list.filter((x) => x.type === "audio");
    const images = state.list.filter((x) => x.type === "image");

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
          <button class="outputs-tab ${state.tab==="video"?"is-active":""}" data-tab="video">🎬 Video (${videos.length})</button>
          <button class="outputs-tab ${state.tab==="audio"?"is-active":""}" data-tab="audio">🎵 Müzik (${audios.length})</button>
          <button class="outputs-tab ${state.tab==="image"?"is-active":""}" data-tab="image">🖼 Görsel (${images.length})</button>
        </div>

        <div class="outputs-toolbar">
          <div class="outputs-search">
            <span class="os-ico">⌕</span>
            <input class="os-input" id="outSearch" placeholder="Ara: başlık, durum..." autocomplete="off" />
            <button class="os-clear" id="outSearchClear" type="button" title="Temizle">✕</button>
          </div>
        </div>

        <div class="outputs-viewport">
          ${filtered.length ? `<div class="out-grid">${filtered.map(cardHTML).join("")}</div>` : `<div class="out-empty">Henüz çıktı yok.</div>`}
        </div>
      </div>
    `;

    const inp = mount.querySelector("#outSearch");
    const clr = mount.querySelector("#outSearchClear");
    if (inp) inp.value = state.q || "";

    mount.querySelectorAll("[data-tab]").forEach((b) => {
      b.addEventListener("click", () => { state.tab = b.dataset.tab; render(); });
    });

    inp?.addEventListener("input", () => { state.q = inp.value || ""; render(); });
    clr?.addEventListener("click", () => { state.q = ""; render(); });

    mount.querySelectorAll("[data-out-id]").forEach((el) => {
      el.addEventListener("click", (e) => {
        const id = el.dataset.outId;
        const item = state.list.find((x) => x.id === id);
        if (!item) return;
        if (e.target && e.target.closest && e.target.closest(".out-btn")) return;

        state.selectedId = id;
        render(); // selected state update

        if (item.type === "video") { openRightPanelVideo(item.src, item.title || "Video"); return; }
        openPreview(item);
      });
    });
  }

  // ========= Public API =========
  window.AIVO_OUTPUTS = {
    add(item) {
      const it = normalizeItem(Object.assign({ status:"queued", createdAt:Date.now() }, item || {}));
      state.list.unshift(it);
      save(state.list);
      render();
      return it.id;
    },
    patch(id, patch) {
      const i = state.list.findIndex((x) => x.id === id);
      if (i === -1) return false;
      state.list[i] = normalizeItem(Object.assign({}, state.list[i], patch || {}));
      save(state.list);
      render();
      return true;
    },
    openTab(tab) { state.tab = tab || "video"; render(); },
    list() { return state.list.slice(); },
  };

  render();
})();
