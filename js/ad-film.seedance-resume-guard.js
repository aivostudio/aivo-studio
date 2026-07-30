/* AIVO AI Ad Film — block automatic finalization/resume of completed projects.
   The Seedance engine may resume only jobs that are genuinely queued/processing.
   A completed source video must never trigger finalization merely because the
   module mounted, the page was restored, or a project-sync event fired. */
(function AIVO_AD_FILM_SEEDANCE_RESUME_GUARD(){
  "use strict";
  if(window.__AIVO_AD_FILM_SEEDANCE_RESUME_GUARD_V2__)return;
  window.__AIVO_AD_FILM_SEEDANCE_RESUME_GUARD_V2__=true;

  function clean(value){return String(value==null?"":value).trim().toLowerCase()}
  function projectFromEvent(event){
    return event&&event.detail&&event.detail.project||window.AIVOAdFilmActiveProject||null;
  }
  function generationStatus(project){return clean(project&&project.generation&&project.generation.status)}
  function finalizationStatus(project){return clean(project&&project.finalization&&project.finalization.status)}
  function avatarStatus(project){return clean(project&&project.avatar&&project.avatar.pipeline&&project.avatar.pipeline.status)}
  function resumable(project){
    var generation=generationStatus(project);
    var finalization=finalizationStatus(project);
    var avatar=avatarStatus(project);
    if(generation==="queued"||generation==="processing")return true;
    if(finalization==="processing"||finalization.indexOf("waiting_")===0)return true;
    if(avatar&&avatar!=="completed"&&avatar!=="failed"&&avatar!=="idle")return true;
    return false;
  }
  function looksLikeSeedanceResume(listener){
    if(typeof listener!=="function")return false;
    var source="";
    try{source=Function.prototype.toString.call(listener)}catch(_){}
    return source.indexOf("resume(")>=0&&source.indexOf("adfilm")>=0;
  }

  var nativeAdd=document.addEventListener.bind(document);
  document.addEventListener=function(type,listener,options){
    if(looksLikeSeedanceResume(listener)&&(type==="aivo:module-mounted"||type==="aivo:adfilm-project-sync")){
      var original=listener;
      listener=function(event){
        if(type==="aivo:module-mounted"&&!(event&&event.detail&&event.detail.key==="adfilm")){
          return original.apply(this,arguments);
        }
        var project=projectFromEvent(event);
        if(project&&!resumable(project))return;
        return original.apply(this,arguments);
      };
    }
    return nativeAdd(type,listener,options);
  };

  window.AIVOAdFilmResumeGuard={
    resumable:resumable,
    generationStatus:generationStatus,
    finalizationStatus:finalizationStatus,
    avatarStatus:avatarStatus
  };
})();
