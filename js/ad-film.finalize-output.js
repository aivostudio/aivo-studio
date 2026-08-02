/* AIVO AI Reklam Filmi — legacy finalizer compatibility */
(function AIVO_AD_FILM_FINALIZE_OUTPUT(){
  "use strict";
  if(window.__AIVO_AD_FILM_FINALIZE_OUTPUT_V8__)return;
  window.__AIVO_AD_FILM_FINALIZE_OUTPUT_V8__=true;

  function loadOnce(path,version){
    var selector='script[src^="'+path+'"]';
    var existing=document.querySelector(selector);
    if(existing){
      var expected=path+"?v="+version;
      if(existing.getAttribute("src")===expected)return;
      existing.remove();
    }
    var script=document.createElement("script");
    script.src=path+"?v="+version;
    script.async=false;
    document.head.appendChild(script);
  }

  /* These lifecycle files must always be present. The bridge advances the
     Seedance -> native avatar -> final composite chain. The final-output sync
     mounts only completed outputs. The UI guard prevents source-only videos
     from entering the main player or Ready Videos while production is active. */
  loadOnce("/js/ad-film.avatar-finalization-bridge.js","7");
  loadOnce("/js/ad-film.final-output-sync.js","3");
  loadOnce("/js/ad-film.final-output-ui-guard.js","1");

  /* Seedance Engine owns the normal lifecycle. Keep this public API as a
     safe manual bridge without installing a competing automatic listener. */
  async function run(){
    if(window.AIVOAdFilmSeedanceFinalizing)return;
    var project=window.AIVOAdFilmActiveProject;
    if(!project||!project.id)return;
    var generation=project.generation||{};
    var outputId=generation.outputId||generation.requestId||"";
    if(!outputId)return;
    window.AIVOAdFilmSeedanceFinalizing=true;
    try{
      var response=await fetch("/api/ad-film/seedance/finalize",{method:"POST",credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectId:project.id,outputId:outputId})});
      var data=await response.json().catch(function(){return{}});
      if(!response.ok||!data.ok||!data.project)throw new Error(data.message||data.error||"finalize_failed");
      window.AIVOAdFilmActiveProject=data.project;
      window.AIVOAdFilmGeneratedVideo=data.video_url||"";
      document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:data.project,projectId:data.project.id||"",media:data.project.media||{}}}));
      if(window.AIVOAdFilmResultControls&&typeof window.AIVOAdFilmResultControls.mount==="function")window.AIVOAdFilmResultControls.mount(data.video_url,"",{projectId:data.projectId,outputId:data.outputId,logoApplied:!!data.logo_applied,play:false,source:"final-output"});
      if(window.AIVOAdFilmLivePreviewState&&typeof window.AIVOAdFilmLivePreviewState.sync==="function")window.AIVOAdFilmLivePreviewState.sync(data.project);
      if(window.AIVOAdFilmOutputGallery&&typeof window.AIVOAdFilmOutputGallery.render==="function")window.AIVOAdFilmOutputGallery.render(data.project);
      if(window.AIVOAdFilmOutputWorkflow&&typeof window.AIVOAdFilmOutputWorkflow.render==="function")window.AIVOAdFilmOutputWorkflow.render(data.project);
    }catch(error){console.warn("[ADFILM] manual final output",error)}
    finally{window.AIVOAdFilmSeedanceFinalizing=false}
  }

  window.AIVOAdFilmFinalizeOutput={run:run};
})();
