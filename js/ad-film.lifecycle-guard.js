/* AIVO AI Reklam Filmi — single lifecycle guard for stale avatar/finalize jobs. */
(function AIVO_AD_FILM_LIFECYCLE_GUARD(){
  "use strict";
  if(window.__AIVO_AD_FILM_LIFECYCLE_GUARD_V1__)return;
  window.__AIVO_AD_FILM_LIFECYCLE_GUARD_V1__=true;

  var nativeAdd=document.addEventListener.bind(document);
  var nativeFetch=window.fetch.bind(window);
  var terminalizing=new Set();
  var safeResumeTimer=null;
  var ACTIVE_PIPELINE=["motion_queued","motion_processing","lipsync_queued","lipsync_processing"];
  var MAX_PIPELINE_AGE=45*60*1000;

  function clean(value){return String(value==null?"":value).trim()}
  function lower(value){return clean(value).toLowerCase()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function current(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
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
  function generationState(source){return lower(source&&source.generation&&source.generation.status||source&&source.status)}
  function blocked(source){
    var state=pipelineState(source),generation=generationState(source);
    if(state==="failed"||state==="stale")return true;
    if(state==="active"&&(generation==="failed"||generation==="cancelled"))return true;
    return false;
  }

  function releaseUi(){
    var scope=root();if(!scope)return;
    window.AIVOAdFilmSeedanceFinalizing=false;
    window.AIVOAdFilmFinalizationPending=null;
    var action=scope.querySelector(".adfilm-actionbar");if(action)action.classList.remove("is-engine-active");
    var button=scope.querySelector("[data-adfilm-build]");
    if(button){
      button.classList.remove("is-generating");
      button.disabled=button.dataset.narrationGuard==="blocked";
      var label=button.querySelector('span[data-adfilm-i18n="createButton"]')||button.querySelector("span:not(.adfilm-create__icon)");
      if(label)label.textContent=english()?"Create Advertising Film":"Reklam Filmini Oluştur";
    }
    var status=scope.querySelector("[data-adfilm-engine-status]");
    if(status){status.setAttribute("data-adfilm-idle-hidden","1");status.classList.remove("is-visible","is-success","is-error","is-busy")}
    var summary=scope.querySelector('.adfilm-actionbar__summary [data-adfilm-i18n="readyTitle"]');
    if(summary)summary.textContent=english()?"Advertising project will be prepared":"Reklam projesi hazırlanacak";
  }

  function terminalize(source,reason){
    if(!source||!source.id)return;
    var generation=generationState(source);
    if(["queued","processing","completed"].indexOf(generation)<0)return;
    var key=source.id+"|"+clean(source.avatar&&source.avatar.pipeline&&source.avatar.pipeline.startedAt)+"|"+reason;
    if(terminalizing.has(key))return;
    terminalizing.add(key);
    nativeFetch("/api/ad-film/seedance/cancel",{
      method:"POST",credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({projectId:source.id,mode:"failed",reason:reason})
    }).then(function(response){return response.json().catch(function(){return{}})}).then(function(data){
      var active=current();
      if(!data.project||!active||clean(active.id)!==clean(source.id))return;
      window.AIVOAdFilmActiveProject=data.project;
      document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:data.project,projectId:data.project.id||source.id,media:data.project.media||{}}}));
    }).catch(function(error){console.warn("[ADFILM] terminalize stale lifecycle",error)});
  }
  function stopIfBlocked(source){
    if(!blocked(source))return false;
    var state=pipelineState(source);
    releaseUi();
    terminalize(source,state==="stale"?"avatar_pipeline_stale":"avatar_pipeline_failed");
    return true;
  }

  function sourceOf(listener){try{return Function.prototype.toString.call(listener)}catch(_){return""}}
  function isSeedanceProjectSync(source){return source.indexOf("bind(scope)")>=0&&source.indexOf("resume(scope")>=0}
  function isAvatarProjectSync(source){return source.indexOf("holdGeneration(next)")>=0&&source.indexOf("resume(scope,next)")>=0}
  function isSeedanceMount(source){return source.indexOf("resume(event.detail.root")>=0&&source.indexOf("AIVOAdFilmActiveProject")>=0}
  function isAvatarMount(source){return source.indexOf("holdGeneration(project())")>=0&&source.indexOf("resume(event.detail.root")>=0}

  function scheduleSafeResume(){
    clearTimeout(safeResumeTimer);
    safeResumeTimer=setTimeout(function(){
      var source=current();
      if(!source||stopIfBlocked(source))return;
      document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:source,projectId:source.id||"",media:source.media||{}}}));
    },1250);
  }

  document.addEventListener=function(type,listener,options){
    if(typeof listener!=="function")return nativeAdd(type,listener,options);
    var source=sourceOf(listener);

    if(type==="aivo:module-mounted"&&(isSeedanceMount(source)||isAvatarMount(source))){
      return nativeAdd(type,function(event){
        if(event&&event.detail&&event.detail.key==="adfilm")scheduleSafeResume();
      },options);
    }

    if(type==="aivo:adfilm-project-sync"&&(isSeedanceProjectSync(source)||isAvatarProjectSync(source))){
      var original=listener;
      return nativeAdd(type,function(event){
        var next=event&&event.detail&&event.detail.project||current();
        if(stopIfBlocked(next))return;
        if(isSeedanceProjectSync(source)&&finalized(next)&&sameMountedVideo(next))return;
        return original.apply(this,arguments);
      },options);
    }

    return nativeAdd(type,listener,options);
  };

  nativeAdd("aivo:adfilm-avatar-failed",function(event){
    var source=event&&event.detail&&event.detail.project||current();
    releaseUi();
    terminalize(source,"avatar_pipeline_failed");
  },true);
  nativeAdd("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(function(){stopIfBlocked(current())},550)},true);
  window.addEventListener("pageshow",function(){setTimeout(function(){stopIfBlocked(current())},700)});
  window.addEventListener("pagehide",function(){clearTimeout(safeResumeTimer)});

  function normalizeVideo(video){
    if(!video||!video.matches||!video.matches('video[data-adfilm-result-video]'))return;
    video.autoplay=false;video.removeAttribute("autoplay");video.controls=false;video.removeAttribute("controls");
    if(!video.dataset.aivoLifecycleGuardReady){video.dataset.aivoLifecycleGuardReady="1";try{video.pause()}catch(_){}}
  }
  var observer=new MutationObserver(function(mutations){mutations.forEach(function(mutation){Array.from(mutation.addedNodes||[]).forEach(function(node){if(!node||node.nodeType!==1)return;if(node.matches&&node.matches('video[data-adfilm-result-video]'))normalizeVideo(node);if(node.querySelectorAll)node.querySelectorAll('video[data-adfilm-result-video]').forEach(normalizeVideo)})})});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  var existing=currentVideo();if(existing)normalizeVideo(existing);
})();
