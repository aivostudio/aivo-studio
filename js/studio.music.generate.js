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
    // ✅ confirmed working endpoint
    const payload = { prompt, mode: "instrumental" };

    const res = await fetch("/api/music/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    // API bazen JSON, bazen text olabilir; ikisini de yakala
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

      // UI'de prompt'u sakla
      window.__LAST_PROMPT__ = prompt;

      // RightPanel aç (varsa)
      if (window.RightPanel?.force) {
        try { window.RightPanel.force("music"); } catch {}
      }

      // ✅ 1) Önce direkt API'yi dene (asıl doğru yol)
      let result = null;
      try {
        result = await callGenerateAPI(prompt);
      } catch (apiErr) {
        console.warn("[music.generate] /api/music/generate failed, fallback to svc if any:", apiErr);

        // ✅ 2) Fallback: eski service yolunu dene (varsa)
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

      // result normalize
      const job_id =
        result?.job_id ||
        result?.jobId ||
        result?.internal_job_id ||   // ✅ FIX: backend bunu dönüyor
        result?.id ||
        result?.data?.job_id ||
        null;

      if (!job_id){
        console.warn("[music.generate] generate response:", result);
        toastError("Job oluşturuldu ama job_id gelmedi.");
        return;
      }

      // ✅ DEBUG + provider job ayrımı (kritik)
      window.__LAST_MUSIC_GENERATE_RESPONSE__ = result;
      console.log("[music.generate] FULL_RESPONSE:", result);

      const isProviderJob = String(job_id).startsWith("job_");
      const jobType = isProviderJob ? "music_provider" : "music";

      toastSuccess("Müzik üretimi başladı 🎵");

      // 1) Panel'e job event gönder
      dispatchJob({
        type: jobType,
        kind: jobType,
        job_id: job_id,
        id: job_id,
        status: result?.status || "queued",
        title: isProviderJob ? "Müzik Üretimi (Queue)" : "Müzik Üretimi",
        __ui_state: "processing",
        __audio_src: "",
        __provider_job: isProviderJob ? true : false,
      });

      // 2) AIVO_JOBS store (varsa)
      try {
        if (window.AIVO_JOBS?.upsert) {
          window.AIVO_JOBS.upsert({
            type: jobType,
            kind: jobType,
            job_id: job_id,
            id: job_id,
            status: result?.status || "queued",
            title: isProviderJob ? "Müzik Üretimi (Queue)" : "Müzik Üretimi",
            createdAt: new Date().toISOString(),
            __provider_job: isProviderJob ? true : false,
          });
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

    // aynı butona tekrar tekrar bağlama
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

  // router / re-render durumları için sürekli kontrol
  setInterval(bind, 500);

  // ilk yükleme
  window.addEventListener("DOMContentLoaded", bind);
  window.addEventListener("load", bind);

})();
