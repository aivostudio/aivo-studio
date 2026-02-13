(function () {
  if (!window.RightPanel) return;

  const PANEL_KEY = "cover";
  const STORAGE_KEY = "aivo.v2.cover.items";

  // Fal status endpoint (app param önemli)
  const STATUS_URL = (rid) =>
    `/api/providers/fal/predictions/status?request_id=${encodeURIComponent(rid)}&app=cover`;

  const state = { items: [] };
  let alive = true;
  let hostEl = null;

  // timers (spam guard)
  if (!window.__AIVO_COVER_POLL_TIMERS__) window.__AIVO_COVER_POLL_TIMERS__ = new Map();
  const TMAP = window.__AIVO_COVER_POLL_TIMERS__;

  /* =======================
     Utils
  ======================= */
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;",
      '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function uid() {
    return "c_" + Math.random().toString(36).slice(2, 10);
  }

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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items.slice(0, 80)));
    } catch {}
  }

  function upsertItem(patch) {
    const rid = String(patch?.request_id || patch?.id || patch?.job_id || "").trim();
    if (!rid) return;

    const i = state.items.findIndex(x => String(x.request_id || x.id || x.job_id) === rid);
    if (i >= 0) state.items[i] = { ...state.items[i], ...patch };
    else state.items.unshift({ id: rid, request_id: rid, ...patch });

    saveItems();
  }

  function removeItem(id) {
    const sid = String(id || "");
    state.items = state.items.filter(x => String(x.id) !== sid && String(x.request_id) !== sid);
    saveItems();
  }

  function isReady(it) {
    const st = String(it?.status || "").toUpperCase();
    return st === "COMPLETED" || st === "READY" || st === "SUCCEEDED" || st === "DONE";
  }

  function extractImageUrl(payload) {
    return (
      payload?.image_url ||
      payload?.image?.url ||
      payload?.output?.url ||
      payload?.output?.[0] ||
      payload?.outputs?.[0]?.url ||
      payload?.images?.[0]?.url ||
      payload?.result?.images?.[0]?.url ||
      payload?.result?.[0] ||
      payload?.result?.url ||
      null
    );
  }

  function schedulePoll(id, ms) {
    if (!alive || !id) return;
    id = String(id).trim();
    if (!id || id === "TEST") return;
    if (TMAP.has(id)) return;

    const tid = setTimeout(() => {
      TMAP.delete(id);
      poll(id);
    }, ms);

    TMAP.set(id, tid);
  }

  function clearAllPolls() {
    for (const tid of TMAP.values()) clearTimeout(tid);
    TMAP.clear();
  }

  /* =======================
     Styles
  ======================= */
  function ensureStyles() {
    if (document.getElementById("cpStyles")) return;

    const s = document.createElement("style");
    s.id = "cpStyles";
    s.textContent = `
      .cpGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
      .cpCard{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:16px;overflow:hidden}
      .cpThumb{position:relative;aspect-ratio:1/1;background-size:cover;background-position:center;isolation:isolate}
      .cpThumb.is-loading{background:rgba(255,255,255,.04)}
      .cpBadge{position:absolute;top:10px;left:10px;z-index:3;font-size:12px;padding:6px 10px;border-radius:999px;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.10);backdrop-filter: blur(6px)}
      .cpSkel{position:absolute;inset:0;overflow:hidden}
      .cpShimmer{position:absolute;inset:-40%;transform:rotate(12deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.12),transparent);animation:cpShim 1.2s infinite}
      @keyframes cpShim{0%{transform:translateX(-40%) rotate(12deg)}100%{transform:translateX(40%) rotate(12deg)}}

      .cpMeta{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 10px 12px}
      .cpTitle{font-size:12.5px;opacity:.95;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:68%}

      /* overlay ikonlar (örnekteki gibi thumb üstünde) */
      .cpOverlay{position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;gap:14px;
        opacity:0;transition:opacity .18s ease;
      }
      .cpThumb:hover .cpOverlay,
      .cpThumb:focus-within .cpOverlay{opacity:1}
      .cpOverlayBg{position:absolute;inset:0;background:rgba(0,0,0,.18);backdrop-filter: blur(2px)}
      .cpOverlayBtns{position:relative;display:flex;gap:14px;padding:12px 14px;border-radius:18px;
        background:rgba(20,20,28,.35);border:1px solid rgba(255,255,255,.10);backdrop-filter: blur(10px);
      }

      .cpBtn{width:44px;height:44px;border-radius:14px;border:1px solid rgba(255,255,255,.12);
        background:rgba(255,255,255,.06);display:grid;place-items:center;cursor:pointer;transition:transform .08s ease, background .12s ease;
      }
      .cpBtn:hover{transform:translateY(-1px);background:rgba(255,255,255,.10)}
      .cpBtn:active{transform:translateY(0px) scale(.98)}
      .cpBtn:disabled{opacity:.45;cursor:not-allowed;transform:none}
      .cpBtn.danger{border-color:rgba(255,90,90,.28)}
      .cpIconSvg{width:22px;height:22px;display:block;opacity:.95}

      /* alt meta aksiyonları istersen kalsın diye minimal */
      .cpActions{display:flex;gap:6px}
      .cpMini{width:32px;height:32px;border-radius:10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);cursor:pointer}
      .cpMini:disabled{opacity:.45;cursor:not-allowed}
      .cpMini.danger{border-color:rgba(255,90,90,.25)}
      .cpEmpty{opacity:.7;font-size:13px;padding:12px}
    `;
    document.head.appendChild(s);
  }

  /* =======================
     Render
  ======================= */
  function findGrid(host) {
    return host.querySelector("[data-cover-grid]");
  }

  function iconEye() {
    return `<svg class="cpIconSvg" viewBox="0 0 24 24" fill="none">
      <path d="M2.5 12s3.6-7 9.5-7 9.5 7 9.5 7-3.6 7-9.5 7S2.5 12 2.5 12Z" stroke="currentColor" stroke-width="1.8"/>
      <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" stroke="currentColor" stroke-width="1.8"/>
    </svg>`;
  }
  function iconDownload() {
    return `<svg class="cpIconSvg" viewBox="0 0 24 24" fill="none">
      <path d="M12 3v10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M8 11.5 12 15.5l4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M5 20h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`;
  }
  function iconShare() {
    return `<svg class="cpIconSvg" viewBox="0 0 24 24" fill="none">
      <path d="M14 4h6v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M20 4 12.5 11.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M10 7H7a3 3 0 0 0-3 3v7a3 3 0 0 0 3 3h7a3 3 0 0 0 3-3v-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`;
  }
  function iconTrash() {
    return `<svg class="cpIconSvg" viewBox="0 0 24 24" fill="none">
      <path d="M9 3h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M4 6h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M7 6l1 15h8l1-15" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M10 10v7M14 10v7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`;
  }

  function render(host) {
    const grid = findGrid(host);
    if (!grid) return;

    if (!state.items.length) {
      grid.innerHTML = `<div class="cpEmpty">Henüz kapak yok.</div>`;
      return;
    }

    grid.innerHTML = state.items.map(it => {
      const ready = isReady(it) && it.url;
      const badge = ready ? "Hazır" : (it.status === "ERROR" ? "Başarısız" : "İşleniyor");
      const title = it.title || it.prompt || "Kapak";

      const thumbStyle = ready
        ? `style="background-image:url('${esc(it.url)}')"`
        : `style="background:rgba(255,255,255,0.04)"`;

      return `
        <div class="cpCard" data-id="${esc(it.id)}">
          <div class="cpThumb ${ready ? "" : "is-loading"}" ${thumbStyle} tabindex="0">
            <div class="cpBadge">${esc(badge)}</div>

            ${ready ? `
              <div class="cpOverlay" aria-hidden="false">
                <div class="cpOverlayBg"></div>
                <div class="cpOverlayBtns">
                  <button class="cpBtn" data-act="open" title="Görüntüle">${iconEye()}</button>
                  <button class="cpBtn" data-act="download" title="İndir">${iconDownload()}</button>
                  <button class="cpBtn" data-act="share" title="Paylaş">${iconShare()}</button>
                  <button class="cpBtn danger" data-act="delete" title="Sil">${iconTrash()}</button>
                </div>
              </div>
            ` : `
              <div class="cpSkel"><div class="cpShimmer"></div></div>
              <div class="cpOverlay" aria-hidden="true" style="opacity:1">
                <div class="cpOverlayBg" style="background:transparent"></div>
                <div class="cpOverlayBtns" style="opacity:.55">
                  <button class="cpBtn" disabled title="Görüntüle">${iconEye()}</button>
                  <button class="cpBtn" disabled title="İndir">${iconDownload()}</button>
                  <button class="cpBtn" disabled title="Paylaş">${iconShare()}</button>
                  <button class="cpBtn danger" data-act="delete" title="Sil">${iconTrash()}</button>
                </div>
              </div>
            `}
          </div>

          <div class="cpMeta">
            <div class="cpTitle" title="${esc(title)}">${esc(title)}</div>

            <!-- alt mini aksiyonlar (istersen kalsın) -->
            <div class="cpActions">
              <button class="cpMini" data-act="open" title="Aç" ${ready ? "" : "disabled"}>👁️</button>
              <button class="cpMini" data-act="download" title="İndir" ${ready ? "" : "disabled"}>⬇</button>
              <button class="cpMini" data-act="share" title="Paylaş" ${ready ? "" : "disabled"}>⤴</button>
              <button class="cpMini danger" data-act="delete" title="Sil">🗑</button>
            </div>
          </div>
        </div>
      `;
    }).join("");
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
      const card = e.target.closest(".cpCard");
      if (!card) return;

      const id = card.getAttribute("data-id");
      const it = state.items.find(x => String(x.id) === String(id));
      if (!it) return;

      const actBtn = e.target.closest("[data-act]");
      if (!actBtn) return;

      const act = actBtn.getAttribute("data-act");
      const url = it.url;

      if (act === "delete") {
        removeItem(id);
        render(host);
        return;
      }

      if (!url) return;

      if (act === "open") window.open(url, "_blank", "noopener");
      if (act === "download") download(url);
      if (act === "share") share(url);
    };

    grid.addEventListener("click", onClick, true);
    return () => grid.removeEventListener("click", onClick, true);
  }

  /* =======================
     Poll (Fal status)
  ======================= */
  async function poll(requestId) {
    if (!alive || !requestId) return;

    requestId = String(requestId || "").trim();
    if (!requestId || requestId === "TEST") return;

    try {
      const r = await fetch(STATUS_URL(requestId), {
        cache: "no-store",
        credentials: "include",
      });

      const j = await r.json().catch(() => null);

      if (!r.ok || !j) {
        schedulePoll(requestId, 1500);
        return;
      }

      const imageUrl = extractImageUrl(j);

      if (imageUrl) {
        upsertItem({
          id: requestId,
          request_id: requestId,
          status: "COMPLETED",
          url: imageUrl,
        });

        window.PPE?.apply?.({
          state: "COMPLETED",
          outputs: [{ type: "image", url: imageUrl, meta: { app: "cover" } }],
        });

        if (hostEl) render(hostEl);
        return;
      }

      const st = String(j.status || j.state || "").toUpperCase();
      if (["ERROR", "FAILED", "FAIL"].includes(st)) {
        upsertItem({ id: requestId, request_id: requestId, status: "ERROR" });
        if (hostEl) render(hostEl);
        return;
      }

      schedulePoll(requestId, 1500);
    } catch {
      schedulePoll(requestId, 2000);
    }
  }

  /* =======================
     Bridges (job created)
  ======================= */
  function onCoverJobCreated(e) {
    const d = e?.detail || {};
    const app = String(d.app || d.type || d.module || d.panel || "").toLowerCase();
    if (app && app !== "cover") return;

    const rid = d.request_id || d.id || d.job_id;
    if (!rid) return;

    upsertItem({
      id: String(rid),
      request_id: String(rid),
      status: "RUNNING",
      title: d.title || "Kapak",
      prompt: d.prompt || "",
      createdAt: d.createdAt || Date.now(),
    });

    if (hostEl) render(hostEl);
    poll(rid);
  }

  /* =======================
     PPE bridge (image output)
  ======================= */
  function attachPPE(host) {
    if (!window.PPE) return () => {};

    const prev = PPE.onOutput;
    let active = true;

    PPE.onOutput = (job, out) => {
      try { prev && prev(job, out); } catch {}
      if (!active) return;

      if (!out || out.type !== "image" || !out.url) return;

      const app1 = String(out?.meta?.app || "").toLowerCase();
      const app2 = String(job?.app || "").toLowerCase();
      if (app1 && app1 !== "cover" && app2 && app2 !== "cover") return;

      const rid =
        job?.job_id || job?.id || out?.meta?.request_id || out?.meta?.job_id || null;

      const id = rid ? String(rid) : uid();

      upsertItem({
        id,
        request_id: rid ? String(rid) : undefined,
        status: "COMPLETED",
        url: out.url,
        title: out?.meta?.title || "Kapak",
      });

      render(host);
    };

    return () => {
      active = false;
      PPE.onOutput = prev || null;
    };
  }

  /* =======================
     Panel register
  ======================= */
  window.RightPanel.register(PANEL_KEY, {
    getHeader() {
      return { title: "Kapaklarım", meta: "", searchPlaceholder: "Kapaklarda ara..." };
    },

    mount(host) {
      hostEl = host;
      alive = true;
      ensureStyles();

      host.innerHTML = `
        <div class="coverSide">
          <div class="coverSideCard">
            <div class="cpGrid" data-cover-grid></div>
          </div>
        </div>
      `;

      state.items = loadItems();
      render(host);

      const offUI = attachEvents(host);
      const offPPE = attachPPE(host);

      window.addEventListener("aivo:cover:job_created", onCoverJobCreated, true);
      window.addEventListener("aivo:job", onCoverJobCreated, true);

      state.items.slice(0, 20).forEach(it => {
        const rid = it.request_id || it.id;
        if (rid && !isReady(it)) poll(rid);
      });

      return () => {
        alive = false;
        try { offUI(); } catch {}
        try { offPPE(); } catch {}
        window.removeEventListener("aivo:cover:job_created", onCoverJobCreated, true);
        window.removeEventListener("aivo:job", onCoverJobCreated, true);
        clearAllPolls();
      };
    },
  });
})();
