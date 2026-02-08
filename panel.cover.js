(function(){
  if(!window.RightPanel) return;

  const PANEL_KEY = "cover";
  const LS_KEY = "aivo.cover.jobs.v1";

  // ✅ Fal cover için önerilen status endpoint (yoksa 404 alırsın -> altta not)
  const STATUS_URL = (rid) => `/api/providers/fal/predictions/status?request_id=${encodeURIComponent(rid)}`;

  let hostEl = null;
  let alive = true;
  let jobs = loadJobs();

  // timers
  if (!window.__AIVO_COVER_POLL_TIMERS__) window.__AIVO_COVER_POLL_TIMERS__ = new Map();
  const TMAP = window.__AIVO_COVER_POLL_TIMERS__;

  function qs(s, r=document){ return r.querySelector(s); }

  function loadJobs(){
    try{
      const arr = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
      return Array.isArray(arr) ? arr : [];
    }catch{ return []; }
  }
  function saveJobs(){
    try{ localStorage.setItem(LS_KEY, JSON.stringify(jobs.slice(0,100))); }catch{}
  }
  function upsertJob(j){
    const id = j?.request_id || j?.id;
    if(!id) return;
    const i = jobs.findIndex(x => (x.request_id||x.id) === id);
    if(i >= 0) jobs[i] = { ...jobs[i], ...j };
    else jobs.unshift(j);
    saveJobs();
  }

  function schedulePoll(id, ms){
    if(!alive || !id) return;
    if(TMAP.has(id)) return;
    const tid = setTimeout(() => {
      TMAP.delete(id);
      poll(id);
    }, ms);
    TMAP.set(id, tid);
  }
  function clearAllPolls(){
    for(const tid of TMAP.values()) clearTimeout(tid);
    TMAP.clear();
  }

  function extractImageUrl(payload){
    // olası alanlar (fal/replicate çeşitleri)
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

  function isCompleted(payload){
    const s = String(payload?.status || payload?.state || "").toUpperCase();
    return ["COMPLETED","SUCCEEDED","DONE","READY","SUCCESS"].includes(s);
  }
  function isError(payload){
    const s = String(payload?.status || payload?.state || "").toUpperCase();
    return ["ERROR","FAILED","FAIL"].includes(s);
  }

  function setSlot(idx, url){
    const el = hostEl?.querySelector(`[data-slot="${idx}"]`);
    if(!el) return;
    el.dataset.url = url;
    el.style.backgroundImage = `url("${url}")`;
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";
    el.style.border = "1px solid rgba(255,255,255,0.10)";
  }

  function pushToGrid(url){
    const s0 = hostEl?.querySelector(`[data-slot="0"]`);
    const s1 = hostEl?.querySelector(`[data-slot="1"]`);
    const idx = (!s0?.dataset?.url) ? 0 : (!s1?.dataset?.url ? 1 : 0);
    setSlot(idx, url);
  }

async function poll(requestId){
  if(!alive || !requestId) return;

  // ✅ guard (kırmızı 400 spam fix)
  requestId = String(requestId || "").trim();
  if (!requestId || requestId === "TEST") return;

  try{
    const r = await fetch(STATUS_URL(requestId), { cache:"no-store", credentials:"include" });
    let j = null;
    try{ j = await r.json(); }catch{ j = null; }

    if(!r.ok || !j){
      schedulePoll(requestId, 1500);
      return;
    }

      // image yakala
      const imageUrl = extractImageUrl(j);
      if (imageUrl) {
        upsertJob({ request_id: requestId, id: requestId, image_url: imageUrl, status: "COMPLETED" });

        // ✅ PPE’ye bas
        if (window.PPE) {
          PPE.apply({
            state: "COMPLETED",
            outputs: [{ type: "image", url: imageUrl }]
          });
        }

        // ✅ panel grid’e bas (PPE’den bağımsız)
        if (hostEl) pushToGrid(imageUrl);
        return;
      }

      if (isError(j)) {
        upsertJob({ request_id: requestId, id: requestId, status: "ERROR" });
        return;
      }

      // devam
      schedulePoll(requestId, 1500);
    } catch(e){
      schedulePoll(requestId, 2000);
    }
  }

  function onJob(e){
    const d = e?.detail || {};
    // cover job'ı yakala (type / panelKey / moduleKey hangisi varsa)
    const t = String(d.type || d.module || d.panel || "").toLowerCase();
    if (t && t !== "cover") return;

    const requestId = d.request_id || d.id || d.job_id;
    if(!requestId) return;

    upsertJob({
      request_id: requestId,
      id: requestId,
      status: "RUNNING",
      title: d.title || "Kapak Üretimi"
    });

    poll(requestId);
  }

  window.RightPanel.register(PANEL_KEY, {
    mount(host){
      hostEl = host;
      alive = true;

      host.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:12px;">
          <div style="font-weight:800; font-size:14px;">Kapak Outputs</div>
          <div style="opacity:.75; font-size:13px;">Stub panel. Status -> PPE image bridge aktif.</div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div data-slot="0" style="aspect-ratio:1/1; border-radius:14px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06); cursor:pointer;"></div>
            <div data-slot="1" style="aspect-ratio:1/1; border-radius:14px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06); cursor:pointer;"></div>
          </div>
        </div>
      `;

      // slot click -> open
      host.addEventListener("click", (ev) => {
        const box = ev.target.closest("[data-slot]");
        const url = box?.dataset?.url;
        if (url) window.open(url, "_blank", "noopener");
      }, true);

      // eski job’ları tekrar poll (varsa)
      jobs.slice(0, 20).forEach(j => j?.request_id && poll(j.request_id));

      window.addEventListener("aivo:job", onJob, true);

      return () => {
        alive = false;
        window.removeEventListener("aivo:job", onJob, true);
        clearAllPolls();
      };
    }
  });

})();
