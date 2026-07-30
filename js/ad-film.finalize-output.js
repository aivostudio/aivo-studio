/* AIVO AI Reklam Filmi — legacy finalizer compatibility */
(function AIVO_AD_FILM_FINALIZE_OUTPUT(){
  "use strict";
  if(window.__AIVO_AD_FILM_FINALIZE_OUTPUT_V5__)return;
  window.__AIVO_AD_FILM_FINALIZE_OUTPUT_V5__=true;

  /* Seedance Engine V2 owns the complete lifecycle now: source video stays
     hidden, final audio/music/logo processing runs once, and only the finished
     video is mounted. Keep this legacy public API as a safe manual bridge, but
     do not install automatic listeners that could race the primary engine. */
  async function run(){
    if(window.AIVOAdFilmSeedanceFinalizing)return;
    var project=window.AIVOAdFilmActiveProject;
    if(!project||!project.id)return;
    var generation=project.generation||{};
    var outputId=project.activeOutputId||generation.outputId||generation.requestId||"";
    if(!outputId)return;
    window.AIVOAdFilmSeedanceFinalizing=true;
    try{
      var response=await fetch("/api/ad-film/seedance/finalize",{method:"POST",credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectId:project.id,outputId:outputId})});
      var data=await response.json().catch(function(){return{}});
      if(!response.ok||!data.ok||!data.project)throw new Error(data.message||data.error||"finalize_failed");
      window.AIVOAdFilmActiveProject=data.project;
      window.AIVOAdFilmGeneratedVideo=data.video_url||"";
      document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:data.project,projectId:data.project.id||"",media:data.project.media||{}}}));
      if(window.AIVOAdFilmResultControls&&typeof window.AIVOAdFilmResultControls.mount==="function")window.AIVOAdFilmResultControls.mount(data.video_url,"",{projectId:data.projectId,outputId:data.outputId,logoApplied:!!data.logo_applied,play:false});
    }catch(error){console.warn("[ADFILM] manual final output",error)}
    finally{window.AIVOAdFilmSeedanceFinalizing=false}
  }

  window.AIVOAdFilmFinalizeOutput={run:run};
})();
