(function () {
  if (window.AIVO_SHARED_VIDEO_CARD) return;

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  function norm(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/\s+/g, " ");
  }

  function ensureStyles() {
    if (document.getElementById("aivoSharedVideoCardStyles")) return;

    const css = `
   .svcCard{
  position:relative;
  border-radius:18px;
  overflow:hidden;
  background:rgba(255,255,255,.03);
  border:1px solid rgba(255,255,255,.07);
  backdrop-filter:blur(10px);
  display:flex;
  flex-direction:column;
}
.svcMedia{
  position:relative;
  flex:none;
  width:100%;
  margin:0;
  border-radius:16px 16px 0 0;
  overflow:hidden;
  background:#050505;
  border:none;
}
      .svcMedia::before{
        content:"";
        display:block;
        padding-top:76%;
      }

      .svcMedia.is-portrait::before{
        padding-top:140%;
      }

      .svcVideo,
      .svcPoster,
      .svcFallback{
        position:absolute;
        inset:0;
        width:100%;
        height:100%;
        object-fit:cover;
        display:block;
        background:#000;
      }

      .svcFallback{
        display:flex;
        align-items:center;
        justify-content:center;
        background:
          radial-gradient(80% 80% at 50% 35%, rgba(175,120,255,.18), rgba(0,0,0,.82)),
          linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02));
      }

      .svcFallbackIcon{
        width:54px;
        height:54px;
        border-radius:999px;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:20px;
        color:#fff;
        background:rgba(255,255,255,.12);
        border:1px solid rgba(255,255,255,.14);
        backdrop-filter:blur(8px);
      }

   .svcBadgeDot{
  position:absolute;
  left:12px;
  bottom:12px;
  z-index:6;
  width:10px;
  height:10px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.22);
  box-shadow:0 0 0 3px rgba(0,0,0,.18);
  pointer-events:none;
}

.svcBadgeDot.is-ready{
  background:#67c98f;
  border-color:rgba(210,245,222,.55);
  box-shadow:
    0 0 0 3px rgba(0,0,0,.16),
    0 0 8px rgba(103,201,143,.22);
}
.svcBadgeDot.is-loading{
  background:#ffb347;
  border-color:rgba(255,220,160,.70);
  box-shadow:
    0 0 0 3px rgba(0,0,0,.18),
    0 0 12px rgba(255,179,71,.45);
  animation:svcBadgePulse 1s ease-in-out infinite;
}

.svcBadgeDot.is-error{
  background:#ff6b6b;
  border-color:rgba(255,210,210,.70);
  box-shadow:
    0 0 0 3px rgba(0,0,0,.18),
    0 0 12px rgba(255,107,107,.35);
}

@keyframes svcBadgePulse{
  0%{ opacity:.45; transform:scale(.92); }
  50%{ opacity:1; transform:scale(1); }
  100%{ opacity:.45; transform:scale(.92); }
}

      .svcRatio{
        position:absolute;
        left:12px;
        bottom:12px;
        z-index:4;
        padding:5px 9px;
        border-radius:999px;
        font-size:11px;
        font-weight:800;
        line-height:1;
        color:#fff;
        background:rgba(18,18,28,.46);
        border:1px solid rgba(255,255,255,.12);
        backdrop-filter:blur(10px);
        pointer-events:none;
      }

      .svcOverlay{
        position:absolute;
        inset:0;
        z-index:3;
        display:flex;
        align-items:center;
        justify-content:center;
        pointer-events:none;
        background:linear-gradient(180deg, rgba(0,0,0,.00), rgba(0,0,0,.10));
        transition:opacity .18s ease;
      }
           .svcHeroPlay{
        position:absolute;
        left:50%;
        top:50%;
        transform:translate(-50%,-50%);
        width:56px;
        height:56px;
        border-radius:999px;
        border:1px solid rgba(255,255,255,.16);
        background:rgba(255,255,255,.14);
        color:#fff;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:18px;
        cursor:pointer;
        box-shadow:0 12px 34px rgba(0,0,0,.30);
        backdrop-filter:blur(12px);
        pointer-events:auto;
      }

    .svcQuickActions{
  position:absolute;
  right:12px;
  top:12px;
  display:flex;
  gap:8px;
  pointer-events:auto;
}

.svcBottomActions{
  position:absolute;
  right:12px;
  bottom:12px;
  display:flex;
  gap:8px;
  pointer-events:auto;
}

      .svcQuickBtn{
        width:36px;
        height:36px;
        border-radius:12px;
        border:1px solid rgba(255,255,255,.12);
        background:rgba(18,18,28,.46);
        color:#fff;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:14px;
        cursor:pointer;
        backdrop-filter:blur(10px);
      }

      .svcQuickBtn:hover{
        background:rgba(255,255,255,.10);
      }

      .svcQuickBtn[disabled]{
        opacity:.45;
        cursor:not-allowed;
      }

      .svcQuickBtnDanger{
        border-color:rgba(255,90,90,.24);
      }
      .svcPlay{
        width:56px;
        height:56px;
        border-radius:999px;
        display:flex;
        align-items:center;
        justify-content:center;
        color:#fff;
        font-size:20px;
        background:rgba(255,255,255,.14);
        border:1px solid rgba(255,255,255,.16);
        box-shadow:0 10px 30px rgba(0,0,0,.30);
        backdrop-filter:blur(10px);
      }

      .svcTopRight{
        position:absolute;
        right:12px;
        top:12px;
        z-index:5;
        display:flex;
        gap:8px;
      }

      .svcIconBtn{
        width:34px;
        height:34px;
        border-radius:12px;
        border:1px solid rgba(255,255,255,.10);
        background:rgba(20,20,28,.52);
        color:#fff;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:14px;
        cursor:pointer;
        backdrop-filter:blur(10px);
      }

      .svcIconBtn[disabled]{
        opacity:.45;
        cursor:not-allowed;
      }
.svcBody{
  display:block;
  padding:12px 12px 14px 12px;
  min-height:52px;
}

     .svcTitle{
  display:block;
  width:100%;
  font-size:12px;
  font-weight:500;
  line-height:1.35;
  color:rgba(255,255,255,.95);
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.svcSub{
  display:none !important;
}

      .svcSub{
        font-size:12px;
        line-height:1.35;
        color:rgba(255,255,255,.74);
        min-height:32px;
        display:-webkit-box;
        -webkit-line-clamp:2;
        -webkit-box-orient:vertical;
        overflow:hidden;
      }

      .svcActions{
        display:grid;
        grid-template-columns:repeat(3, minmax(0, 1fr));
        gap:8px;
      }

      .svcAction{
        height:38px;
        border-radius:12px;
        border:1px solid rgba(255,255,255,.10);
        background:rgba(255,255,255,.04);
        color:#fff;
        cursor:pointer;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:13px;
        font-weight:800;
      }

      .svcAction[disabled]{
        opacity:.45;
        cursor:not-allowed;
      }

      .svcAction.is-danger{
        border-color:rgba(255,120,120,.22);
        background:rgba(255,120,120,.08);
      }

      .svcSkel{
        position:absolute;
        inset:0;
        overflow:hidden;
        background:
          radial-gradient(80% 80% at 50% 35%, rgba(175,120,255,.18), rgba(0,0,0,.82)),
          linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.01));
      }

      .svcSkel::before{
        content:"";
        position:absolute;
        inset:-40%;
        background:linear-gradient(
          90deg,
          rgba(255,255,255,0),
          rgba(220,170,255,.14),
          rgba(255,255,255,0)
        );
        transform:rotate(18deg);
        animation:svcShimmer 1.35s linear infinite;
      }

      @keyframes svcShimmer{
        0%{ transform:translateX(-30%) rotate(18deg); }
        100%{ transform:translateX(30%) rotate(18deg); }
      }
    `;

    const style = document.createElement("style");
    style.id = "aivoSharedVideoCardStyles";
    style.textContent = css;
    document.head.appendChild(style);
  }

   function badgeClass(kind) {
    const k = norm(kind);
    if (k === "ready" || k === "ok" || k === "hazır") return "is-ready";
    if (k === "error" || k === "bad" || k === "hata") return "is-error";
    return "is-loading";
  }

  function ensureSoundBinding() {
    if (window.__AIVO_SHARED_VIDEO_SOUND_BOUND__) return;
    window.__AIVO_SHARED_VIDEO_SOUND_BOUND__ = true;

    document.addEventListener("click", (e) => {
      const btn = e.target?.closest?.('[data-svc-act="sound"]');
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const card = btn.closest(".svcCard");
      const video = card?.querySelector(".svcVideo");
      if (!video) return;

      video.muted = !video.muted;
      btn.textContent = video.muted ? "🔇" : "🔊";
      btn.setAttribute("title", video.muted ? "Sesi Aç" : "Sesi Kapat");
      btn.setAttribute("aria-label", video.muted ? "Sesi Aç" : "Sesi Kapat");
      btn.setAttribute("aria-pressed", video.muted ? "false" : "true");

      if (!video.paused) {
        video.play().catch(() => {});
      }
    }, true);
  }
function ensurePlayBinding() {
  if (window.__AIVO_SHARED_VIDEO_PLAY_BOUND__) return;
  window.__AIVO_SHARED_VIDEO_PLAY_BOUND__ = true;
document.addEventListener("click", (e) => {
  const btn = e.target?.closest?.('[data-svc-act="play"]');
  if (!btn) return;

  const card = btn.closest(".svcCard");
  const video = card?.querySelector(".svcVideo");
  if (!video) return;

  if (video.__aivoPlaySyncBound) return;
  video.__aivoPlaySyncBound = true;

  const sync = () => {
    btn.textContent = video.paused ? "▶" : "❚❚";
    btn.setAttribute("title", video.paused ? "Oynat" : "Duraklat");
    btn.setAttribute("aria-label", video.paused ? "Oynat" : "Duraklat");
  };

  video.addEventListener("play", sync);
  video.addEventListener("pause", sync);
  video.addEventListener("ended", sync);

  sync();
}, true);

  document.addEventListener("play", (e) => {
    const video = e.target;
    if (!(video instanceof HTMLVideoElement)) return;
    if (!video.classList.contains("svcVideo")) return;

    const card = video.closest(".svcCard");
    const btn = card?.querySelector('[data-svc-act="play"]');
    if (!btn) return;

    btn.textContent = "❚❚";
    btn.setAttribute("title", "Duraklat");
    btn.setAttribute("aria-label", "Duraklat");
  }, true);

  document.addEventListener("pause", (e) => {
    const video = e.target;
    if (!(video instanceof HTMLVideoElement)) return;
    if (!video.classList.contains("svcVideo")) return;

    const card = video.closest(".svcCard");
    const btn = card?.querySelector('[data-svc-act="play"]');
    if (!btn) return;

    btn.textContent = "▶";
    btn.setAttribute("title", "Oynat");
    btn.setAttribute("aria-label", "Oynat");
  }, true);

  document.addEventListener("ended", (e) => {
    const video = e.target;
    if (!(video instanceof HTMLVideoElement)) return;
    if (!video.classList.contains("svcVideo")) return;

    const card = video.closest(".svcCard");
    const btn = card?.querySelector('[data-svc-act="play"]');
    if (!btn) return;

    btn.textContent = "▶";
    btn.setAttribute("title", "Oynat");
    btn.setAttribute("aria-label", "Oynat");
  }, true);
}
  function createCardHtml(opts) {
   ensureStyles();
ensureSoundBinding();
ensurePlayBinding();

    const id = String(opts?.id || "").trim();
    const title = String(opts?.title || "Video").trim();
    const sub = String(opts?.sub || "").trim();
    const badgeText = String(opts?.badgeText || "İşleniyor").trim();
    const badgeKind = String(opts?.badgeKind || "loading").trim();
    const videoUrl = String(opts?.videoUrl || "").trim();
    const posterUrl = String(opts?.posterUrl || "").trim();
    const ratio = String(opts?.ratio || "").trim();
      const ready = !!opts?.ready;
    const portrait = false;

    const canDownload = !!opts?.canDownload;
    const canShare = !!opts?.canShare;
    const canDelete = opts?.canDelete !== false;

   return `
      <div class="svcCard" data-svc-id="${esc(id)}">
        <div class="svcMedia ${portrait ? "is-portrait" : ""}">
         <div
  class="svcBadgeDot ${badgeClass(badgeKind)}"
  title="${esc(badgeText)}"
  aria-label="${esc(badgeText)}"
></div>

          <div class="svcTopRight">
            <button class="svcIconBtn" type="button" data-svc-act="fs" data-id="${esc(id)}" title="Büyüt" aria-label="Büyüt">⛶</button>
          </div>

          ${
            ready && videoUrl
              ? `
                <video
                  class="svcVideo"
                  preload="metadata"
                  playsinline
                  webkit-playsinline
                  muted
                  ${posterUrl ? `poster="${esc(posterUrl)}"` : ""}
                  src="${esc(videoUrl)}"
                ></video>
<div class="svcOverlay">
  <button class="svcHeroPlay" type="button" data-svc-act="play" data-id="${esc(id)}" title="Oynat">▶</button>

  <div class="svcQuickActions">
    <button class="svcQuickBtn" type="button" data-svc-act="download" data-id="${esc(id)}" ${canDownload ? "" : "disabled"} title="İndir">⬇</button>
    <button class="svcQuickBtn" type="button" data-svc-act="share" data-id="${esc(id)}" ${canShare ? "" : "disabled"} title="Paylaş">⤴</button>
    <button class="svcQuickBtn svcQuickBtnDanger" type="button" data-svc-act="delete" data-id="${esc(id)}" ${canDelete ? "" : "disabled"} title="Sil">🗑</button>
  </div>

  <div class="svcBottomActions">
    <button class="svcQuickBtn" type="button" data-svc-act="sound" data-id="${esc(id)}" title="Sesi Aç" aria-label="Sesi Aç" aria-pressed="false">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
        <path d="M3 10v4h4l5 4V6L7 10H3Z" fill="currentColor"></path>
        <path d="M16 9a4 4 0 0 1 0 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
        <path d="M18.5 6.5a7.5 7.5 0 0 1 0 11" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
      </svg>
    </button>
  </div>
</div>
              `
              : `
                <div class="svcSkel"></div>
                <div class="svcFallback">
                  <div class="svcFallbackIcon">▶</div>
                </div>
              `
          }
        </div>

        <div class="svcBody">
          <div class="svcTitle" title="${esc(title)}">${esc(title)}</div>
          <div class="svcSub" title="${esc(sub)}">${esc(sub)}</div>
        </div>
      </div>
    `;
  }


  window.AIVO_SHARED_VIDEO_CARD = {
    createCardHtml,
    ensureStyles,
  };
})();
