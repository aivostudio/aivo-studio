/* AIVO AI Ad Film — block automatic finalization/resume of terminal projects.
   Only genuinely active jobs may resume after module mount, page restore or
   project-sync. Failed productions must remain failed until the user starts a
   new production explicitly. */
(function AIVO_AD_FILM_SEEDANCE_RESUME_GUARD(){
  "use strict";
  if(window.__AIVO_AD_FILM_SEEDANCE_RESUME_GUARD_V3__)return;
  window.__AIVO_AD_FILM_SEEDANCE_RESUME_GUARD_V3__=true;

  function clean(value){return String(value==null?"":value).trim().toLowerCase()}
  function projectFromEvent(event){
    return event&&event.detail&&event.detail.project||window.AIVOAdFilmActiveProject||null;
  }
  function projectStatus(project){return clean(project&&project.status)}
  function generationStatus(project){return clean(project&&project.generation&&project.generation.status)}
  function finalizationStatus(project){return clean(project&&project.finalization&&project.finalization.status)}
  function avatarStatus(project){return clean(project&&project.avatar&&project.avatar.pipeline&&project.avatar.pipeline.status)}
  function terminalFailure(project){
    var status=projectStatus(project);
    var generation=generationStatus(project);
    var finalization=finalizationStatus(project);
    if(status==="failed"||status==="error"||status==="cancelled"||status==="canceled")return true;
    if(generation==="failed"||generation==="error"||generation==="cancelled"||generation==="canceled")return true;
    if(finalization==="failed"||finalization==="error"||finalization==="cancelled"||finalization==="canceled")return true;
    return false;
  }
  function normalizeTerminalProject(project){
    if(!project||!terminalFailure(project))return project;
    var avatar=project.avatar&&project.avatar.pipeline;
    var reason=clean(project&&project.generation&&project.generation.error||avatar&&avatar.error||project.error||"production_failed");
    project.status="failed";
    if(project.generation){
      project.generation=Object.assign({},project.generation,{
        status:"failed",
        avatarWaiting:false,
        finalizing:false,
        error:reason||"production_failed"
      });
    }
    return project;
  }
  function resumable(project){
    project=normalizeTerminalProject(project);
    if(!project||terminalFailure(project))return false;
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
        var project=normalizeTerminalProject(projectFromEvent(event));
        if(event&&event.detail&&project)event.detail.project=project;
        if(project)window.AIVOAdFilmActiveProject=project;
        if(project&&!resumable(project))return;
        return original.apply(this,arguments);
      };
    }
    return nativeAdd(type,listener,options);
  };

  window.AIVOAdFilmResumeGuard={
    resumable:resumable,
    terminalFailure:terminalFailure,
    normalizeTerminalProject:normalizeTerminalProject,
    projectStatus:projectStatus,
    generationStatus:generationStatus,
    finalizationStatus:finalizationStatus,
    avatarStatus:avatarStatus
  };
})();
