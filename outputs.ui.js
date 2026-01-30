(function () {
  // ========= DOM helpers =========
  const $ = (q, root=document) => root.querySelector(q);

  // ========= Storage =========
  const KEY = "AIVO_OUTPUTS_V1";
  function load() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch { return []; }
  }
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 40))); } catch {}
  }

  // ========= State =========
  const state = {
    list: load(),          // {id,type,title,sub,src,createdAt,status}
    tab: "video",          // "video" | "audio" | "image"
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

    vid.play?.().catch(()=>{});
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
    rightCard.appendChild(mount);
    return mount;
  }

  // ========= Render =========
  function render() {
    const mount = ensureMount();
    if (!mount) return;

    const videos = state.list.filter(x => x.type === "video");
    const audios = state.list.filter(x => x.type === "audio");
    const images = state.list.filter(x => x.type === "image");

    const active =
      state.tab === "video" ? videos :
      state.tab === "audio" ? audios : images;

    mount.innerHTML = `
      <div class="outputs-tabs">
        <button class="outputs-tab ${state.tab==="video" ? "is-active":""}" data-tab="video">🎬 Video (${videos.length})</button>
        <button class="outputs-tab ${state.tab==="audio" ? "is-active":""}" data-tab="audio">🎵 Müzik (${audios.length})</button>
        <button class="outputs-tab ${state.tab==="image" ? "is-active":""}" data-tab="image">🖼 Görsel (${images.length})</button>
      </div>

      ${active.length ? `
        <div class="out-grid">
          ${active.map(cardHTML).join("")}
        </div>
      ` : `
        <div class="out-empty">Henüz çıktı yok.</div>
      `}
    `;

    // Tabs
    mount.querySelectorAll("[data-tab]").forEach(b => {
      b.addEventListener("click", () => {
        state.tab = b.dataset.tab;
        render();
      });
    });

    // Card click
    mount.querySelectorAll("[data-out-id]").forEach(el => {
      el.addEventListener("click", (e) => {
        const id = el.dataset.outId;
        const item = state.list.find(x => x.id === id);
        if (!item) return;

        // download butonuna basıldıysa açma
        if (e.target && e.target.closest && e.target.closest(".out-btn")) return;

        // VIDEO → right-panel sticky player
        if (item.type === "video") {
          openRightPanelVideo(item.src, item.title || "Video");
          return;
        }

        // AUDIO / IMAGE → preview modal
        openPreview(item);
      });
    });
  }

  function cardHTML(item) {
    const badge =
      item.status === "ready" ? "Hazır" :
      item.status === "error" ? "Hata" : "Sırada";

    const sub =
      item.sub ||
      (item.type === "video" ? "MP4 çıktı" :
       item.type === "audio" ? "MP3/WAV çıktı" : "PNG/JPG çıktı");

    const thumb =
      item.type === "video"
        ? `<video class="out-thumb" muted playsinline preload="metadata" src="${item.src || ""}"></video>`
        : item.type === "audio"
          ? `<div class="out-thumb" style="display:flex;align-items:center;justify-content:center;font-size:26px;">♪</div>`
          : `<img class="out-thumb" alt="" src="${item.src || ""}"/>`;

    return `
      <div class="out-card" data-out-id="${escapeHtml(item.id)}">
        <div class="out-badge">${escapeHtml(badge)}</div>
        ${thumb}
        ${item.type==="video" ? `<div class="out-play"><span>▶</span></div>` : ``}
        <div class="out-meta">
          <div style="min-width:0">
            <div class="out-title">${escapeHtml(item.title || "Çıktı")}</div>
            <div class="out-sub">${escapeHtml(sub)}</div>
          </div>
          <div class="out-actions">
            <a class="out-btn" href="${item.src || "#"}" download title="İndir">⤓</a>
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
    m.className = "aivo-prev";
    m.id = "aivoPrev";
    m.hidden = true;
    m.innerHTML = `
      <div class="aivo-prev__bg" data-close="1"></div>
      <div class="aivo-prev__card">
        <button class="aivo-prev__x" data-close="1">✕</button>
        <div class="aivo-prev__media" id="aivoPrevMedia"></div>
        <div class="aivo-prev__bar">
          <div class="aivo-prev__title" id="aivoPrevTitle">Çıktı</div>
          <a class="aivo-prev__dl" id="aivoPrevDl" href="#" download>İndir</a>
        </div>
      </div>
    `;
    document.body.appendChild(m);

    m.addEventListener("click", (e) => {
      if (e.target?.dataset?.close === "1") closePreview();
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

    title.textContent = item.title || "Çıktı";
    dl.href = item.src || "#";
    media.innerHTML = "";

    if (item.type === "audio") {
      const a = document.createElement("audio");
      a.controls = true;
      a.preload = "metadata";
      a.src = item.src || "";
      media.appendChild(a);
      setTimeout(() => { try { a.play(); } catch{} }, 50);
    } else {
      const img = document.createElement("img");
      img.style.width = "100%";
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

  // ========= PUBLIC API =========
  window.AIVO_OUTPUTS = {
    add(item){
      const it = Object.assign({
        id: "out-" + Math.random().toString(16).slice(2) + "-" + Date.now(),
        type: "video",
        title: "Çıktı",
        sub: "",
        src: "",
        status: "queued",
        createdAt: Date.now()
      }, item || {});
      state.list.unshift(it);
      save(state.list);
      render();
      return it.id;
    },
    patch(id, patch){
      const i = state.list.findIndex(x => x.id === id);
      if (i === -1) return false;
      state.list[i] = Object.assign({}, state.list[i], patch || {});
      save(state.list);
      render();
      return true;
    },
    openTab(tab){
      state.tab = tab || "video";
      render();
    },
    list(){
      return state.list.slice();
    }
  };

  // ========= Utils =========
  function escapeHtml(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  // ========= Boot =========
  render();
})();
