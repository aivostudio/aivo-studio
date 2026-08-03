/* AIVO AI Reklam Filmi — protect active production from stale saves and stale completed UI */
(function AIVO_AD_FILM_PRODUCTION_SAVE_GUARD(){
  "use strict";
  if(window.__AIVO_AD_FILM_PRODUCTION_SAVE_GUARD_V3__)return;
  window.__AIVO_AD_FILM_PRODUCTION_SAVE_GUARD_V3__=true;
  window.__AIVO_AD_FILM_PRODUCTION_SAVE_GUARD_V2__=true;
  window.__AIVO_AD_FILM_PRODUCTION_SAVE_GUARD_V1__=true;

  var previousFetch=window.fetch.bind(window);
  var run=null;
  var runExpiry=null;

  function clean(value){return String(value==null?"":value).trim()}
  function lower(value){return clean(value).toLowerCase()}
  function urlOf(input){return typeof input==="string"?input:input&&input.url||""}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function generation(source){return source&&source.generation||{}}
  function projectId(source){var scope=root();return clean(source&&source.id||scope&&scope.dataset.adfilmProjectId)}
  function requestId(source){var gen=generation(source);return clean(gen.requestId||gen.outputId)}
  function outputId(source){var gen=generation(source);return clean(source&&source.activeOutputId||gen.outputId||gen.requestId)}
  function generationStarted(source){var gen=generation(source);return Date.parse(gen.startedAt||gen.createdAt||source&&source.startedAt||"")||0}
  function completed(source){var gen=generation(source),state=lower(gen.status||source&&source.status);return (state==="completed"||!!clean(gen.videoUrl||source&&source.videoUrl))&&!!clean(gen.videoUrl||source&&source.videoUrl)}
  function debug(label,data){try{console.info("[ADFILM FLOW] "+label,data||"")}catch(_){} }
  function active(){
    var source=project()||{},gen=generation(source),pipeline=source.avatar&&source.avatar.pipeline||{};
    var states=["starting","queued","processing","running","in_queue","finalizing","rendering"];
    return states.indexOf(lower(source.status))>=0||states.indexOf(lower(gen.status))>=0||states.indexOf(lower(pipeline.status))>=0||gen.awaitingFinalComposite===true||gen.avatarWaiting===true||gen.finalizing===true||!!window.__AIVO_AD_FILM_FORCE_FRESH__||!!run;
  }
  function synthetic(source){
    return Promise.resolve(new Response(JSON.stringify({ok:true,project:source,guarded:true}),{status:200,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}}));
  }

  function narrationApproved(){
    try{
      var guard=window.AIVOAdFilmNarrationBuildGuard&&typeof window.AIVOAdFilmNarrationBuildGuard.state==="function"?window.AIVOAdFilmNarrationBuildGuard.state():null;
      if(!guard||guard.ready!==true)return;
      var scope=root(),selected=scope&&scope.querySelector('[data-adfilm-choice="scriptMode"] .is-selected[data-value]');
      var state=window.AIVOAdFilmNarrationGuideState;
      if(!state||typeof state!=="object")state={};
      state.mode=clean(state.mode||selected&&selected.getAttribute("data-value")||"manual");
      state.approved=true;
      window.AIVOAdFilmNarrationGuideState=state;
    }catch(_){}
  }

  function startingProject(source,now){
    source=source&&typeof source==="object"?source:{};
    var next=Object.assign({},source),gen=Object.assign({},generation(source));
    next.status="processing";
    next.videoUrl=null;
    next.activeOutputId=null;
    next.generation=Object.assign(gen,{
      status:"starting",
      videoUrl:null,
      sourceVideoUrl:null,
      finalizing:false,
      awaitingFinalComposite:false,
      avatarWaiting:false,
      sourceOnly:false,
      startedAt:new Date(now).toISOString(),
      updatedAt:new Date(now).toISOString()
    });
    next.__aivoProductionIntent=true;
    return next;
  }

  function clearOldSuccess(scope){
    scope=scope||root();if(!scope)return;
    scope.removeAttribute("data-adfilm-current-run-completed");
    var status=scope.querySelector('[data-adfilm-engine-status]');
    if(status&&status.classList.contains("is-success")){
      status.className="adfilm-engine-status";
      status.setAttribute("data-adfilm-idle-hidden","1");
      status.removeAttribute("data-stage");
      status.style.removeProperty("display");
      status.style.removeProperty("visibility");
      status.style.removeProperty("opacity");
    }
    var summary=scope.querySelector('.adfilm-actionbar__summary [data-adfilm-i18n="readyTitle"]');
    if(summary)summary.textContent=String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0?"Advertising project will be prepared":"Reklam projesi hazırlanacak";
  }

  function beginRun(button){
    var source=project()||{},now=Date.now();
    run={
      projectId:projectId(source),
      previousRequestId:requestId(source),
      previousOutputId:outputId(source),
      currentRequestId:"",
      currentOutputId:"",
      startedAt:now
    };
    window.__AIVO_AD_FILM_PRODUCTION_START_LOCK__=run;
    window.AIVOAdFilmActiveProject=startingProject(source,now);
    narrationApproved();
    clearOldSuccess(button&&button.closest('[data-module-root][data-module="adfilm"]')||root());
    try{
      if(window.AIVOAdFilmActiveRunEventGuard&&typeof window.AIVOAdFilmActiveRunEventGuard.beginRun==="function")window.AIVOAdFilmActiveRunEventGuard.beginRun();
    }catch(_){}
    document.dispatchEvent(new CustomEvent("aivo:adfilm-run-start",{detail:{project:window.AIVOAdFilmActiveProject,projectId:run.projectId,startedAt:now}}));
    debug("run-intent",{projectId:run.projectId,previousRequestId:run.previousRequestId,previousOutputId:run.previousOutputId});
    clearTimeout(runExpiry);
    runExpiry=setTimeout(releaseRun,30*60*1000);
  }

  function releaseRun(){
    run=null;
    window.__AIVO_AD_FILM_PRODUCTION_START_LOCK__=null;
    clearTimeout(runExpiry);
  }

  function belongsToCurrentRun(source){
    if(!run||projectId(source)!==run.projectId||!completed(source))return false;
    var nextRequest=requestId(source),nextOutput=outputId(source),started=generationStarted(source);
    if(run.currentRequestId&&nextRequest===run.currentRequestId)return true;
    if(run.currentOutputId&&nextOutput===run.currentOutputId)return true;
    if(nextRequest&&run.previousRequestId&&nextRequest!==run.previousRequestId)return true;
    if(nextOutput&&run.previousOutputId&&nextOutput!==run.previousOutputId)return true;
    return !!(started&&started>=run.startedAt-3000);
  }

  function rememberRunningGeneration(source){
    if(!run||projectId(source)!==run.projectId)return;
    var nextRequest=requestId(source),nextOutput=outputId(source),started=generationStarted(source);
    if(nextRequest&&nextRequest!==run.previousRequestId)run.currentRequestId=nextRequest;
    if(nextOutput&&nextOutput!==run.previousOutputId)run.currentOutputId=nextOutput;
    if(started&&started>=run.startedAt-3000){
      if(nextRequest)run.currentRequestId=nextRequest;
      if(nextOutput)run.currentOutputId=nextOutput;
    }
  }

  window.fetch=function(input,init){
    var url=urlOf(input),method=clean(init&&init.method||"GET").toUpperCase();
    if((method==="PATCH"||method==="PUT")&&url.indexOf("/api/ad-film/project?id=")>=0&&active()){
      debug("stale-save-blocked",{method:method,url:url});
      return synthetic(project());
    }
    return previousFetch(input,init);
  };

  document.addEventListener("click",function(event){
    var build=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-adfilm-build]');
    if(build)beginRun(build);
  },true);

  document.addEventListener("aivo:adfilm-project-sync",function(event){
    if(!run)return;
    var incoming=event&&event.detail&&event.detail.project;
    if(!incoming||projectId(incoming)!==run.projectId)return;
    rememberRunningGeneration(incoming);
    if(!completed(incoming))return;
    if(belongsToCurrentRun(incoming)){
      debug("current-run-completed",{requestId:requestId(incoming),outputId:outputId(incoming)});
      releaseRun();
      return;
    }
    debug("stale-completed-sync-blocked",{requestId:requestId(incoming),outputId:outputId(incoming)});
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    clearOldSuccess(root());
  },true);

  window.addEventListener("pagehide",function(){clearTimeout(runExpiry)});
  window.AIVOAdFilmProductionSaveGuard={beginRun:beginRun,release:releaseRun,active:function(){return!!run},state:function(){return run}};
})();
