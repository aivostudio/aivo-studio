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

  // ========= Ensure Right Panel Mount =========
  // Senin mevcut right-panel içinde bir "videoList" / "musicList" vs. var.
  // Biz tek container mount edeceğiz: #outputsMount
  function ensureMount() {
    let mount = document.getElementById("outputsMount");
    if (mount) return mount;

    // right-card içinde header zaten var. right-card'ın içine ekleyelim.
    const rightCard = $(".right-panel .right-card");
    if (!rightCard) return null;

    mount = document.createElement("div");
    mount.id = "outputsMount";
    rightCard.appendChild(mount);
    return mount;
  }

  // ========= Build UI =========
  function render() {
    const mount = ensureMount();
    if (!mount) return;

    const videos = state.list.filter(x => x.type === "video");
    const audios = state.list.filter(x => x.type === "audio");
    const images = state.list.filter(x => x.type === "image");

    // Tabs + active list
    const active = state.tab === "video" ? videos : state.tab === "audio" ? audios : images;

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

    // Tab clicks
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

        // download icon tıklamasında modal açma
        if (e.target && e.target.closest && e.target.closest(".out-btn")) return;

        openPreview(item);
      });
    });
  }

  function cardHTML(item) {
    const badge = item.status === "ready" ? "Hazır" : item.status === "error" ? "Hata" : "Sırada";
    const sub = item.sub || (item.type === "video" ? "MP4 çıktı" : item.type === "audio" ? "MP3/WAV çıktı" : "PNG/JPG çıktı");

    const thumb = item.type === "video"
      ? `<video class="out-thumb" muted playsinline preload="metadata" src="${item.src || ""}"></video>`
      : item.type === "audio"
        ? `<div class="out-thumb" style="display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.75);font-size:26px;">♪</div>`
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

  // ========= Global Preview Modal (single) =========
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
        <button class="aivo-prev__x" data-close="1" aria-label="Kapat">✕</button>
        <div class="aivo-prev__media" id="aivoPrevMedia"></div>
        <div class="aivo-prev__bar">
          <div class="aivo-prev__title" id="aivoPrevTitle">Çıktı</div>
          <a class="aivo-prev__dl" id="aivoPrevDl" href="#" download>İndir</a>
        </div>
      </div>
    `;
    document.body.appendChild(m);

    m.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.dataset && t.dataset.close === "1") closePreview();
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

    // reset
    media.innerHTML = "";

    if (item.type === "video") {
      const v = document.createElement("video");
      v.controls = true;
      v.playsInline = true;
      v.preload = "metadata";
      v.src = item.src || "";
      media.appendChild(v);
      setTimeout(() => { try { v.play(); } catch(_){} }, 50);
    } else if (item.type === "audio") {
      const a = document.createElement("audio");
      a.controls = true;
      a.preload = "metadata";
      a.src = item.src || "";
      media.appendChild(a);
      setTimeout(() => { try { a.play(); } catch(_){} }, 50);
    } else {
      const img = document.createElement("img");
      img.style.width = "100%";
      img.style.display = "block";
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

  // ========= Public API (tek otorite) =========
  // Tüm modüller burayı çağıracak:
  // AIVO_OUTPUTS.add({type:"video", title:"...", src:"...", status:"ready"})
  // AIVO_OUTPUTS.patch(id, {status:"ready", src:"..."})
  // AIVO_OUTPUTS.openTab("video")
  window.AIVO_OUTPUTS = {
    add(item){
      const it = Object.assign({
        id: "out-" + Math.random().toString(16).slice(2) + "-" + Date.now(),
        type: "video",
        title: "Çıktı",
        sub: "",
        src: "",
        status: "queued", // queued|ready|error
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

  // ========= Utilities =========
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
