/* AIVO AI Reklam Filmi — single-owner production progress lock */
(function AIVO_AD_FILM_PROGRESS_LOCK(){
  "use strict";
  if(window.__AIVO_AD_FILM_PROGRESS_LOCK_V4__)return;
  window.__AIVO_AD_FILM_PROGRESS_LOCK_V4__=true;

  var LATCH_KEY="__AIVO_AD_FILM_PRODUCTION_UI_LATCH__";
  var LATCH_MS=30*60*1000;
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
  function outputId(source){var gen=generation(source);return clean(source&&source.activeOutputId||gen.outputId||gen.requestId)}

  function latch(){return window[LATCH_KEY]&&typeof window[LATCH_KEY]==="object"?window[LATCH_KEY]:null}
  function clearLatch(){try{delete window[LATCH_KEY]}catch(_){window[LATCH_KEY]=null}}
  function latchActive(){
    var value=latch();if(!value)return false;
    if(Number(value.until||0)<=Date.now()){clearLatch();return false}
    return Boolean(root());
  }
  function setLatch(){
    var now=Date.now(),source=project(),gen=generation(source);
    window[LATCH_KEY]={
      projectId:projectId(),
      startedAt:new Date(now).toISOString(),
      previousRequestId:clean(gen.requestId),
      previousOutputId:outputId(source),
      currentRequestId:"",
      currentOutputId:"",
      until:now+LATCH_MS
    };
  }
  function belongsToCurrentRun(source){
    var value=latch();if(!value)return true;
    var gen=generation(source),requestId=clean(gen.requestId),currentOutput=outputId(source);
    if(requestId&&requestId!==clean(value.previousRequestId)){
      value.currentRequestId=requestId;
      if(currentOutput)value.currentOutputId=currentOutput;
      return true;
    }
    if(currentOutput&&currentOutput!==clean(value.previousOutputId)){
      value.currentOutputId=currentOutput;
      if(requestId)value.currentRequestId=requestId;
      return true;
    }
    if(value.currentRequestId&&requestId===clean(value.currentRequestId))return true;
    if(value.currentOutputId&&currentOutput===clean(value.currentOutputId))return true;
    if(!value.previousRequestId&&!value.previousOutputId){
      var started=Date.parse(gen.startedAt||gen.createdAt||"");
      var latchTime=Date.parse(value.startedAt||"");
      if(Number.isFinite(started)&&Number.isFinite(latchTime)&&started>=latchTime-1500)return true;
    }
    return false;
  }
  function generationActive(source){
    var gen=generation(source),state=lower(gen.status),projectState=lower(source&&source.status);
    return ["queued","processing","running","in_queue"].indexOf(state)>=0||
      ["queued","processing","running","in_queue"].indexOf(projectState)>=0||gen.finalizing===true;
  }
  function terminal(source){
    var state=lower(source&&source.status||generation(source).status);
    return ["completed","failed","cancelled","canceled","error"].indexOf(state)>=0;
  }
  function finalReady(source){
    var gen=generation(source);
    if(gen.finalizing===true)return false;
    if(Number(gen.mixVersion||0)>=4&&clean(gen.videoUrl))return true;
    return lower(source&&source.status)==="completed"&&lower(gen.status)==="completed"&&clean(gen.videoUrl);
  }
  function buttonBusy(){
    var node=button();
    return Boolean(node&&(node.classList.contains("is-generating")||node.classList.contains("is-loading")||node.classList.contains("is-music-preparing")||node.getAttribute("aria-busy")==="true"||node.hasAttribute("data-adfilm-loader-pending")));
  }
  function active(){
    if(latchActive())return true;
    var source=project();
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
  function setClass(node,name,on){if(node&&node.classList.contains(name)!==!!on)node.classList.toggle(name,!!on)}
  function forceVisible(){
    if(restoring||!active())return;
    restoring=true;
    try{
      var bar=action(),build=button(),node=ensureStatus();
      if(!bar||!node)return;
      if(bar.getAttribute("data-adfilm-progress-lock")!=="1")bar.setAttribute("data-adfilm-progress-lock","1");
      setClass(bar,"is-engine-active",true);
      node.removeAttribute("data-adfilm-idle-hidden");
      setClass(node,"is-visible",true);setClass(node,"is-busy",true);setClass(node,"is-success",false);setClass(node,"is-error",false);
      if(node.style.getPropertyValue("display")!=="block"||node.style.getPropertyPriority("display")!=="important")node.style.setProperty("display","block","important");
      if(node.style.getPropertyValue("visibility")!=="visible")node.style.setProperty("visibility","visible","important");
      if(node.style.getPropertyValue("opacity")!=="1")node.style.setProperty("opacity","1","important");
      ensureFallbackLayout(node);
      if(build){
        if(!build.disabled)build.disabled=true;
        setClass(build,"is-generating",true);
        if(build.getAttribute("aria-busy")!=="true")build.setAttribute("aria-busy","true");
      }
    }finally{restoring=false}
  }
  function releaseIfFinished(){
    var source=project();
    if(!source||(!finalReady(source)&&!terminal(source)))return false;
    if(latchActive()&&!belongsToCurrentRun(source))return false;
    clearLatch();
    var bar=action();if(bar)bar.removeAttribute("data-adfilm-progress-lock");
    var node=status();if(node){node.style.removeProperty("display");node.style.removeProperty("visibility");node.style.removeProperty("opacity")}
    return true;
  }
  function restore(){if(releaseIfFinished())return;if(active())forceVisible()}
  function schedule(){if(frame)return;frame=requestAnimationFrame(function(){frame=0;restore()})}
  function begin(){setLatch();forceVisible();[40,120,300,700,1500].forEach(function(delay){setTimeout(restore,delay)})}

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
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["class","style","aria-busy","data-adfilm-idle-hidden"]});

  interval=setInterval(restore,500);
  window.addEventListener("pagehide",function(){clearInterval(interval);if(observer)observer.disconnect();if(frame)cancelAnimationFrame(frame)});
  window.AIVOAdFilmProgressLock={begin:begin,restore:restore,active:active,release:clearLatch,belongsToCurrentRun:belongsToCurrentRun};
})();