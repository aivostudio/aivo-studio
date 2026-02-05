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

      // generateMusic çağır
      const svc =
        window.StudioServices ||
        window.AIVO_SERVICES ||
        window.AIVO_APP ||
        null;

      let result = null;

      if (svc?.generateMusic && typeof svc.generateMusic === "function"){
        result = await svc.generateMusic({ prompt });
      }
      else if (window.generateMusic && typeof window.generateMusic === "function"){
        result = await window.generateMusic({ prompt });
      }
      else {
        toastError("generateMusic fonksiyonu bulunamadı (studio.services.js çalışmıyor).");
        return;
      }

      // result normalize
      const job_id =
        result?.job_id ||
        result?.jobId ||
        result?.id ||
        result?.data?.job_id ||
        null;

      if (!job_id){
        console.warn("[music.generate] generate response:", result);
        toastError("Job oluşturuldu ama job_id gelmedi.");
        return;
      }

      toastSuccess("Müzik üretimi başladı 🎵");

      // Panel'e job event gönder
      dispatchJob({
        type: "music",
        job_id: job_id,
        title: "Müzik Üretimi",
        __ui_state: "processing",
        __audio_src: ""
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
