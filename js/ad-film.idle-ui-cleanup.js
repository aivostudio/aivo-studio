/* AIVO AI Reklam Filmi — clean idle/new-project UI without touching active production */
(function AIVO_AD_FILM_IDLE_UI_CLEANUP(){
  "use strict";
  if(window.__AIVO_AD_FILM_IDLE_UI_CLEANUP_V4__)return;
  window.__AIVO_AD_FILM_IDLE_UI_CLEANUP_V4__=true;

  var LATCH_KEY="__AIVO_AD_FILM_PRODUCTION_UI_LATCH__";
  var finalizeFlights=new Map();
  var completionToasts=new Set();
  var observer=null;

  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function textValue(value){return String(value==null?"":value).trim()}
  function clean(value){return textValue(value).toLowerCase()}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function copy(tr,en){return english()?en:tr}
  function generation(source){return source&&source.generation||{}}
  function pipeline(source){return source&&source.avatar&&source.avatar.pipeline||{}}
  function projectId(source){return textValue(source&&source.id||root()&&root().dataset.adfilmProjectId)}
  function outputId(source){var gen=generation(source);return textValue(gen.outputId||gen.requestId)}
  function validUrl(value){return /^https:\/\//i.test(textValue(value))}
  function pipelineVideo(source){var pipe=pipeline(source);return textValue(pipe.videoUrl||pipe.lipsync&&pipe.lipsync.videoUrl)}
  function latchActive(){
    var value=window[LATCH_KEY];
    if(!value||typeof value!=="object")return false;
    if(Number(value.until||0)<=Date.now()){try{delete window[LATCH_KEY]}catch(_){window[LATCH_KEY]=null}return false}
    return true;
  }
  function uiLocked(){
    var scope=root();if(!scope)return false;
    var action=scope.querySelector('.adfilm-actionbar');
    var button=scope.querySelector('[data-adfilm-build]');
    if(latchActive())return true;
    if(action&&action.getAttribute('data-adfilm-progress-lock')==='1')return true;
    if(button&&(
      button.classList.contains('is-generating')||
      button.classList.contains('is-loading')||
      button.classList.contains('is-music-preparing')||
      button.getAttribute('aria-busy')==='true'||
      button.hasAttribute('data-adfilm-loader-pending')
    ))return true;
    return false;
  }
  function finalOutput(source){
    var gen=generation(source),id=outputId(source),started=Date.parse(gen.startedAt||"");
    var list=Array.isArray(source&&source.outputs)?source.outputs:[];
    return list.find(function(item){
      if(!item||!validUrl(item.videoUrl))return false;
      var final=Number(item.mixVersion||0)>=4||item.finalizedAt||item.hybridTimeline===true||item.avatarApplied===true||item.avatarIntegrated===true;
      if(!final)return false;
      var production=textValue(gen.productionId||gen.input&&gen.input.productionId||source&&source.productionPlan&&source.productionPlan.productionId);
      var itemProduction=textValue(item.productionId||item.production_id||item.input&&item.input.productionId);
      if(itemProduction)return Boolean(production&&itemProduction===production);
      if(textValue(item.id)!==id)return false;
      var completed=Date.parse(item.completedAt||item.finalizedAt||item.createdAt||"");
      return !Number.isFinite(started)||!Number.isFinite(completed)||completed>=started-5000;
    })||null;
  }
  function isRunning(source){
    var status=clean(source&&source.generation&&source.generation.status);
    var scope=root(),button=scope&&scope.querySelector('[data-adfilm-build]');
    return latchActive()||status==="queued"||status==="processing"||status==="running"||status==="in_queue"||!!(button&&(
      button.classList.contains("is-generating")||button.getAttribute("aria-busy")==="true"
    ));
  }
  function defaultTitle(){return copy("Reklam projesi hazırlanacak","Advertising project will be prepared")}
  function notifyReady(source){
    var key=projectId(source)+"|"+outputId(source);if(!key||completionToasts.has(key))return;
    completionToasts.add(key);
    try{
      var message=copy("Reklam filminiz hazır.","Your advertising film is ready.");
      if(window.toast&&typeof window.toast.success==="function")window.toast.success({message:message,duration:4200});
      else if(typeof window.showToast==="function")window.showToast(message,"success");
    }catch(_){}
  }
  function syncProject(next){
    if(!next)return;
    window.AIVOAdFilmActiveProject=next;
    document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:next,projectId:next.id||"",media:next.media||{}}}));
  }
  function clearIntermediatePreview(source){
    var raw=pipelineVideo(source);if(!raw)return;
    var controls=window.AIVOAdFilmResultControls;
    var current=controls&&typeof controls.videoUrl==="function"?textValue(controls.videoUrl()):textValue(window.AIVOAdFilmGeneratedVideo);
    function stable(value){try{var url=new URL(value,location.href);return url.origin+url.pathname}catch(_){return textValue(value).split("?")[0]}}
    if(current&&stable(current)===stable(raw)&&controls&&typeof controls.clear==="function"){
      controls.clear(false);
      window.AIVOAdFilmGeneratedVideo="";
    }
  }
  function shouldFinalize(source){
    if(!source||source.avatar&&source.avatar.enabled!==true||finalOutput(source))return false;
    var gen=generation(source),pipe=pipeline(source);
    return clean(pipe.status)==="completed"&&validUrl(pipelineVideo(source))&&
      validUrl(gen.sourceVideoUrl||gen.videoUrl)&&
      (gen.awaitingFinalComposite===true||gen.finalizing===true||clean(gen.status)==="processing");
  }
  async function finalize(source){
    if(!shouldFinalize(source))return;
    var id=projectId(source),out=outputId(source),key=id+"|"+out;if(!id||!out||finalizeFlights.has(key))return finalizeFlights.get(key);
    clearIntermediatePreview(source);
    var task=(async function(){
      try{
        var response=await fetch("/api/ad-film/seedance/finalize",{
          method:"POST",credentials:"include",cache:"no-store",
          headers:{"Content-Type":"application/json",Accept:"application/json"},
          body:JSON.stringify({projectId:id,outputId:out})
        });
        var data=await response.json().catch(function(){return{}});
        if(response.status===425){setTimeout(function(){finalize(project()||source)},2200);return}
        if(!response.ok||!data.project||!validUrl(data.video_url))throw new Error(textValue(data.message||data.error)||"final_video_missing");
        try{delete window[LATCH_KEY]}catch(_){window[LATCH_KEY]=null}
        window.AIVOAdFilmFinalizationPending=null;
        window.AIVOAdFilmSeedanceFinalizing=false;
        window.AIVOAdFilmGeneratedVideo=data.video_url;
        window.AIVOAdFilmActiveOutputId=data.outputId||data.activeOutputId||out;
        syncProject(data.project);
        if(window.AIVOAdFilmResultControls&&typeof window.AIVOAdFilmResultControls.mount==="function"){
          window.AIVOAdFilmResultControls.mount(data.video_url,data.project&&data.project.media&&data.project.media.logo&&data.project.media.logo.url||"",{
            projectId:id,outputId:data.outputId||data.activeOutputId||out,play:false,force:true,source:"completed-production"
          });
        }
        if(window.AIVOAdFilmProgressUI&&typeof window.AIVOAdFilmProgressUI.release==="function")window.AIVOAdFilmProgressUI.release();
        if(window.AIVOAdFilmProgressUI&&typeof window.AIVOAdFilmProgressUI.render==="function")window.AIVOAdFilmProgressUI.render();
        notifyReady(data.project);
      }catch(error){
        console.error("[ADFILM] completion finalization",error);
        setTimeout(function(){finalize(project()||source)},3500);
      }
    })().finally(function(){finalizeFlights.delete(key)});
    finalizeFlights.set(key,task);return task;
  }
  function removeStaticNoise(scope){
    scope.querySelectorAll('[data-adfilm-simple-auto],.adfilm-simple-auto').forEach(function(node){node.remove()});
    scope.querySelectorAll('.adfilm-reference-map,.adfilm-media-note').forEach(function(node){node.remove()});
  }
  function cleanup(){
    var scope=root();if(!scope)return;
    var source=project();
    removeStaticNoise(scope);
    if(shouldFinalize(source)){clearIntermediatePreview(source);finalize(source)}

    /* Progress UI has one owner while production is active. Never mutate it here. */
    if(uiLocked())return;

    var status=scope.querySelector('[data-adfilm-engine-status]');
    var running=isRunning(source);
    if(status){
      if(running){
        status.removeAttribute('data-adfilm-idle-hidden');
      }else{
        status.setAttribute('data-adfilm-idle-hidden','1');
        status.classList.remove('is-visible','is-success','is-error','is-busy');
        status.style.removeProperty('display');
        status.style.removeProperty('visibility');
        status.style.removeProperty('opacity');
      }
    }
    if(!running){
      var action=scope.querySelector('.adfilm-actionbar');if(action){action.classList.remove('is-engine-active');action.removeAttribute('data-adfilm-progress-lock')}
      var button=scope.querySelector('[data-adfilm-build]');if(button){
        button.classList.remove('is-generating','is-loading','is-music-preparing');
        button.removeAttribute('aria-busy');
        button.disabled=button.dataset.narrationGuard==="blocked";
      }
      var summary=scope.querySelector('.adfilm-actionbar__summary [data-adfilm-i18n="readyTitle"]');if(summary)summary.textContent=defaultTitle();
    }
  }
  function schedule(){[0,120,500,1200].forEach(function(delay){setTimeout(cleanup,delay)})}
  function observeModule(){
    if(observer)observer.disconnect();
    var scope=root();if(!scope)return;
    observer=new MutationObserver(function(){
      if(uiLocked())return;
      setTimeout(cleanup,40);
    });
    observer.observe(scope,{childList:true,subtree:true});
  }

  document.addEventListener('aivo:module-mounted',function(event){
    if(event&&event.detail&&event.detail.key==='adfilm'){
      setTimeout(observeModule,30);
      schedule();
    }
  });
  document.addEventListener('aivo:adfilm-project-sync',function(event){
    var source=event&&event.detail&&event.detail.project;
    setTimeout(function(){
      if(shouldFinalize(source||project()))finalize(source||project());
      if(!uiLocked())cleanup();
    },80);
  });
  document.addEventListener('aivo:adfilm-avatar-ready',function(event){
    var source=event&&event.detail&&event.detail.project||project();
    clearIntermediatePreview(source);
    setTimeout(function(){finalize(source||project())},20);
  });
  document.addEventListener('click',function(event){
    var build=event.target&&event.target.closest&&event.target.closest('[data-adfilm-build]');
    if(!build||uiLocked())return;
    setTimeout(cleanup,0);
  },true);
  window.addEventListener('pagehide',function(){if(observer)observer.disconnect()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){observeModule();schedule()},{once:true});
  else{observeModule();schedule()}
})();
