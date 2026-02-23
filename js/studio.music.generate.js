/* ==========================================================
   AIVO Studio – Music Generate (TopMediai)
   File: /js/studio.music.generate.js
   ========================================================== */
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

  async function callTopMediaCreate(prompt){
    const payload = {
      prompt,
      // İstersen sonra lyrics/title/model ekleriz ama şimdilik en minimal + stabil.
      use_credits: true,
      charge: true,
      credits: 5,
      cost: 5,
    };

    const res = await fetch("/api/providers/topmediai/music/create", {
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
      throw new Error("topmediai_create_failed:" + errMsg);
    }

    return data;
  }

  async function pollTopMediaStatus(idsCsv, onDone){
    const pollIntervalMs = 1500;

    const timer = setInterval(async () => {
      try {
        const r = await fetch(
          `/api/providers/topmediai/music/status?ids=${encodeURIComponent(idsCsv)}`
        );
        const st = await r.json();

        console.log("[music.generate] poll status:", st);

        if (st?.state === "COMPLETED" && st?.audio?.src) {
          clearInterval(timer);
          onDone(st);
        }

        if (st?.state === "FAILED") {
          clearInterval(timer);
          toastError("TopMediai üretim başarısız (FAILED).");
        }
      } catch (e) {
        console.warn("[music.generate] status poll failed:", e);
      }
    }, pollIntervalMs);

    return timer;
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

      // ✅ 1) TopMediai create
      const result = await callTopMediaCreate(prompt);

      const provider_song_ids = Array.isArray(result?.provider_song_ids)
        ? result.provider_song_ids.map(String).filter(Boolean)
        : [];

      const provider_job_id = String(result?.provider_job_id || provider_song_ids[0] || "").trim();

      if (!provider_job_id || provider_song_ids.length === 0){
        console.warn("[music.generate] create response:", result);
        toastError("TopMediai job oluşturuldu ama provider_song_ids gelmedi.");
        return;
      }

      const idsCsv = provider_song_ids.join(",");

      // DEBUG
      window.__LAST_MUSIC_GENERATE_RESPONSE__ = result;
      window.__LAST_MUSIC_PROVIDER_JOB_ID__ = provider_job_id;
      window.__LAST_MUSIC_PROVIDER_SONG_IDS__ = provider_song_ids;

      console.log("[music.generate] FULL_RESPONSE:", result);
      console.log("[music.generate] provider ids:", provider_song_ids);

      toastSuccess("Müzik üretimi başladı 🎵");

      // ✅ 2) Panel'e "processing" job bas
      dispatchJob({
        type: "music",
        kind: "music",

        job_id: provider_job_id,
        id: provider_job_id,

        status: "processing",
        state: "PROCESSING",
        title: "Müzik Üretimi",

        __ui_state: "processing",
        __audio_src: "",

        provider: "topmediai",
        provider_job_id,
        provider_song_ids,
        __ids_csv: idsCsv,

        createdAt: new Date().toISOString(),
      });

      // ✅ 3) Store upsert (varsa)
      try {
        if (window.AIVO_JOBS?.upsert) {
          window.AIVO_JOBS.upsert({
            type: "music",
            kind: "music",
            job_id: provider_job_id,
            id: provider_job_id,
            status: "PROCESSING",
            state: "PROCESSING",
            title: "Müzik Üretimi",
            createdAt: new Date().toISOString(),
            provider: "topmediai",
            provider_job_id,
            provider_song_ids,
            __ids_csv: idsCsv,
          });
        }
      } catch(e) {
        console.warn("[music.generate] AIVO_JOBS.upsert failed:", e);
      }

      // ✅ 4) Poll → COMPLETED olunca UI update dispatch
      await pollTopMediaStatus(idsCsv, (st) => {
        dispatchJob({
          type: "music",
          kind: "music",

          job_id: provider_job_id,
          id: provider_job_id,

          status: "completed",
          state: "COMPLETED",
          title: "Müzik Üretimi",

          __ui_state: "ready",
          __audio_src: st?.audio?.src || "",

          provider: "topmediai",
          provider_job_id,
          provider_song_ids,
          __ids_csv: idsCsv,

          audio: st?.audio?.src ? { src: st.audio.src } : null,
          mp3_url: st?.audio?.src || null,
        });
      });

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
