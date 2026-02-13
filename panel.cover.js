/* panel.cover.js — Cover RightPanel (grid + hover ikonlar + aktif aksiyonlar) */
(function () {
  if (!window.RightPanel) return;

  const PANEL_KEY = "cover";
  const LS_KEY = "aivo.cover.jobs.v1";

  // ✅ Fal status endpoint (bizde çalışıyor)
  // Not: sende daha önce &app=cover gerekiyorduysa buraya ekle:
  // const STATUS_URL = (rid) => `/api/providers/fal/predictions/status?request_id=${encodeURIComponent(rid)}&app=cover`;
  const STATUS_URL = (rid) =>
    `/api/providers/fal/predictions/status?request_id=${encodeURIComponent(rid)}`;

  let hostEl = null;
  let alive = true;
  let jobs = loadJobs();

  // timers (requestId guard + spam engel)
  if (!window.__AIVO_COVER_POLL_TIMERS__) window.__AIVO_COVER_POLL_TIMERS__ = new Map();
  const TMAP = window.__AIVO_COVER_POLL_TIMERS__;

  function qs(s, r = document) {
    return r.querySelector(s);
  }
  function qsa(s, r = document) {
    return Array.from(r.querySelectorAll(s));
  }

  function loadJobs() {
    try {
      const arr = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }
  function saveJobs() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(jobs.slice(0, 100)));
    } catch {}
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  function normalizeStatus(s) {
    const v = String(s || "").toUpperCase();
    if (["COMPLETED", "SUCCEEDED", "DONE", "READY", "SUCCESS"].includes(v)) return "READY";
    if (["ERROR", "FAILED", "FAIL"].includes(v)) return "ERROR";
    if (["RUNNING", "PROCESSING", "IN_PROGRESS"].includes(v)) return "RUNNING";
    return v || "RUNNING";
  }

  function upsertJob(j) {
    const id = j?.request_id || j?.id || j?.job_id;
    if (!id) return;
    const key = String(id);
    const i = jobs.findIndex((x) => String(x?.request_id || x?.id || x?.job_id) === key);
    if (i >= 0) jobs[i] = { ...jobs[i], ...j };
    else jobs.unshift(j);
    saveJobs();
  }

  function removeJob(id) {
    const key = String(id || "");
    if (!key) return;
    jobs = jobs.filter((x) => String(x?.request_id || x?.id || x?.job_id) !== key);
    saveJobs();
  }

  function schedulePoll(id, ms) {
    if (!alive || !id) return;
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

  function isCompleted(payload) {
    const s = String(payload?.status || payload?.state || "").toUpperCase();
    return ["COMPLETED", "SUCCEEDED", "DONE", "READY", "SUCCESS"].includes(s);
  }

  function isError(payload) {
    const s = String(payload?.status || payload?.state || "").toUpperCase();
    return ["ERROR", "FAILED", "FAIL"].includes(s);
  }

  function titleFromJob(j) {
    const t =
      j?.title ||
      j?.meta?.title ||
      j?.prompt ||
      j?.meta?.prompt ||
      "Kapak";
    // kart altındaki text kısa olsun
    const s = String(t || "").trim();
    if (!s) return "Kapak";
    return s.length > 22 ? s.slice(0, 19) + "…" : s;
  }

  function render() {
    if (!hostEl) return;

    const grid = qs("[data-cover-grid]", hostEl);
    if (!grid) return;

    // sadece image_url olanları göster (hazır çıktılar)
    const items = jobs
      .map((j) => ({
        id: String(j?.request_id || j?.id || j?.job_id || ""),
        status: normalizeStatus(j?.status || j?.state),
        image_url: j?.image_url || j?.image?.url || j?.url || null,
        title: titleFromJob(j),
      }))
      .filter((x) => x.id && x.image_url);

    if (!items.length) {
      grid.innerHTML = `
        <div class="cpEmpty">
          Henüz kapak yok.
          <div class="cpEmptySub">Kapak üretince burada listelenecek.</div>
        </div>
      `;
      return;
    }

    grid.innerHTML = items
      .slice(0, 24)
      .map((it) => {
        return `
          <div class="cpCard" data-id="${esc(it.id)}" data-url="${esc(it.image_url)}" role="button" tabindex="0">
            <div class="cpThumb" style="background-image:url('${esc(it.image_url)}')">
              <div class="cpBadge">${it.status === "READY" ? "Hazır" : esc(it.status)}</div>

              <div class="cpOverlay" aria-hidden="true">
                <button class="cpIco" type="button" data-act="view" title="Görüntüle" aria-label="Görüntüle">👁️</button>
                <button class="cpIco" type="button" data-act="download" title="İndir" aria-label="İndir">⬇</button>
                <button class="cpIco" type="button" data-act="share" title="Paylaş" aria-label="Paylaş">⤴</button>
                <button class="cpIco danger" type="button" data-act="delete" title="Sil" aria-label="Sil">🗑</button>
              </div>
            </div>
            <div class="cpMeta">
              <div class="cpTitle" title="${esc(it.title)}">${esc(it.title)}</div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  async function download(url, filename = "cover.png") {
    try {
      // direkt link indir (en basit)
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {}
  }

  async function share(url) {
    try {
      if (navigator.share) {
        await navigator.share({ url });
      } else {
        await navigator.clipboard?.writeText(url);
      }
    } catch {}
  }

  function attachEvents() {
    if (!hostEl) return () => {};

    const onClick = async (ev) => {
      const card = ev.target.closest(".cpCard");
      if (!card) return;

      const id = card.getAttribute("data-id");
      const url = card.getAttribute("data-url");
      if (!id || !url) return;

      const btn = ev.target.closest("[data-act]");
      const act = btn?.getAttribute("data-act") || null;

      // kartın kendisine tıklayınca görüntüle
      if (!act) {
        window.open(url, "_blank", "noopener");
        return;
      }

      ev.preventDefault();
      ev.stopPropagation();

      if (act === "view") window.open(url, "_blank", "noopener");
      if (act === "download") await download(url, `cover-${id.slice(0, 8)}.png`);
      if (act === "share") await share(url);
      if (act === "delete") {
        removeJob(id);
        render();
      }
    };

    hostEl.addEventListener("click", onClick, true);

    // Enter ile de aç
    const onKey = (ev) => {
      if (ev.key !== "Enter") return;
      const card = ev.target.closest(".cpCard");
      if (!card) return;
      const url = card.getAttribute("data-url");
      if (url) window.open(url, "_blank", "noopener");
    };
    hostEl.addEventListener("keydown", onKey, true);

    return () => {
      hostEl?.removeEventListener("click", onClick, true);
      hostEl?.removeEventListener("keydown", onKey, true);
    };
  }

  async function poll(requestId) {
    if (!alive || !requestId) return;

    // ✅ guard
    requestId = String(requestId || "").trim();
    if (!requestId || requestId === "TEST") return;

    try {
      const r = await fetch(STATUS_URL(requestId), {
        cache: "no-store",
        credentials: "include",
      });

      let j = null;
      try {
        j = await r.json();
      } catch {
        j = null;
      }

      if (!r.ok || !j) {
        schedulePoll(requestId, 1500);
        return;
      }

      const imageUrl = extractImageUrl(j);
      if (imageUrl) {
        upsertJob({
          request_id: requestId,
          id: requestId,
          image_url: imageUrl,
          status: "COMPLETED",
        });

        // ✅ PPE’ye bas (output pipeline bozulmasın)
        if (window.PPE) {
          try {
            PPE.apply({
              state: "COMPLETED",
              outputs: [{ type: "image", url: imageUrl, meta: { app: "cover" } }],
            });
          } catch {}
        }

        render();
        return;
      }

      if (isError(j)) {
        upsertJob({ request_id: requestId, id: requestId, status: "ERROR" });
        render();
        return;
      }

      // devam
      if (isCompleted(j)) {
        // completed ama image yoksa yine de bir süre dene
        schedulePoll(requestId, 1200);
      } else {
        schedulePoll(requestId, 1500);
      }
    } catch (e) {
      schedulePoll(requestId, 2000);
    }
  }

  function onJob(e) {
    const d = e?.detail || {};

    // cover job'ı yakala
    const t = String(d.type || d.module || d.panel || d.app || "").toLowerCase();
    if (t && t !== "cover") return;

    const requestId = d.request_id || d.id || d.job_id;
    if (!requestId) return;

    upsertJob({
      request_id: requestId,
      id: requestId,
      status: "RUNNING",
      title: d.title || d.prompt || "Kapak",
      prompt: d.prompt || "",
      meta: { ...(d.meta || {}), app: "cover" },
    });

    render();
    poll(requestId);
  }

  function injectStyles() {
    if (document.getElementById("cpCoverStyles")) return;
    const st = document.createElement("style");
    st.id = "cpCoverStyles";
    st.textContent = `
      .cpWrap{ display:flex; flex-direction:column; gap:10px; }
      .cpHeader{ display:flex; flex-direction:column; gap:6px; }
      .cpTitleH{ font-weight:800; font-size:14px; letter-spacing:.2px; }
      .cpSearch{ width:100%; background:rgba(0,0,0,.22); border:1px solid rgba(255,255,255,.10);
        border-radius:12px; padding:10px 12px; color:rgba(255,255,255,.92); outline:none; }
      .cpSearch::placeholder{ color:rgba(255,255,255,.35); }
      .cpGrid{ display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
      .cpEmpty{ padding:18px 12px; opacity:.8; font-size:13px; text-align:center; }
      .cpEmptySub{ margin-top:6px; opacity:.6; font-size:12px; }
      .cpCard{ display:flex; flex-direction:column; gap:8px; cursor:pointer; user-select:none; }
      .cpThumb{
        position:relative; aspect-ratio: 1/1;
        border-radius:16px;
        background:rgba(255,255,255,.04);
        border:1px solid rgba(255,255,255,.10);
        background-size:cover; background-position:center;
        overflow:hidden;
      }
      .cpBadge{
        position:absolute; top:10px; left:10px;
        padding:6px 10px; border-radius:999px;
        background:rgba(0,0,0,.38);
        border:1px solid rgba(255,255,255,.14);
        font-size:12px; color:rgba(255,255,255,.92);
        backdrop-filter: blur(10px);
      }
      .cpOverlay{
        position:absolute; inset:0;
        display:flex; align-items:center; justify-content:center; gap:12px;
        background:rgba(0,0,0,.35);
        opacity:0; transform:translateY(4px);
        transition: opacity .16s ease, transform .16s ease;
      }
      .cpThumb:hover .cpOverlay, .cpThumb:focus-within .cpOverlay{
        opacity:1; transform:none;
      }
      .cpIco{
        width:44px; height:44px;
        border-radius:12px;
        display:flex; align-items:center; justify-content:center;
        background:rgba(0,0,0,.35);
        border:1px solid rgba(255,255,255,.18);
        color:rgba(255,255,255,.95);
        cursor:pointer;
        backdrop-filter: blur(10px);
        box-shadow: 0 10px 30px rgba(0,0,0,.28);
        transition: transform .12s ease, border-color .12s ease, background .12s ease;
      }
      .cpIco:hover{ transform: translateY(-1px); border-color: rgba(255,255,255,.34); background:rgba(0,0,0,.42); }
      .cpIco.danger{ border-color: rgba(255,90,90,.35); }
      .cpIco.danger:hover{ border-color: rgba(255,90,90,.65); }
      .cpMeta{ padding:0 2px; }
      .cpTitle{
        font-size:13px; font-weight:700;
        color:rgba(255,255,255,.92);
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }
    `;
    document.head.appendChild(st);
  }

  window.RightPanel.register(PANEL_KEY, {
    getHeader() {
      return {
        title: "Kapaklarım",
        meta: "",
        searchPlaceholder: "Kapaklarda ara...",
      };
    },

    mount(host) {
      hostEl = host;
      alive = true;
      jobs = loadJobs();

      injectStyles();

      host.innerHTML = `
        <div class="cpWrap">
          <div class="cpHeader">
            <div class="cpTitleH">Kapaklarım</div>
            <input class="cpSearch" data-cover-search placeholder="Kapaklarda ara..." />
          </div>

          <div class="cpGrid" data-cover-grid></div>
        </div>
      `;

      // Search (client-side)
      const searchEl = qs("[data-cover-search]", host);
      const applySearch = () => {
        const q = String(searchEl?.value || "").trim().toLowerCase();
        if (!q) {
          render();
          return;
        }
        // hızlı filtre: title/prompt içinde geçenler
        const filtered = loadJobs().filter((j) => {
          const t = String(j?.title || j?.prompt || j?.meta?.prompt || "").toLowerCase();
          return t.includes(q);
        });
        jobs = filtered;
        render();
        jobs = loadJobs(); // filtre sadece görünüm için; storage'ı bozma
      };
      const onInput = () => applySearch();
      searchEl?.addEventListener("input", onInput);

      render();

      // Eski job’ları tekrar poll (son 20)
      loadJobs()
        .slice(0, 20)
        .forEach((j) => {
          const rid = j?.request_id || j?.id || j?.job_id;
          if (rid) poll(rid);
        });

      window.addEventListener("aivo:job", onJob, true);

      const offEvents = attachEvents();

      return () => {
        alive = false;
        window.removeEventListener("aivo:job", onJob, true);
        try { offEvents(); } catch {}
        try { searchEl?.removeEventListener("input", onInput); } catch {}
        clearAllPolls();
      };
    },
  });
})();
