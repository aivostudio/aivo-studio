(function () {
  if (!window.RightPanel) return;

  const STORAGE_KEY = "aivo.v2.video.items";
  const state = { items: [] };

/* =======================
   Persist helpers
   ======================= */
function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveItems() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items.slice(0, 50)));
  } catch {}
}

function uid() {
  return "v_" + Math.random().toString(36).slice(2, 10);
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  }[c]));
}

// Title'ı "tip + metin" diye ayır: "Text>Video: xxx" => { type:"Text video", name:"xxx" }
function splitTitle(raw) {
  const s = String(raw ?? "").trim();

  // "Text>Video: ..." veya "Image>Video: ..." veya "Video: ..." gibi
  const m = s.match(/^([^:]{2,24})\s*:\s*(.+)$/);
  let type = m ? m[1].trim() : "";
  let name = m ? m[2].trim() : s;

  // Tip normalize (UI dili)
  const t = type.toLowerCase();
  if (t.includes("text") && t.includes("video")) type = "Text video";
  else if (t.includes("image") && t.includes("video")) type = "Image video";
  else if (t === "video") type = "Video";
  else if (!type) type = "Video";

  // Çok kısa/boşsa
  if (!name) name = "Video";

  return { type, name };
}

function renderTitle(raw) {
  const p = splitTitle(raw);
  return `<span class="vpType">${esc(p.type)}</span><span class="vpName">${esc(p.name)}</span>`;
}

function findGrid(host) {
  return host.querySelector("[data-video-grid]");
}

/* =========================
   panel.video.js (render tarafı)
   - COMPLETED değilse <video> yerine skeleton bas
   - badge "İşleniyor" / "Hazır" kalsın
========================= */

// 1) yardımcılar (dosyanın üstüne veya render fonksiyonunun içine ekleyebilirsin)
function isReady(item){
  return item && (item.state === "COMPLETED" || item.state === "READY" || item.status === "COMPLETED");
}

