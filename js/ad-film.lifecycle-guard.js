/* AIVO AI Reklam Filmi — safe resume guard; never cancels a newly started job. */
(function AIVO_AD_FILM_LIFECYCLE_GUARD(){
  "use strict";
  if(window.__AIVO_AD_FILM_LIFECYCLE_GUARD_V2__)return;
  window.__AIVO_AD_FILM_LIFECYCLE_GUARD_V2__=true;

  var nativeAdd=document.addEventListener.bind(document);
  var ACTIVE_PIPELINE=["motion_queued","motion_processing","lipsync_queued","lipsync_processing"];
  var MAX_PIPELINE_AGE=45*60*1000;

  function clean(value){return String(value==null?"":value).trim()}
  function lower(value){return clean(value).toLowerCase()}
  function current(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function outputOf(source){
    source=source||{};
    var outputs=Array.isArray(source.outputs)?source.outputs.filter(function(item){return item&&clean(item.videoUrl)}):[];
    var id=clean(source.activeOutputId||source.generation&&source.generation.outputId||window.AIVOAdFilmActiveOutputId);
    return outputs.find(function(item){return clean(item.id)===id})||outputs[0]||null;
  }
  function projectVideo(source){var item=outputOf(source);return clean(item&&item.videoUrl||source&&source.generation&&source.generation.videoUrl)}
  function currentVideo(){return document.querySelector('.rpPanelWrap[data-panel-key="adfilm"] [data-panel-frame] video[data-adfilm-result-video]')}
  function stableUrl(value){
    value=clean(value);if(!value)return"";
    try{var parsed=new URL(value,location.href);return parsed.origin+parsed.pathname}
    catch(_){return value.split("?")[0].split("#")[0]}
  }
  function sameMountedVideo(source){var video=currentVideo(),next=projectVideo(source);return!!(video&&next&&stableUrl(video.currentSrc||video.src)===stableUrl(next))}
  function finalized(source){var item=outputOf(source),generation=source&&source.generation||{};return Number(item&&item.mixVersion||generation.mixVersion||0)>=4&&!!projectVideo(source)}
  function generationState(source){return lower(source&&source.generation&&source.generation.status||source&&source.status)}
  function generationActive(source){return["queued","processing"].indexOf(generationState(source))>=0}

  function pipelineState(source){
    var avatar=source&&source.avatar;
    var pipeline=avatar&&avatar.pipeline;
    if(!avatar||avatar.enabled!==true||!pipeline)return"none";
    var status=lower(pipeline.status);
    if(status==="failed")return"failed";
    if(status==="completed")return clean(pipeline.videoUrl||avatar.videoUrl)?"completed":"failed";
    if(ACTIVE_PIPELINE.indexOf(status)>=0){
      var started=Date.parse(pipeline.startedAt||pipeline.submittedAt||pipeline.updatedAt||"");
      if(!Number.isFinite(started)||Date.now()-started>MAX_PIPELINE_AGE)return"stale";
      return"active";
    }
    return status?"stale":"none";
  }

  function sourceOf(listener){try{return Function.prototype.toString.call(listener)}catch(_){return""}}
  function isSeedanceProjectSync(source){return source.indexOf("bind(scope)")>=0&&source.indexOf("resume(scope")>=0}
  function isAvatarProjectSync(source){return source.indexOf("holdGeneration(next)")>=0&&source.indexOf("resume(scope,next)")>=0}
  function isSeedanceMount(source){return source.indexOf("resume(event.detail.root")>=0&&source.indexOf("AIVOAdFilmActiveProject")>=0}
  function isAvatarMount(source){return source.indexOf("holdGeneration(project())")>=0&&source.indexOf("resume(event.detail.root")>=0}

  function suppressSeedanceResume(source){
    if(!source)return true;
    if(generationActive(source))return false;
    if(finalized(source)&&sameMountedVideo(source))return true;
    var state=pipelineState(source);
    return (state==="failed"||state==="stale")&&generationState(source)==="completed";
  }
  function suppressAvatarResume(source){
    var state=pipelineState(source);
    return state!=="active";
  }

  document.addEventListener=function(type,listener,options){
    if(typeof listener!=="function")return nativeAdd(type,listener,options);
    var source=sourceOf(listener);

    if(type==="aivo:module-mounted"&&(isSeedanceMount(source)||isAvatarMount(source))){
      var mountOriginal=listener;
      return nativeAdd(type,function(event){
        if(!event||!event.detail||event.detail.key!=="adfilm")return mountOriginal.apply(this,arguments);
        var project=current();
        if(isSeedanceMount(source)&&suppressSeedanceResume(project))return;
        if(isAvatarMount(source)&&suppressAvatarResume(project))return;
        return mountOriginal.apply(this,arguments);
      },options);
    }

    if(type==="aivo:adfilm-project-sync"&&(isSeedanceProjectSync(source)||isAvatarProjectSync(source))){
      var syncOriginal=listener;
      return nativeAdd(type,function(event){
        var next=event&&event.detail&&event.detail.project||current();
        if(isSeedanceProjectSync(source)&&suppressSeedanceResume(next))return;
        if(isAvatarProjectSync(source)&&suppressAvatarResume(next))return;
        return syncOriginal.apply(this,arguments);
      },options);
    }

    return nativeAdd(type,listener,options);
  };

  nativeAdd("aivo:adfilm-avatar-failed",function(event){
    var source=event&&event.detail&&event.detail.project||current();
    console.warn("[ADFILM] avatar pipeline failed; Seedance job was not cancelled",source&&source.avatar&&source.avatar.pipeline&&source.avatar.pipeline.error||"");
  },true);

  function normalizeVideo(video){
    if(!video||!video.matches||!video.matches('video[data-adfilm-result-video]'))return;
    video.autoplay=false;video.removeAttribute("autoplay");video.controls=false;video.removeAttribute("controls");
    if(!video.dataset.aivoLifecycleGuardReady){video.dataset.aivoLifecycleGuardReady="1";try{video.pause()}catch(_){}}
  }
  var observer=new MutationObserver(function(mutations){mutations.forEach(function(mutation){Array.from(mutation.addedNodes||[]).forEach(function(node){if(!node||node.nodeType!==1)return;if(node.matches&&node.matches('video[data-adfilm-result-video]'))normalizeVideo(node);if(node.querySelectorAll)node.querySelectorAll('video[data-adfilm-result-video]').forEach(normalizeVideo)})})});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  var existing=currentVideo();if(existing)normalizeVideo(existing);
})();
