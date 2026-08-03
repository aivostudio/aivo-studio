/* AIVO AI Reklam Filmi — Seedance-only finalizer */
(function AIVO_AD_FILM_FINALIZE_OUTPUT(){
  "use strict";
  if(window.__AIVO_AD_FILM_FINALIZE_OUTPUT_V14__)return;
  window.__AIVO_AD_FILM_FINALIZE_OUTPUT_V14__=true;

  function clean(value){return String(value==null?"":value).trim()}

  async function run(){
    if(window.AIVOAdFilmSeedanceFinalizing)return;
    var project=window.AIVOAdFilmActiveProject;
    if(!project||!project.id)return;
    var generation=project.generation||{};
    var outputId=clean(generation.outputId||generation.requestId);
    if(!outputId)return;

    window.AIVOAdFilmSeedanceFinalizing=true;
    try{
      var response=await fetch("/api/ad-film/seedance/finalize",{
        method:"POST",
        credentials:"include",
        cache:"no-store",
        headers:{"Content-Type":"application/json",Accept:"application/json"},
        body:JSON.stringify({projectId:project.id,outputId:outputId})
      });
      var data=await response.json().catch(function(){return{}});
      if(!response.ok||!data.project||!clean(data.video_url)){
        throw new Error(clean(data.message||data.error)||"finalize_failed");
      }

      window.AIVOAdFilmActiveProject=data.project;
      window.AIVOAdFilmGeneratedVideo=data.video_url;
      window.AIVOAdFilmActiveOutputId=clean(data.outputId||data.activeOutputId||data.project.activeOutputId||outputId);

      document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{
        detail:{project:data.project,projectId:data.project.id||project.id,media:data.project.media||{}}
      }));

      if(window.AIVOAdFilmResultControls&&typeof window.AIVOAdFilmResultControls.mount==="function"){
        window.AIVOAdFilmResultControls.mount(data.video_url,"",{
          projectId:data.project.id||project.id,
          outputId:window.AIVOAdFilmActiveOutputId,
          logoApplied:!!data.logo_applied,
          play:false,
          source:"seedance-final-output"
        });
      }
      if(window.AIVOAdFilmOutputGallery&&typeof window.AIVOAdFilmOutputGallery.render==="function"){
        window.AIVOAdFilmOutputGallery.render(data.project);
      }
      if(window.AIVOAdFilmOutputWorkflow&&typeof window.AIVOAdFilmOutputWorkflow.render==="function"){
        window.AIVOAdFilmOutputWorkflow.render(data.project);
      }
    }catch(error){
      console.warn("[ADFILM] manual final output",error);
    }finally{
      window.AIVOAdFilmSeedanceFinalizing=false;
    }
  }

  window.AIVOAdFilmFinalizeOutput={run:run};
})();