function esc(s){
  return (s ?? "").toString()
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

function formatKind(item){
  // örn: Text→Video / Image→Video
  const k = (item?.meta?.mode || item?.meta?.kind || item?.kind || "").toString().toLowerCase();
  if (k.includes("image")) return "Image→Video";
  if (k.includes("text")) return "Text→Video";
  return "Video";
}

// 2) Kart HTML’inde thumb bölümünü değiştir
// Mevcut: <video class="vpVideo" ... src="..."></video>
// Yeni: ready ise video, değilse skeleton

function renderThumb(item){
  const ready = isReady(item);
  const badge = ready ? (item.badge || "Hazır") : (item.badge || "İşleniyor");

  return `
    <div class="vpThumb ${ready ? "" : "is-loading"}">
      <div class="vpBadge">${esc(badge)}</div>

      ${ready ? `
        <video class="vpVideo" preload="metadata" playsinline controls src="${esc(item.url)}"></video>
      ` : `
        <div class="vpSkel" aria-label="İşleniyor">
          <div class="vpSkelShimmer"></div>
          <div class="vpSkelPlay">
            <div class="vpSkelPlayRing"></div>
            <div class="vpSkelPlayTri"></div>
          </div>
        </div>
      `}

      <button class="vpExpand" type="button" title="Büyüt">⤢</button>
    </div>
  `;
}

// 3) Metin alanını daha düzenli bas (title + subtitle)
// (prompt vs varsa alt satıra)
function renderText(item){
  const title = formatKind(item);
  const sub = item?.meta?.title || item?.meta?.prompt || item?.prompt || item?.text || "";
  return `
    <div class="vpText">
      <div class="vpTitle" title="${esc(title)}">${esc(title)}</div>
      <div class="vpSub" title="${esc(sub)}">${esc(sub)}</div>
    </div>
  `;
}

// 4) Aksiyonlar: ready değilse disable (ya da gizle)
// Burada disable örneği:
function renderActions(item){
  const ready = isReady(item);
  return `
    <div class="vpActions ${ready ? "" : "is-disabled"}">
      <a class="vpIconBtn" ${ready ? `href="${esc(item.url)}" download` : ""} title="İndir" ${ready ? "" : 'aria-disabled="true" tabindex="-1"'}>↓</a>
      <button class="vpIconBtn" type="button" title="Paylaş" ${ready ? "" : "disabled"}>↗</button>
      <button class="vpIconBtn danger" type="button" title="Sil">🗑</button>
    </div>
  `;
}

// 5) renderItem içinde bu 3 parçayı kullan
function renderItem(item){
  return `
    <div class="vpCard" data-id="${esc(item.id || "")}">
      ${renderThumb(item)}
      ${renderText(item)}
      ${renderActions(item)}
    </div>
  `;
}

  /* =======================
     Fullscreen helper
     ======================= */
  function goFullscreen(card) {
    const video = card?.querySelector("video");
    if (!video) return;

    // 1) Standard Fullscreen API (desktop + most browsers)
    try {
      if (video.requestFullscreen) {
        video.requestFullscreen().catch?.(() => {});
        return;
      }
    } catch {}

    // 2) iOS Safari (video element fullscreen)
    try {
      if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
        return;
      }
    } catch {}

    // 3) Last resort: fullscreen the card container
    try {
      if (card.requestFullscreen) {
        card.requestFullscreen().catch?.(() => {});
        return;
      }
    } catch {}
  }

  /* =======================
     Render
     ======================= */
  function render(host) {
    const grid = findGrid(host);
    if (!grid) return;

    if (!state.items.length) {
      grid.innerHTML = `<div class="vpEmpty">Henüz video yok.</div>`;
      return;
    }

    grid.innerHTML = state.items.map(it => `
      <div class="vpCard" data-id="${it.id}" role="button" tabindex="0">
        <div class="vpThumb">
          <div class="vpBadge">${esc(it.status)}</div>

        ${it.url && it.url.trim() !== "" ? `
  <video
    class="vpVideo"
    src="${esc(it.url)}"
    preload="metadata"
    playsinline
  ></video>

  <div class="vpPlay">
 <span class="vpPlayIcon">▶</span>


  </div>
` : `
  <div class="vpSkel" aria-label="İşleniyor">
    <div class="vpSkelShimmer"></div>
    <div class="vpSkelPlay">
      <div class="vpSkelPlayRing"></div>
      <div class="vpSkelPlayTri"></div>
    </div>
  </div>
`}


          <!-- Fullscreen tool -->
          <button class="vpFsBtn" data-act="fs" title="Büyüt" aria-label="Büyüt">⛶</button>
        </div>

        <div class="vpMeta">
                   <div class="vpTitle">${renderTitle(it.title)}</div>


          <div class="vpActions">
            <button class="vpIconBtn" data-act="download">⬇</button>
            <button class="vpIconBtn" data-act="share">⤴</button>
            <button class="vpIconBtn vpDanger" data-act="delete">🗑</button>
          </div>
        </div>
      </div>
    `).join("");
  }

  /* =======================
     Actions
     ======================= */
  function download(url) {
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function share(url) {
    if (navigator.share) {
      navigator.share({ url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url).catch(() => {});
    }
  }

  function attachEvents(host) {
    const grid = findGrid(host);
    if (!grid) return () => {};

    const onClick = (e) => {
      const card = e.target.closest(".vpCard");
      if (!card) return;

      const id = card.getAttribute("data-id");
      const item = state.items.find(x => x.id === id);
      if (!item) return;

      const btn = e.target.closest("[data-act]");
      const video = card.querySelector("video");
      const overlay = card.querySelector(".vpPlay");

      if (btn) {
        e.stopPropagation();

        const act = btn.getAttribute("data-act");

        if (act === "fs") {
          goFullscreen(card);
          return;
        }

        if (act === "download") download(item.url);
        if (act === "share") share(item.url);
        if (act === "delete") {
          state.items = state.items.filter(x => x.id !== id);
          saveItems();
          render(host);
        }
        return;
      }

      if (!video) return;

      if (video.paused) {
        video.play().catch(() => {});
        overlay.style.display = "none";
      } else {
        video.pause();
        overlay.style.display = "";
      }
    };

    grid.addEventListener("click", onClick);
    return () => grid.removeEventListener("click", onClick);
  }

  /* =======================
     PPE bridge (Runway)
     ======================= */
  function attachPPE(host) {
    if (!window.PPE) return () => {};

    const prev = PPE.onOutput;
    let active = true;

    PPE.onOutput = (job, out) => {
      try { prev && prev(job, out); } catch {}
      if (!active) return;

      if (!out || out.type !== "video" || !out.url) return;

      const job_id =
        job?.job_id ||
        job?.id ||
        out?.meta?.job_id ||
        out?.meta?.id ||
        null;

      const jid = job_id != null ? String(job_id) : null;

      // 1) job_id ile eşleşen pending kart
     const existing = jid
  ? state.items.find(x => x.job_id === jid || x.id === jid)
  : null;

// jid olsa bile eşleşme yoksa: en yeni "İşleniyor" kartı hedefle
const fallbackProcessing = !existing
  ? state.items.find(x => !x.url && (x.status === "İşleniyor" || x.status === "processing"))
  : null;

const target = existing || fallbackProcessing;


      if (target) {
        target.url = out.url;
        target.status = "Hazır";
        target.title = out?.meta?.title || out?.meta?.prompt || target.title || "Video";
        if (!target.job_id && jid) target.job_id = jid;
        if (target.id == null && jid) target.id = jid;
      } else {
        // fallback (eski kayıtlar / dıştan gelen kayıtlar için)
        state.items.unshift({
          id: uid(),
          job_id: jid,
          url: out.url,
          status: "Hazır",
          title: out?.meta?.title || out?.meta?.prompt || "Video"
        });
      }

      saveItems();
      render(host);
    };

    return () => {
      active = false;
      if (PPE.onOutput === arguments.callee) PPE.onOutput = prev || null;
    };
  }

  /* =======================
     Job created bridge (pending card)
     ======================= */
  function attachJobCreated(host) {
    const onJob = (e) => {
      const d = e?.detail || {};
      if (d.app !== "video" || !d.job_id) return;

      const job_id = String(d.job_id);

      // Zaten varsa tekrar ekleme
      const exists = state.items.some(x => x.job_id === job_id || x.id === job_id);
      if (exists) return;

      const modeLabel = d.mode === "image" ? "Image→Video" : "Text→Video";
      const title = (d.prompt && String(d.prompt).trim())
        ? `${modeLabel}: ${String(d.prompt).trim()}`
        : modeLabel;

      state.items.unshift({
        id: job_id,
        job_id: job_id,
        url: "", // processing
        status: "İşleniyor",
        title,
        createdAt: d.createdAt || Date.now(),
        meta: {
          mode: d.mode,
          prompt: d.prompt || "",
          image_url: d.image_url || ""
        }
      });

      saveItems();
      render(host);
    };

    window.addEventListener("aivo:video:job_created", onJob);
    return () => window.removeEventListener("aivo:video:job_created", onJob);
  }

  /* =======================
     Panel register
     ======================= */
  window.RightPanel.register("video", {
    getHeader() {
      return {
        title: "Videolarım",
        meta: "",
        searchPlaceholder: "Videolarda ara..."
      };
    },

    mount(host) {
      host.innerHTML = `
        <div class="videoSide">
          <div class="videoSideCard">
            <div class="vpGrid" data-video-grid></div>
          </div>
        </div>
      `;

      state.items = loadItems();
      render(host);

      const offEvents = attachEvents(host);
      const offPPE = attachPPE(host);
      const offJobs = attachJobCreated(host);

      return () => {
        try { offEvents(); } catch {}
        try { offPPE(); } catch {}
        try { offJobs(); } catch {}
      };
    }
  });
})();
