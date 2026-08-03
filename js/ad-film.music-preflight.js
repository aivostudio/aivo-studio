/* AIVO AI Reklam Filmi — generate selected music before Seedance production */
(function AIVO_AD_FILM_MUSIC_PREFLIGHT(){
  "use strict";
  if(window.__AIVO_AD_FILM_MUSIC_PREFLIGHT_V8__)return;
  window.__AIVO_AD_FILM_MUSIC_PREFLIGHT_V8__=true;

  var busy=false;
  var preflightStartedAt=0;
  var preflightClock=null;
  var LATCH_KEY="__AIVO_AD_FILM_PRODUCTION_UI_LATCH__";
  var LATCH_MS=30*60*1000;

  function clean(v){return String(v||"").trim()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function toast(message,type,duration){try{var fn=window.toast&&window.toast[type||"info"];if(typeof fn==="function")return fn({message:message,duration:duration||4200});if(typeof window.showToast==="function")return window.showToast(message,type||"info")}catch(_){} }
  function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
  function musicMode(source){var mode=clean(source&&source.music&&source.music.mode||"auto").toLowerCase();return mode==="off"||mode==="upload"?mode:"auto"}
  function musicReady(source){source=source||{};var mode=musicMode(source);if(mode==="off")return true;if(mode==="upload")return!!clean(source.media&&source.media.musicTrack&&source.media.musicTrack.url);return!!clean(source.music&&source.music.audio&&source.music.audio.url)}
  function needsMusicValidation(source){var mode=musicMode(source);if(mode==="off")return false;if(mode==="upload")return!musicReady(source);return true}
  function errorMessage(data,response){return clean(data&&(data.message||data.error||data.detail||data.fal_response&&data.fal_response.detail||data.project&&data.project.musicGeneration&&data.project.musicGeneration.error)||("HTTP "+response.status))}
  async function request(url,options){var r=await fetch(url,Object.assign({credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"}},options||{}));var d=await r.json().catch(function(){return{}});if(!r.ok){var e=new Error(errorMessage(d,r));e.data=d;e.status=r.status;throw e}return d}
  function setBuildBusy(button,on){if(!button)return;button.classList.toggle("is-music-preparing",!!on);if(on)button.setAttribute("aria-busy","true");else button.removeAttribute("aria-busy");button.disabled=!!on}
  function selected(scope,key,fallback){var node=scope&&scope.querySelector('[data-adfilm-choice="'+key+'"] .is-selected[data-value]');return clean(node&&node.getAttribute("data-value"))||fallback}
  function generation(source){return source&&source.generation||{}}
  function outputId(source){var gen=generation(source);return clean(source&&source.activeOutputId||gen.outputId||gen.requestId)}
  function projectId(source){var scope=root();return clean(source&&source.id||scope&&scope.dataset.adfilmProjectId)}
  function elapsed(){
    var total=Math.max(0,Math.floor((Date.now()-(preflightStartedAt||Date.now()))/1000));
    return Math.floor(total/60)+" "+text("dk","min")+" "+String(total%60).padStart(2,"0")+" "+text("sn","sec");
  }
  function currentMusicRequest(source){
    var scope=root(),profile=window.AIVOAdFilmMusicProfile||{},music=source&&source.music||{};
    return{
      projectId:clean(source&&source.id),
      musicStyle:clean(profile.style||scope&&scope.dataset.adfilmMusicStyle||music.style||"auto")||"auto",
      musicEnergy:clean(profile.energy||scope&&scope.dataset.adfilmMusicEnergy||music.energy||"balanced")||"balanced",
      duration:Number(selected(scope,"duration",source&&source.output&&source.output.duration||"10"))||10
    };
  }
  function ensureStatus(scope,button){var action=scope&&scope.querySelector(".adfilm-actionbar");if(!action)return null;var status=action.querySelector("[data-adfilm-engine-status]");if(!status){status=document.createElement("div");status.className="adfilm-engine-status";status.setAttribute("data-adfilm-engine-status","");status.setAttribute("role","status");status.setAttribute("aria-live","polite");status.innerHTML="<span></span><div><b></b><small></small></div>"}if(button&&status.nextElementSibling!==button)action.insertBefore(status,button);return status}
  function ensurePreflightLatch(source){
    var now=Date.now(),gen=generation(source),existing=window[LATCH_KEY];
    if(!existing||typeof existing!=="object"||Number(existing.until||0)<=now){
      window[LATCH_KEY]={
        projectId:projectId(source),
        startedAt:new Date(now).toISOString(),
        previousRequestId:clean(gen.requestId),
        previousOutputId:outputId(source),
        currentRequestId:"",
        currentOutputId:"",
        phase:"music-preflight",
        until:now+LATCH_MS
      };
    }else{
      existing.phase="music-preflight";
      existing.until=now+LATCH_MS;
    }
  }
  function clearPreflightLatch(){
    try{
      if(window.AIVOAdFilmProgressLock&&typeof window.AIVOAdFilmProgressLock.release==="function")window.AIVOAdFilmProgressLock.release();
      else delete window[LATCH_KEY];
    }catch(_){window[LATCH_KEY]=null}
  }
  function showImmediateProcessing(button){
    var scope=button&&button.closest('[data-module-root][data-module="adfilm"]')||root();if(!scope)return;
    var status=ensureStatus(scope,button);if(!status)return;
    scope.setAttribute("data-adfilm-run-starting","1");
    status.className="adfilm-engine-status is-visible is-busy is-preflight";
    status.removeAttribute("data-adfilm-idle-hidden");
    status.setAttribute("data-stage","1");
    status.style.setProperty("display","block","important");
    status.style.setProperty("visibility","visible","important");
    status.style.setProperty("opacity","1","important");
    var title=status.querySelector("b"),small=status.querySelector("small");
    if(title)title.textContent=text("Reklam filminiz hazırlanıyor","Your advertising film is being prepared");
    if(small){
      if(!small.querySelector("[data-adfilm-stage-wrap]"))small.innerHTML='<span class="adfilm-stage-wrap" data-adfilm-stage-wrap><span class="adfilm-stage-count" data-adfilm-stage-count></span><strong class="adfilm-stage-title" data-adfilm-stage-title></strong><span class="adfilm-stage-description" data-adfilm-stage-description></span><span class="adfilm-stage-time" data-adfilm-stage-time></span></span>';
      var count=small.querySelector("[data-adfilm-stage-count]"),stageTitle=small.querySelector("[data-adfilm-stage-title]"),description=small.querySelector("[data-adfilm-stage-description]"),time=small.querySelector("[data-adfilm-stage-time]");
      if(count)count.textContent=text("Aşama 1/4","Stage 1/4");
      if(stageTitle)stageTitle.textContent=text("Hazırlık yapılıyor","Preparing production");
      if(description)description.textContent=text("Reklam müziği, referanslar ve üretim ayarları kontrol ediliyor.","Advertising music, references and production settings are being checked.");
      if(time)time.textContent=text("Toplam geçen süre: ","Total elapsed: ")+elapsed();
    }
    var action=scope.querySelector(".adfilm-actionbar");if(action){action.classList.add("is-engine-active");action.setAttribute("data-adfilm-progress-lock","1")}
    var summary=scope.querySelector('.adfilm-actionbar__summary [data-adfilm-i18n="readyTitle"]');if(summary)summary.textContent=text("Video oluşturuluyor","Creating video");
  }
  function enforcePreflightVisual(button){
    if(!busy||!button||!button.classList.contains("is-music-preparing"))return;
    showImmediateProcessing(button);
  }
  function startPreflightVisual(source,button){
    preflightStartedAt=Date.now();
    ensurePreflightLatch(source);
    showImmediateProcessing(button);
    clearInterval(preflightClock);
    preflightClock=setInterval(function(){enforcePreflightVisual(button)},250);
    [0,30,80,160,320,700].forEach(function(delay){setTimeout(function(){enforcePreflightVisual(button)},delay)});
  }
  function stopPreflightVisual(keepLatch){
    clearInterval(preflightClock);preflightClock=null;
    var scope=root();if(scope)scope.removeAttribute("data-adfilm-run-starting");
    if(!keepLatch)clearPreflightLatch();
  }
  function showMusicError(button,message){var scope=button&&button.closest('[data-module-root][data-module="adfilm"]')||root();if(!scope)return;var status=ensureStatus(scope,button);if(!status)return;status.style.removeProperty("display");status.style.removeProperty("visibility");status.style.removeProperty("opacity");status.removeAttribute("data-stage");status.className="adfilm-engine-status is-visible is-error";var title=status.querySelector("b"),detail=status.querySelector("small");if(title)title.textContent=text("Reklam müziği hazırlanamadı","Advertising music could not be prepared");if(detail)detail.textContent=message||text("Tekrar deneyebilirsin.","You can try again.")}

  function mergeMusicIntoActive(source){
    var active=project();
    var lock=window.__AIVO_AD_FILM_PRODUCTION_START_LOCK__;
    if(!lock||!active||!source||clean(active.id)!==clean(source.id))return source;
    var merged=Object.assign({},active);
    merged.music=source.music||active.music||{};
    merged.media=Object.assign({},active.media||{},source.media||{});
    merged.musicGeneration=source.musicGeneration||active.musicGeneration||null;
    merged.updatedAt=source.updatedAt||active.updatedAt;
    merged.__aivoProductionIntent=true;
    return merged;
  }

  async function ensureMusic(source,button){
    if(!needsMusicValidation(source))return source;
    var handle=toast(text("Reklam müziği ayarları kontrol ediliyor...","Checking advertising music settings..."),"info",0);
    try{
      var requestBody=currentMusicRequest(source);
      console.info("[ADFILM FLOW] music-preflight-create",requestBody);
      var created=await request("/api/ad-film/music/create",{method:"POST",body:JSON.stringify(requestBody)});
      if(created.project)source=created.project;
      if(created.status==="DISABLED")return mergeMusicIntoActive(source);
      for(var i=0;i<120;i++){
        if(created.status==="COMPLETED"&&musicReady(source))break;
        await sleep(1800);
        var status=await request("/api/ad-film/music/status?projectId="+encodeURIComponent(source.id),{method:"GET"});
        if(status.project)source=status.project;
        if(status.status==="FAILED")throw new Error(clean(status.error||source.musicGeneration&&source.musicGeneration.error)||"music_generation_failed");
        if(status.status==="COMPLETED"&&musicReady(source))break;
      }
      if(!musicReady(source))throw new Error("music_generation_timeout");
      if(handle&&typeof handle.dismiss==="function")handle.dismiss();
      source=mergeMusicIntoActive(source);
      window.AIVOAdFilmActiveProject=source;
      document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:source,projectId:source.id||"",media:source.media||{}}}));
      if(created.status!=="COMPLETED")toast(text("Seçtiğin tarza uygun reklam müziği hazır. Video üretimi başlıyor.","Advertising music matching your selected style is ready. Video generation is starting."),"success");
      console.info("[ADFILM FLOW] music-preflight-complete",{projectId:source.id||"",generation:source.generation&&source.generation.status||""});
      return source;
    }catch(error){if(handle&&typeof handle.dismiss==="function")handle.dismiss();throw error}
    finally{setBuildBusy(button,false)}
  }
  function startProduction(){if(!window.AIVOAdFilmSeedanceEngine||typeof window.AIVOAdFilmSeedanceEngine.generate!=="function")throw new Error("seedance_engine_not_ready");console.info("[ADFILM FLOW] seedance-start-requested");return window.AIVOAdFilmSeedanceEngine.generate()}

  document.addEventListener("click",function(event){
    var button=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-adfilm-build]');
    if(!button||busy)return;
    var guard=window.AIVOAdFilmNarrationBuildGuard&&window.AIVOAdFilmNarrationBuildGuard.state&&window.AIVOAdFilmNarrationBuildGuard.state();if(guard&&guard.ready===false)return;
    var source=project();if(!source||!needsMusicValidation(source))return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    busy=true;setBuildBusy(button,true);startPreflightVisual(source,button);
    ensureMusic(source,button).then(function(){
      busy=false;
      clearInterval(preflightClock);preflightClock=null;
      if(window.AIVOAdFilmNarrationBuildGuard&&typeof window.AIVOAdFilmNarrationBuildGuard.sync==="function")window.AIVOAdFilmNarrationBuildGuard.sync();
      var result=startProduction();
      stopPreflightVisual(true);
      return result;
    }).catch(function(error){
      busy=false;setBuildBusy(button,false);stopPreflightVisual(false);
      console.error("[ADFILM] music preflight",error,error&&error.data||"");
      var detail=clean(error&&error.message);
      var message=detail&&detail!=="music_generation_failed"&&detail!=="music_generation_timeout"?text("Reklam üretimi başlatılamadı: ","Advertising production could not start: ")+detail:text("Reklam müziği hazırlanamadı. Tekrar dene.","Advertising music could not be prepared. Try again.");
      showMusicError(button,message);toast(message,"error",6200)
    })
  },true);
  window.addEventListener("pagehide",function(){clearInterval(preflightClock)});
})();
