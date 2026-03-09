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
        background:linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.03));
        border:1px solid rgba(255,255,255,.08);
        box-shadow:0 8px 30px rgba(0,0,0,.18);
      }

      .svcMedia{
        position:relative;
        margin:10px;
        border-radius:16px;
        overflow:hidden;
        background:#050505;
        border:1px solid rgba(255,255,255,.08);
      }

      .svcMedia::before{
        content:"";
        display:block;
        padding-top:56.25%;
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

      .svcBadge{
        position:absolute;
        left:12px;
        top:12px;
        z-index:4;
        padding:6px 10px;
        border-radius:999px;
        font-size:12px;
        font-weight:800;
        color:#fff;
        background:rgba(0,0,0,.38);
        border:1px solid rgba(255,255,255,.10);
        backdrop-filter:blur(10px);
      }

      .svcBadge.is-ready{ border-color:rgba(120,255,190,.22); }
      .svcBadge.is-loading{ border-color:rgba(255,255,255,.10); }
      .svcBadge.is-error{ border-color:rgba(255,120,120,.24); }

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
        padding:2px 12px 12px 12px;
        display:flex;
        flex-direction:column;
        gap:8px;
      }

      .svcTitle{
        font-size:13px;
        font-weight:800;
        line-height:1.3;
        color:rgba(255,255,255,.96);
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
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

  function createCardHtml(opts) {
    ensureStyles();

    const id = String(opts?.id || "").trim();
    const title = String(opts?.title || "Video").trim();
    const sub = String(opts?.sub || "").trim();
    const badgeText = String(opts?.badgeText || "İşleniyor").trim();
    const badgeKind = String(opts?.badgeKind || "loading").trim();
    const videoUrl = String(opts?.videoUrl || "").trim();
    const posterUrl = String(opts?.posterUrl || "").trim();
    const ratio = String(opts?.ratio || "").trim();
    const ready = !!opts?.ready;
    const portrait = ratio.includes("9:16") || ratio.includes("4:5") || ratio.includes("2:3");

    const canDownload = !!opts?.canDownload;
    const canShare = !!opts?.canShare;
    const canDelete = opts?.canDelete !== false;

    return `
      <div class="svcCard" data-svc-id="${esc(id)}">
        <div class="svcMedia ${portrait ? "is-portrait" : ""}">
          <div class="svcBadge ${badgeClass(badgeKind)}">${esc(badgeText)}</div>

          <div class="svcTopRight">
            <button class="svcIconBtn" type="button" data-svc-act="fs" data-id="${esc(id)}" title="Büyüt" aria-label="Büyüt">⛶</button>
          </div>

    ```
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
          <div class="svcOverlayBtns">
            <button class="svcOvBtn" type="button" data-svc-act="play" data-id="${esc(id)}" title="Oynat">▶</button>
            <button class="svcOvBtn" type="button" data-svc-act="download" data-id="${esc(id)}" ${canDownload ? "" : "disabled"} title="İndir">⬇</button>
            <button class="svcOvBtn" type="button" data-svc-act="share" data-id="${esc(id)}" ${canShare ? "" : "disabled"} title="Paylaş">⤴</button>
            <button class="svcOvBtn svcOvBtnDanger" type="button" data-svc-act="delete" data-id="${esc(id)}" ${canDelete ? "" : "disabled"} title="Sil">🗑</button>
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
```

  </div>
`;
}


  window.AIVO_SHARED_VIDEO_CARD = {
    createCardHtml,
    ensureStyles,
  };
})(); 
