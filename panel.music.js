/* =========================================================
   AIVO Right Panel — Music Panel (PLAYER ONLY)
   File: /js/panel.music.js
   - Panel UI: job list YOK (sadece player entegrasyonu)
   - Gerçek player entegrasyonu: SADECE AIVO_PLAYER.add(payloadObject)
   ========================================================= */
(function AIVO_PANEL_MUSIC(){
  if (window.__AIVO_PANEL_MUSIC__) return;
  window.__AIVO_PANEL_MUSIC__ = true;

  const PANEL_KEY = "music";
  const HOST_SEL  = "#rightPanelHost";
  const LS_KEY    = "aivo.music.jobs.v2";

  let hostEl = null;
  let alive  = true;

  /* ---------------- utils ---------------- */
  const qs = (s,r=document)=>r.querySelector(s);

  function ensureHost(){
    hostEl = qs(HOST_SEL);
    return hostEl;
  }

  // ✅ Eski spam listeleri temizle
  function clearLegacyJobs(){
    try { localStorage.removeItem(LS_KEY); } catch {}
  }

  function uiState(status){
    const s = String(status||"").toLowerCase();
    if (["ready","done","completed","success"].includes(s)) return "ready";
    if (["error","failed"].includes(s)) return "error";
    return "processing";
  }

  /* ---------------- REAL PLAYER integration ---------------- */
  function addToRealPlayer({ jobId, outputId, src, title }){
    const P = window.AIVO_PLAYER;
    if (!P || typeof P.add !== "function") {
      console.warn("[panel.music] AIVO_PLAYER.add yok (player.js yüklenmedi?)");
      return false;
    }

    const ok = P.add({
      type: "audio",
      job_id: jobId,
      output_id: outputId || "",
      src,
      title: title || "Müzik",
    });

    if (!ok) console.warn("[panel.music] AIVO_PLAYER.add(payload) false döndü");
    else console.log("[panel.music] AIVO_PLAYER.add(payload) OK", jobId);

    return !!ok;
  }

  /* ---------------- poll timer guard (ANTI SPAM) ---------------- */
  if (!window.__AIVO_MUSIC_POLL_TIMERS__) {
    window.__AIVO_MUSIC_POLL_TIMERS__ = new Map(); // jobId -> timeoutId
  }

  function schedulePoll(jobId, ms){
    if (!alive) return;
    if (!jobId) return;

    const T = window.__AIVO_MUSIC_POLL_TIMERS__;
    if (T.has(jobId)) return;

    const tid = setTimeout(() => {
      T.delete(jobId);
      poll(jobId);
    }, ms);

    T.set(jobId, tid);
  }

  function clearPoll(jobId){
    const T = window.__AIVO_MUSIC_POLL_TIMERS__;
    const tid = T.get(jobId);
    if (tid) clearTimeout(tid);
    T.delete(jobId);
  }

  function clearAllPolls(){
    const T = window.__AIVO_MUSIC_POLL_TIMERS__;
    for (const tid of T.values()) clearTimeout(tid);
    T.clear();
  }

  /* ---------------- polling (PLAYER ONLY) ---------------- */
  async function poll(jobId){
    if (!alive) return;
    if (!jobId) return;

    clearPoll(jobId);

    try{
      const r = await fetch(`/api/music/status?job_id=${encodeURIComponent(jobId)}`, {
        cache: "no-store",
        credentials: "include",
      });

      let j = null;
      try { j = await r.json(); } catch { j = null; }

      if (!r.ok || !j){
        schedulePoll(jobId, 1500);
        return;
      }

      // ✅ state normalize (backend: state / status)
      const state = uiState(j.state || j.status || j?.job?.status);

      // ✅ src normalize
      const src =
        j?.audio?.src ||
        j?.audio_src ||
        j?.result?.audio?.src ||
        j?.result?.src ||
        j?.job?.audio?.src ||
        j?.job?.result?.audio?.src ||
        j?.job?.result?.src ||
        "";

      const outputId =
        j?.audio?.output_id ||
        j?.output_id ||
        j?.result?.output_id ||
        j?.job?.output_id ||
        j?.job?.result?.output_id ||
        "";

      const title = j?.title || j?.job?.title || "Müzik";

      // Panelde liste yok, sadece player’a basacağız
      if (state === "ready" && src){
        addToRealPlayer({
          jobId,
          outputId,
          src,
          title,
        });
        window.toast?.success?.("Müzik hazır 🎵");
        return;
      }

      if (state === "error"){
        window.toast?.error?.("Müzik üretimi hata verdi.");
        return;
      }

      schedulePoll(jobId, 1500);

    } catch(e){
      schedulePoll(jobId, 2000);
    }
  }

  /* ---------------- events ---------------- */
  function onJob(e){
    const payload = e?.detail || e || {};
    const job_id = payload.job_id || payload.id;
    if (!job_id) return;

    // UI basma yok — sadece poll
    poll(job_id);
  }

  /* ---------------- panel integration ---------------- */
  function mount(){
    if (!ensureHost()) return;

    // ✅ Job list'i komple kapattık (senin istediğin)
    hostEl.innerHTML = `
      <div class="rp-players">
        <div class="rp-playerCard">
          <div class="rp-title">Üretilenler</div>
          <div class="rp-body">
            <div style="opacity:.7; font-size:13px; padding:10px 2px;">
              Player kartları hazır olunca burada görünecek.
            </div>
          </div>
        </div>
      </div>`;

    // ✅ eski spam’i temizle
    clearLegacyJobs();

    // listen for new job from studio.music.generate.js
    window.addEventListener("aivo:job", onJob, true);

    console.log("[panel.music] mounted OK (player-only)");
  }

  function destroy(){
    alive = false;
    window.removeEventListener("aivo:job", onJob, true);
    clearAllPolls();
  }

  function register(){
    if (window.RightPanel?.register){
      window.RightPanel.register(PANEL_KEY, { mount, destroy });
      return true;
    }
    return false;
  }

  if (!register()){
    window.addEventListener("DOMContentLoaded", register, { once: true });
  }
})();
