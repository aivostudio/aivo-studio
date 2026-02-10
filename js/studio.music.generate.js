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
    const payload = {
      prompt,
      mode: "instrumental",
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

     if (window.RightPanel?.force) {
  try {
    // sadece panel music değilse force et, yoksa remount edip kartları silme
    const cur = window.RightPanel.getCurrentKey?.();
    if (cur !== "music") window.RightPanel.force("music");
  } catch {}
}


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
// 🔁 POLL STATUS → READY OLUNCA UI'YI GÜNCELLE
// =========================================================
if (provider_job_id) {
  const pollInterval = setInterval(async () => {
    try {
      const r = await fetch(
        `/api/music/status?provider_job_id=${encodeURIComponent(provider_job_id)}`
      );
      const st = await r.json();

      console.log("[music.generate] poll status:", st);

      if (st?.state === "ready" && st?.audio?.src) {
        clearInterval(pollInterval);

        console.log("[music.generate] READY → dispatch UI update", st);

        dispatchJob({
          type: "music",
          kind: "music",
          job_id: provider_job_id,
          id: provider_job_id,
          status: "ready",
          state: "ready",
          title: "Müzik Üretimi",
          __ui_state: "ready",
          __audio_src: st.audio.src,
          audio: { src: st.audio.src },
          mp3_url: st.audio.src,
          output_id: st.output_id,
          internal_job_id: st.internal_job_id,
          __provider_job: true,
          __provider_job_id: provider_job_id,
          __internal_job_id: st.internal_job_id,
        });
      }
    } catch (e) {
      console.warn("[music.generate] status poll failed:", e);
    }
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
