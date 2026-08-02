/* AIVO AI Reklam Filmi — synchronize output history with the active project */
(function AIVO_AD_FILM_OUTPUT_SYNC(){
  "use strict";
  if(window.__AIVO_AD_FILM_OUTPUT_SYNC_V2__)return;
  window.__AIVO_AD_FILM_OUTPUT_SYNC_V2__=true;

  var timer=null;
  var busy=false;

  function clean(value){return String(value==null?"":value).trim()}
  function lower(value){return clean(value).toLowerCase()}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function projectId(){
    var root=document.querySelector('[data-module-root][data-module="adfilm"]');
    return clean(root&&root.dataset.adfilmProjectId||project()&&project().id);
  }
  function legacyId(source){var generation=source&&source.generation||{};return clean(generation.outputId||generation.requestId||"legacy-output")}
  function revision(source){var value=Number(source&&source.revision);return Number.isFinite(value)?value:0}
  function updatedAt(source){
    var value=Date.parse(source&&source.updatedAt||source&&source.generation&&source.generation.updatedAt||"");
    return Number.isFinite(value)?value:0;
  }
  function completed(source){
    var generation=source&&source.generation||{};
    return lower(source&&source.status)==="completed"||lower(generation.status)==="completed";
  }
  function currentOutputId(source){
    var generation=source&&source.generation||{};
    return clean(source&&source.activeOutputId||generation.outputId||generation.requestId);
  }
  function hasCurrentFinal(source){
    if(!source)return false;
    var generation=source.generation||{};
    var id=currentOutputId(source);
    var outputs=Array.isArray(source.outputs)?source.outputs:[];
    var item=outputs.find(function(output){return clean(output&&output.id)===id})||null;
    if(item&&/^https:\/\//i.test(clean(item.videoUrl))&&(item.completedAt||item.finalizedAt||Number(item.mixVersion||0)>=4))return true;
    return lower(generation.status)==="completed"&&/^https:\/\//i.test(clean(generation.videoUrl));
  }
  function sameProject(left,right){return Boolean(left&&right&&clean(left.id)&&clean(left.id)===clean(right.id))}
  function acceptFresh(source){
    var current=project();
    if(!source||!current||!sameProject(source,current))return source;
    var nextRevision=revision(source),currentRevision=revision(current);
    if(nextRevision<currentRevision)return current;
    if(nextRevision===currentRevision){
      if(completed(current)&&!completed(source))return current;
      if(hasCurrentFinal(current)&&!hasCurrentFinal(source))return current;
      if(updatedAt(source)<updatedAt(current))return current;
    }
    return source;
  }
  function dispatch(source){
    if(!source)return null;
    var accepted=acceptFresh(source);
    if(accepted===project())return accepted;
    window.AIVOAdFilmActiveProject=accepted;
    document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:accepted,projectId:accepted.id||"",media:accepted.media||{}}}));
    return accepted;
  }
  async function request(url,options){
    var response=await fetch(url,Object.assign({credentials:"include",headers:{"Content-Type":"application/json"}},options||{}));
    var data=await response.json().catch(function(){return{}});if(!response.ok)throw new Error(data.error||"request_failed");return data;
  }

  async function migrateLegacy(source){
    if(!source||Array.isArray(source.outputs)&&source.outputs.length||!source.generation||!source.generation.videoUrl)return source;
    var id=legacyId(source);if(!id)return source;
    var data=await request("/api/ad-film/seedance/result",{method:"POST",body:JSON.stringify({projectId:source.id,outputId:id})});
    return data.project||source;
  }

  async function refresh(){
    if(busy)return;
    var id=projectId();if(!id)return;
    busy=true;
    try{
      var data=await request("/api/ad-film/project?id="+encodeURIComponent(id),{method:"GET"});
      var source=await migrateLegacy(data.project);
      source=dispatch(source)||source;
      var generation=source&&source.generation||{};
      if(["queued","processing","running","in_queue"].indexOf(lower(generation.status))>=0)schedule(4500);
    }catch(error){console.warn("[ADFILM] output sync",error)}
    finally{busy=false}
  }
  function schedule(delay){clearTimeout(timer);timer=setTimeout(refresh,delay==null?300:delay)}

  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")schedule(900)});
  document.addEventListener("aivo:adfilm-project-sync",function(event){
    var source=event&&event.detail&&event.detail.project;
    var generation=source&&source.generation||{};
    if(source&&(!Array.isArray(source.outputs)||!source.outputs.length)&&generation.videoUrl)schedule(80);
    else if(["queued","processing","running","in_queue"].indexOf(lower(generation.status))>=0)schedule(4500);
  });
  window.addEventListener("focus",function(){schedule(150)});
  document.addEventListener("visibilitychange",function(){if(!document.hidden)schedule(150)});
  window.addEventListener("pagehide",function(){clearTimeout(timer)});

  window.AIVOAdFilmAcceptFreshProject=acceptFresh;
  window.AIVOAdFilmOutputSync={refresh:refresh,acceptFresh:acceptFresh,hasCurrentFinal:hasCurrentFinal};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){schedule(1200)},{once:true});else schedule(1200);
})();