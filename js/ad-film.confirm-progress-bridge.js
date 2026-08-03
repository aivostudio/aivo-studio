/* AIVO AI Reklam Filmi — authoritative active-run guard */
(function AIVO_AD_FILM_CONFIRM_PROGRESS_BRIDGE(){
  "use strict";
  if(window.__AIVO_AD_FILM_CONFIRM_PROGRESS_BRIDGE_V2__)return;
  window.__AIVO_AD_FILM_CONFIRM_PROGRESS_BRIDGE_V2__=true;

  var RUN_KEY="__AIVO_AD_FILM_ACTIVE_RUN__";
  var RUN_MS=30*60*1000;
  var CONFIRM_RE=/(Fal\.ai|gerçek Fal\.ai üretimi|real Fal\.ai generation)/i;
  var originalConfirm=window.confirm.bind(window);
  var originalFetch=window.fetch.bind(window);
  var enforceTimer=null;

  function clean(value){return String(value==null?"":value).trim()}
  function lower(value){return clean(value).toLowerCase()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function button(){var scope=root();return scope&&scope.querySelector('[data-adfilm-build]')}
  function action(){var scope=root();return scope&&scope.querySelector('.adfilm-actionbar')}
  function status(){var scope=root();return scope&&scope.querySelector('[data-adfilm-engine-status]')}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function generation(source){return source&&source.generation||{}}
  function projectId(){var source=project(),scope=root();return clean(source&&source.id||scope&&scope.dataset.adfilmProjectId)}
  function requestId(source){var gen=generation(source);return clean(gen.requestId||gen.request_id)}
  function outputId(source){var gen=generation(source);return clean(source&&source.activeOutputId||gen.outputId||gen.output_id)}
  function run(){return window[RUN_KEY]&&typeof window[RUN_KEY]==="object"?window[RUN_KEY]:null}
  function active(){
    var value=run();
    if(!value||value.active!==true)return false;
    if(Number(value.until||0)<=Date.now()){finish("expired");return false}
    return true;
  }
  function requestFrom(data){
    var gen=data&&data.generation||{};
    return clean(data&&data.request_id||data&&data.requestId||gen.requestId||gen.request_id);
  }
  function outputFrom(data){
    var gen=data&&data.generation||{};
    return clean(data&&data.activeOutputId||data&&data.outputId||gen.outputId||gen.output_id);
  }
  function statusFrom(data){return lower(data&&data.status||data&&data.generation&&data.generation.status)}

  function start(){
    var now=Date.now(),source=project(),gen=generation(source);
    window[RUN_KEY]={
      active:true,
      projectId:projectId(),
      startedAt:new Date(now).toISOString(),
      startedMs:now,
      previousRequestId:requestId(source),
      previousOutputId:outputId(source),
      requestId:"",
      outputId:"",
      phase:"confirmed",
      until:now+RUN_MS
    };
    window.__AIVO_AD_FILM_CONFIRM_ACCEPTED_UNTIL__=now+RUN_MS;
    protectGlobalProject();
    enforce();
    document.dispatchEvent(new CustomEvent("aivo:adfilm-run-started",{detail:{run:window[RUN_KEY]}}));
  }

  function register(data,phase){
    var value=run();if(!value||value.active!==true)return;
    var req=requestFrom(data),out=outputFrom(data);
    if(req)value.requestId=req;
    if(out)value.outputId=out;
    if(phase)value.phase=phase;
    value.until=Date.now()+RUN_MS;
    protectGlobalProject();
    enforce();
  }

  function finish(reason,data){
    var value=run();
    if(value){
      value.active=false;
      value.phase=reason||"finished";
      value.endedAt=new Date().toISOString();
      if(data){
        var req=requestFrom(data),out=outputFrom(data);
        if(req)value.requestId=req;
        if(out)value.outputId=out;
      }
    }
    window.__AIVO_AD_FILM_CONFIRM_ACCEPTED_UNTIL__=0;
    document.dispatchEvent(new CustomEvent("aivo:adfilm-run-finished",{detail:{reason:reason||"finished",run:value||null,data:data||null}}));
  }

  function cancel(){
    finish("cancelled");
    if(window.AIVOAdFilmProgressLock&&typeof window.AIVOAdFilmProgressLock.release==="function")window.AIVOAdFilmProgressLock.release();
    if(window.AIVOAdFilmProgressUI&&typeof window.AIVOAdFilmProgressUI.release==="function")window.AIVOAdFilmProgressUI.release();
    var build=button(),bar=action(),node=status();
    if(build){build.classList.remove("is-generating","is-loading","is-music-preparing");build.removeAttribute("aria-busy");build.disabled=false}
    if(bar){bar.classList.remove("is-engine-active");bar.removeAttribute("data-adfilm-progress-lock")}
    if(node){
      node.setAttribute("data-adfilm-idle-hidden","1");
      node.classList.remove("is-visible","is-busy","is-success","is-error");
      node.style.removeProperty("display");
      node.style.removeProperty("visibility");
      node.style.removeProperty("opacity");
    }
  }

  function matchesCurrent(source){
    var value=run();if(!value||value.active!==true)return true;
    var req=requestId(source),out=outputId(source);
    if(value.requestId)return req===clean(value.requestId)||Boolean(value.outputId&&out===clean(value.outputId));
    if(value.outputId)return out===clean(value.outputId);
    return false;
  }

  function protectedProject(source){
    var value=run();
    if(!value||value.active!==true||!source||matchesCurrent(source))return source;
    var oldGen=generation(source);
    var nextGen=Object.assign({},oldGen,{
      status:value.requestId?"queued":"processing",
      requestId:value.requestId||"",
      outputId:value.outputId||"",
      startedAt:value.startedAt,
      completedAt:null,
      videoUrl:"",
      finalizing:value.phase==="finalizing",
      awaitingFinalComposite:value.phase==="finalizing"
    });
    return Object.assign({},source,{
      status:"processing",
      activeOutputId:value.outputId||"",
      generation:nextGen
    });
  }

  function protectGlobalProject(){
    if(!active())return;
    var source=project();
    if(source)window.AIVOAdFilmActiveProject=protectedProject(source);
  }

  function enforce(){
    if(!active())return;
    protectGlobalProject();
    var build=button(),bar=action(),node=status();
    if(build){
      build.classList.add("is-generating");
      build.classList.remove("is-loading");
      build.setAttribute("aria-busy","true");
      build.disabled=true;
    }
    if(bar){
      bar.classList.add("is-engine-active");
      bar.setAttribute("data-adfilm-progress-lock","1");
    }
    if(node){
      node.removeAttribute("data-adfilm-idle-hidden");
      node.classList.remove("is-success","is-error");
      node.classList.add("is-visible","is-busy");
      node.style.setProperty("display","block","important");
      node.style.setProperty("visibility","visible","important");
      node.style.setProperty("opacity","1","important");
    }
    if(!window.__AIVO_AD_FILM_PRODUCTION_UI_LATCH__&&window.AIVOAdFilmProgressLock&&typeof window.AIVOAdFilmProgressLock.begin==="function")window.AIVOAdFilmProgressLock.begin();
    if(window.AIVOAdFilmProgressUI&&typeof window.AIVOAdFilmProgressUI.render==="function")window.AIVOAdFilmProgressUI.render();
  }

  function observeResponse(url,response){
    if(!response||typeof response.clone!=="function")return;
    response.clone().json().then(function(data){
      if(/\/api\/ad-film\/seedance\/create(?:\?|$)/.test(url)){
        if(response.ok)register(data,"queued");
        else finish("failed",data);
        return;
      }
      if(/\/api\/ad-film\/seedance\/status(?:\?|$)/.test(url)){
        if(!active())return;
        var req=requestFrom(data),value=run();
        if(value&&value.requestId&&req&&req!==value.requestId)return;
        var state=statusFrom(data);
        if(state==="failed"||state==="error"||state==="cancelled"||state==="canceled")finish("failed",data);
        else if(state==="completed"&&data&&data.video_url)register(data,"finalizing");
        else register(data,state||"processing");
        return;
      }
      if(/\/api\/ad-film\/seedance\/finalize(?:\?|$)/.test(url)){
        if(response.ok&&data&&data.video_url)setTimeout(function(){finish("completed",data)},1200);
        else if(!response.ok)finish("failed",data);
      }
    }).catch(function(){});
  }

  window.fetch=function(input,init){
    var url=typeof input==="string"?input:clean(input&&input.url);
    var relevant=/\/api\/ad-film\/seedance\/(?:create|status|finalize)(?:\?|$)/.test(url);
    var promise=originalFetch(input,init);
    if(!relevant)return promise;
    return promise.then(function(response){observeResponse(url,response);return response},function(error){
      if(/\/(?:create|finalize)(?:\?|$)/.test(url))finish("failed");
      throw error;
    });
  };

  window.confirm=function(message){
    var relevant=CONFIRM_RE.test(String(message||""));
    var result=originalConfirm(message);
    if(relevant){if(result)start();else cancel()}
    return result;
  };

  document.addEventListener("aivo:adfilm-project-sync",function(event){
    if(!active())return;
    var detail=event&&event.detail;
    if(detail&&detail.project){
      detail.project=protectedProject(detail.project);
      window.AIVOAdFilmActiveProject=detail.project;
    }else protectGlobalProject();
    setTimeout(enforce,0);
  },true);
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(enforce,30)});
  document.addEventListener("aivo:adfilm-assets-ready",function(){setTimeout(enforce,30)});

  enforceTimer=setInterval(enforce,160);
  window.addEventListener("pagehide",function(){clearInterval(enforceTimer)});
  window.AIVOAdFilmRunGuard={active:active,start:start,register:register,finish:finish,cancel:cancel,protect:protectedProject,state:run,matches:matchesCurrent,enforce:enforce};
})();
