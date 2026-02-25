/* ==========================================================
   AIVO Studio – Music Generate (AUTO BIND, PRODUCTION)
   File: /js/studio.music.generate.js
   ========================================================== */

async function generateMusic(payload) {
  const r = await fetch("/api/music/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const j = await r.json();
  if (!j.ok) throw new Error("generate_failed");

  return j.provider_job_id;
}

/* =========================================================
   AIVO Studio — Music Generate (AUTO BIND, PRODUCTION)
   File: /js/studio.music.generate.js
   ========================================================= */
(function AIVO_STUDIO_MUSIC_GENERATE(){
  if (window.__AIVO_STUDIO_MUSIC_GENERATE__) return;
  window.__AIVO_STUDIO_MUSIC_GENERATE__ = true;

  const BTN_ID = "musicGenerateBtn";
  const PROMPT_SEL = "#prompt";

  let boundBtn = null;
  let isBusy = false;

  function qs(sel, root=document){ return root.querySelector(sel); }

  function getPrompt(){
    const el = qs(PROMPT_SEL);
    return (el?.value || "").trim();
  }

  function toastError(msg){
    if (window.toast?.error) return window.toast.error(msg);
    if (window.toast?.info) return window.toast.info(msg);
    console.warn("[music.generate]", msg);
    alert(msg);
  }

  function toastSuccess(msg){
    if (window.toast?.success) return window.toast.success(msg);
    if (window.toast?.info) return window.toast.info(msg);
    console.log("[music.generate]", msg);
  }

  function dispatchJob(job){
    try {
      window.dispatchEvent(new CustomEvent("aivo:job", { detail: job }));
    } catch(e) {
      console.warn("[music.generate] dispatch aivo:job failed:", e);
    }
  }

 async function callGenerateAPI(prompt){

 const titleEl  = document.querySelector('#title');
const lyricsEl = document.querySelector('#lyrics');
const vocalEl = document.querySelector('#vocalType');
const moodEl   = document.querySelector('#mood');

const title  = titleEl  ? titleEl.value.trim()  : '';
const lyrics = lyricsEl ? lyricsEl.value.trim() : '';
const vocalText = vocalEl
  ? (vocalEl.value || vocalEl.selectedOptions?.[0]?.textContent?.trim() || "")
  : "";

const moodText = moodEl
  ? (moodEl.value || moodEl.selectedOptions?.[0]?.textContent?.trim() || "")
  : "";

// placeholder ise boş gönder
const vocal = (vocalText === "Vokal tipini seç") ? "" : vocalText;
const mood  = (moodText  === "Ruh halini seç")   ? "" : moodText;

// mode’u vokale göre ayarla (enstrümantal seçilmediyse vocals)
const mode = (vocal === "Enstrümantal (Vokalsiz)") ? "instrumental" : "vocals";

const payload = {
  prompt,
  mode,
  title,
  lyrics,
  vocal,
  mood,
  use_credits: true,
  charge: true,
  credits: 5,
  cost: 5,
};
    const res = await fetch("/api/music/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    let data = null;
    try { data = await res.json(); }
    catch { data = { ok:false, error:"non_json_response", status: res.status }; }

    if (!res.ok || !data?.ok) {
      const errMsg = data?.error || ("http_" + res.status);
      throw new Error("generate_failed:" + errMsg);
    }

    return data;
  }

  async function doGenerate(){
    if (isBusy) return;
    isBusy = true;

    try {
      const prompt = getPrompt();
      if (!prompt){
        toastError("Lütfen önce prompt yaz.");
        return;
      }

      window.__LAST_PROMPT__ = prompt;

   

      // 1) Direkt API
      let result = null;
      try {
        result = await callGenerateAPI(prompt);
      } catch (apiErr) {
        console.warn("[music.generate] /api/music/generate failed, fallback to svc if any:", apiErr);

        // 2) Fallback: eski service
        const svc =
          window.StudioServices ||
          window.AIVO_SERVICES ||
          window.AIVO_APP ||
          null;

        if (svc?.generateMusic && typeof svc.generateMusic === "function"){
          result = await svc.generateMusic({ prompt });
        }
        else if (window.generateMusic && typeof window.generateMusic === "function"){
          result = await window.generateMusic({ prompt });
        }
        else {
          toastError("Generate endpoint hata verdi ve fallback generateMusic fonksiyonu bulunamadı.");
          return;
        }
      }

           // =========================================================
      // ✅ RESULT NORMALIZE (FIXED)
      // - backend artık provider_job_id döndürüyor: prov_music_...
      // - status endpoint bunu bekliyor
      // =========================================================
      const provider_job_id =
        result?.provider_job_id ||
        result?.providerJobId ||
        result?.data?.provider_job_id ||
        result?.data?.providerJobId ||
        null;

      const internal_job_id =
        result?.job_id ||
        result?.jobId ||
        result?.internal_job_id ||
        result?.id ||
        result?.data?.job_id ||
        result?.data?.id ||
        null;

      // ✅ provider_song_ids normalize (2 ayrı şarkı id'si buradan gelecek)
      const provider_song_ids =
        result?.provider_song_ids ||
        result?.providerSongIds ||
        result?.data?.provider_song_ids ||
        result?.data?.providerSongIds ||
        [];

      // Öncelik provider id
      const job_id = provider_job_id || internal_job_id;

      if (!job_id){
        console.warn("[music.generate] generate response:", result);
        toastError("Job oluşturuldu ama job_id / provider_job_id gelmedi.");
        return;
      }

      // DEBUG
      window.__LAST_MUSIC_GENERATE_RESPONSE__ = result;
      window.__LAST_MUSIC_JOB_ID__ = job_id;
      window.__LAST_MUSIC_PROVIDER_JOB_ID__ = provider_job_id;
      window.__LAST_MUSIC_INTERNAL_JOB_ID__ = internal_job_id;

      console.log("[music.generate] FULL_RESPONSE:", result);
      console.log("[music.generate] job_id chosen:", job_id, {
        provider_job_id,
        internal_job_id
      });

      const isProviderJob = String(job_id).startsWith("prov_music_");
      const jobType = "music"; // panel key music

      toastSuccess("Müzik üretimi başladı 🎵");

   // 1) Panel event
dispatchJob({
  type: jobType,
  kind: jobType,

  job_id: job_id,
  id: job_id,

  status: result?.state || result?.status || "queued",
  title: "Müzik Üretimi",

  __ui_state: "processing",
  __audio_src: "",

  // panel.music.js bunu direkt okuyor
  provider_job_id: provider_job_id,

  // ✅ EN KRİTİK: iki kart için farklı provider_song_id'ler buradan gelecek
  provider_song_ids: Array.isArray(provider_song_ids) ? provider_song_ids : [],

  // panel.music.js için gerçek job id (internal) sakla
  __real_job_id: internal_job_id || job_id,

  // debug flagler kalsın
  __provider_job: isProviderJob,
  __provider_job_id: provider_job_id,
  __internal_job_id: internal_job_id,
});



      // 2) AIVO_JOBS store (varsa)
      try {
        if (window.AIVO_JOBS?.upsert) {
          window.AIVO_JOBS.upsert({
            type: jobType,
            kind: jobType,
            job_id: job_id,
            id: job_id,
            status: result?.state || result?.status || "queued",
            title: "Müzik Üretimi",
            createdAt: new Date().toISOString(),
            __provider_job: isProviderJob,
            __provider_job_id: provider_job_id,
            __internal_job_id: internal_job_id,
          });
// =========================================================
// 🔁 POLL STATUS
// - audio.src gelir gelmez: "Ön izleme hazır" (preview)
// - iş tamamen bitince: "Hazır" (ready)
// - 2 şarkı varsa ikisini de ayrı ayrı poll'lar
// =========================================================
if (provider_job_id) {
  const ids = (Array.isArray(provider_song_ids) && provider_song_ids.length)
    ? provider_song_ids.map(String)
    : [String(provider_job_id)];

  const seenSrc = Object.create(null);   // { [id]: true }
  const done = Object.create(null);      // { [id]: true }

  const pollInterval = setInterval(async () => {
    for (const songId of ids) {
      try {
        const r = await fetch(
          `/api/music/status?provider_job_id=${encodeURIComponent(songId)}`
        );
        const st = await r.json();

        const src = st?.audio?.src || st?.mp3_url || st?.audio_url || "";
        const state = String(st?.state || st?.status || "").toLowerCase();

        // 1) ✅ PREVIEW: src ilk kez gelince hemen karta bas
        if (src && !seenSrc[songId]) {
          seenSrc[songId] = true;

          dispatchJob({
            type: "music",
            kind: "music",

            // kritik: kartları songId üzerinden ayırıyoruz
            job_id: songId,
            id: songId,

            // provider bağları
            provider_job_id: String(provider_job_id),
            provider_song_id: String(songId),
            provider_song_ids: ids,

            // UI
            status: "processing",
            state: state || "processing",
            title: "Müzik Üretimi",
            __ui_state: "preview",     // kartta "Ön izleme hazır" gibi göstereceğiz
            __audio_src: src,
            audio: { src },
            mp3_url: src,

            internal_job_id: st?.internal_job_id || st?.internalJobId || null,
            __provider_job: true,
            __provider_job_id: String(provider_job_id),
            __internal_job_id: st?.internal_job_id || st?.internalJobId || null,
          });
        }

        // 2) ✅ READY: iş bitince "Hazır"a geçir
        if (src && (state === "ready" || state === "completed" || state === "complete")) {
          if (!done[songId]) {
            done[songId] = true;

            dispatchJob({
              type: "music",
              kind: "music",
              job_id: songId,
              id: songId,

              provider_job_id: String(provider_job_id),
              provider_song_id: String(songId),
              provider_song_ids: ids,

              status: "ready",
              state: "ready",
              title: "Müzik Üretimi",
              __ui_state: "ready",
              __audio_src: src,
              audio: { src },
              mp3_url: src,

              output_id: st?.output_id || st?.outputId || null,
              internal_job_id: st?.internal_job_id || st?.internalJobId || null,
              __provider_job: true,
              __provider_job_id: String(provider_job_id),
              __internal_job_id: st?.internal_job_id || st?.internalJobId || null,
            });
          }
        }
      } catch (e) {
        console.warn("[music.generate] status poll failed:", songId, e);
      }
    }

    // tüm şarkılar done olduysa poll'u durdur
    const allDone = ids.every((x) => done[String(x)]);
    if (allDone) clearInterval(pollInterval);
  }, 1500);
}

        }
      } catch(e) {
        console.warn("[music.generate] AIVO_JOBS.upsert failed:", e);
      }

    } catch (e) {
      console.error("[music.generate] error:", e);
      toastError("Müzik üretiminde hata oluştu.");
    } finally {
      isBusy = false;
    }
  }

  function bind(){
    const btn = document.getElementById(BTN_ID);
    if (!btn) return;

    if (boundBtn === btn) return;
    boundBtn = btn;

    btn.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      doGenerate();
      return false;
    });

    console.log("[studio.music.generate] bound OK:", BTN_ID);
  }

  setInterval(bind, 500);

  window.addEventListener("DOMContentLoaded", bind);
  window.addEventListener("load", bind);

})();
