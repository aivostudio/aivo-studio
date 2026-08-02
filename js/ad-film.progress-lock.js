/* AIVO AI Reklam Filmi — hard lock the progress panel while production is active */
(function AIVO_AD_FILM_PROGRESS_LOCK(){
  "use strict";
  if(window.__AIVO_AD_FILM_PROGRESS_LOCK_V3__)return;
  window.__AIVO_AD_FILM_PROGRESS_LOCK_V3__=true;

  var LATCH_KEY="__AIVO_AD_FILM_PRODUCTION_UI_LATCH__";
  var LATCH_MS=15*60*1000;
  var observer=null;
  var interval=null;
  var frame=0;
  var restoring=false;

  function clean(value){return String(value==null?"":value).trim()}
  function lower(value){return clean(value).toLowerCase()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function generation(source){return source&&source.generation||{}}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function action(){var scope=root();return scope&&scope.querySelector('.adfilm-actionbar')}
  function button(){var scope=root();return scope&&scope.querySelector('[data-adfilm-build]')}
  function status(){var scope=root();return scope&&scope.querySelector('[data-adfilm-engine-status]')}
  function projectId(){var source=project(),scope=root();return clean(source&&source.id||scope&&scope.dataset.adfilmProjectId)}

  function latch(){return window[LATCH_KEY]&&typeof window[LATCH_KEY]==="object"?window[LATCH_KEY]:null}
  function clearLatch(){try{delete window[LATCH_KEY]}catch(_){window[LATCH_KEY]=null}}
  function latchActive(){
    var value=latch();if(!value)return false;
    if(Number(value.until||0)<=Date.now()){clearLatch();return false}
    var id=projectId();return !value.projectId||!id||clean(value.projectId)===id;
  }
  function setLatch(){
    var now=Date.now(),previous=latch()||{},source=project(),gen=generation(source);
    window[LATCH_KEY]={
      projectId:projectId()||previous.projectId||"",
      startedAt:previous.startedAt||new Date(now).toISOString(),
      previousRequestId:clean(gen.requestId||previous.previousRequestId),
      previousOutputId:clean(source&&source.activeOutputId||gen.outputId||previous.previousOutputId),
      until:Math.max(Number(previous.until||0),now+LATCH_MS)
    };
  }
  function stateTime(source){
    var gen=generation(source),finish=source&&source.finalization||gen.finalization||{};
    var values=[
      gen.completedAt,finish.completedAt,gen.updatedAt,source&&source.updatedAt,
      gen.startedAt,gen.createdAt
    ].map(function(value){return Date.parse(value||"")}).filter(Number.isFinite);
    return values.length?Math.max.apply(Math,values):0;
  }
  function stateBelongsToCurrentLatch(source){
    var value=latch();if(!value)return true;
    var latchTime=Date.parse(value.startedAt||"");
    var gen=generation(source),requestId=clean(gen.requestId),started=Date.parse(gen.startedAt||gen.createdAt||"");
    if(requestId&&value.previousRequestId&&requestId!==clean(value.previousRequestId))return true;
    if(Number.isFinite(started)&&Number.isFinite(latchTime)&&started>=latchTime-1500)return true;
    var changedAt=stateTime(source);
    return Boolean(changedAt&&Number.isFinite(latchTime)&&changedAt>=latchTime-1500);
  }

  function generationActive(source){
    var gen=generation(source);
    var state=lower(gen.status),projectState=lower(source&&source.status);
    return ["queued","processing","running","in_queue"].indexOf(state)>=0||
      ["queued","processing","running","in_queue"].indexOf(projectState)>=0||
      gen.finalizing===true;
  }
  function terminal(source){
    var state=lower(source&&source.status||generation(source).status);
    return ["completed","failed","cancelled","canceled"].indexOf(state)>=0;
  }
  function finalReady(source){
    var gen=generation(source);
    if(gen.finalizing===true)return false;
    if(Number(gen.mixVersion||0)>=4&&clean(gen.videoUrl))return true;
    return lower(source&&source.status)==="completed"&&lower(gen.status)==="completed"&&clean(gen.videoUrl);
  }
  function buttonBusy(){var node=button();return Boolean(node&&(node.classList.contains("is-generating")||node.classList.contains("is-loading")||node.getAttribute("aria-busy")==="true"))}
  function active(){
    var source=project();
    if(latchActive())return true;
    return !finalReady(source)&&!terminal(source)&&Boolean(generationActive(source)||buttonBusy());
  }

  function ensureStatus(){
    var scope=root(),bar=action(),build=button(),node=status();
    if(!scope||!bar)return null;
    if(!node){
      node=document.createElement("div");
      node.className="adfilm-engine-status";
      node.setAttribute("data-adfilm-engine-status","");
      node.setAttribute("role","status");
      node.setAttribute("aria-live","polite");
      node.innerHTML="<span></span><div><b></b><small></small></div>";
      if(build)bar.insertBefore(node,build);else bar.appendChild(node);
    }
    return node;
  }
  function ensureFallbackLayout(node){
    var strong=node&&node.querySelector("b"),small=node&&node.querySelector("small");
    if(strong&&!clean(strong.textContent))strong.textContent=text("Reklam filminiz hazırlanıyor","Your advertising film is being prepared");
    if(small&&!small.querySelector('[data-adfilm-stage-wrap]')){
      small.innerHTML='<span class="adfilm-stage-wrap" data-adfilm-stage-wrap><span class="adfilm-stage-count" data-adfilm-stage-count>'+text("Aşama 1/4","Stage 1/4")+'</span><strong class="adfilm-stage-title" data-adfilm-stage-title>'+text("Hazırlık yapılıyor","Preparing production")+'</strong><span class="adfilm-stage-description" data-adfilm-stage-description>'+text("Seçimleriniz kontrol ediliyor ve üretim planı oluşturuluyor.","Your selections are being checked and the production plan is being created.")+'</span><span class="adfilm-stage-time" data-adfilm-stage-time></span></span>';
    }
  }
  function forceVisible(){
    if(restoring||!active())return;
    restoring=true;
    try{
      var bar=action(),build=button(),node=ensureStatus();
      if(!bar||!node)return;
      bar.setAttribute("data-adfilm-progress-lock","1");
      bar.classList.add("is-engine-active");
      node.removeAttribute("data-adfilm-idle-hidden");
      node.classList.add("is-visible","is-busy");
      node.classList.remove("is-success","is-error");
      if(build){
        build.disabled=true;
        build.classList.add("is-generating");
        build.setAttribute("aria-busy","true");
      }
      if(window.AIVOAdFilmProgressUI&&typeof window.AIVOAdFilmProgressUI.render==="function")window.AIVOAdFilmProgressUI.render();
      node=ensureStatus();
      if(node){
        node.removeAttribute("data-adfilm-idle-hidden");
        node.classList.add("is-visible","is-busy");
        ensureFallbackLayout(node);
      }
    }finally{restoring=false}
  }
  function releaseIfFinished(){
    var source=project();
    if(!source||(!finalReady(source)&&!terminal(source)))return false;
    if(latchActive()&&!stateBelongsToCurrentLatch(source))return false;
    clearLatch();
    var bar=action();if(bar)bar.removeAttribute("data-adfilm-progress-lock");
    return true;
  }
  function restore(){
    if(releaseIfFinished())return;
    if(active())forceVisible();
  }
  function schedule(){
    if(frame)return;
    frame=requestAnimationFrame(function(){frame=0;restore()});
  }
  function begin(){
    setLatch();
    schedule();
    [0,30,90,180,350,700,1200].forEach(function(delay){setTimeout(restore,delay)});
  }

  window.addEventListener("click",function(event){
    if(window.__AIVO_AD_FILM_ASSETS_READY__!==true)return;
    var target=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-adfilm-build]');
    if(!target||target.disabled)return;
    begin();
  },true);

  document.addEventListener("aivo:adfilm-project-sync",schedule);
  document.addEventListener("aivo:adfilm-finalization-pending",schedule);
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm"){setTimeout(restore,30);setTimeout(restore,250)}});
  document.addEventListener("aivo:adfilm-assets-ready",function(){setTimeout(restore,30)});

  observer=new MutationObserver(function(mutations){
    if(restoring||!active())return;
    for(var i=0;i<mutations.length;i++){
      var target=mutations[i].target;
      if(target&&target.closest&&target.closest('[data-module-root][data-module="adfilm"] .adfilm-actionbar')){schedule();break}
    }
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,characterData:true,attributeFilter:["class","style","aria-busy","data-adfilm-idle-hidden"]});

  interval=setInterval(restore,250);
  window.addEventListener("pagehide",function(){clearInterval(interval);if(observer)observer.disconnect();if(frame)cancelAnimationFrame(frame)});
  window.AIVOAdFilmProgressLock={begin:begin,restore:restore,active:active,release:clearLatch};
})();
