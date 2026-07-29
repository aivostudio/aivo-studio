/* AIVO AI Reklam Filmi — synchronize output history with the active project */
(function AIVO_AD_FILM_OUTPUT_SYNC(){
  "use strict";
  if(window.__AIVO_AD_FILM_OUTPUT_SYNC__)return;
  window.__AIVO_AD_FILM_OUTPUT_SYNC__=true;

  var timer=null;
  var busy=false;

  function clean(value){return String(value||"").trim()}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function projectId(){
    var root=document.querySelector('[data-module-root][data-module="adfilm"]');
    return clean(root&&root.dataset.adfilmProjectId||project()&&project().id);
  }
  function legacyId(source){var generation=source&&source.generation||{};return clean(generation.outputId||generation.requestId||"legacy-output")}
  function dispatch(source){
    if(!source)return;
    window.AIVOAdFilmActiveProject=source;
    document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:source,projectId:source.id||"",media:source.media||{}}}));
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
      dispatch(source);
      var generation=source&&source.generation||{};
      if(["queued","processing"].indexOf(String(generation.status))>=0)schedule(4500);
    }catch(error){console.warn("[ADFILM] output sync",error)}
    finally{busy=false}
  }
  function schedule(delay){clearTimeout(timer);timer=setTimeout(refresh,delay==null?300:delay)}

  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")schedule(900)});
  document.addEventListener("aivo:adfilm-project-sync",function(event){
    var source=event&&event.detail&&event.detail.project;
    var generation=source&&source.generation||{};
    if(source&&(!Array.isArray(source.outputs)||!source.outputs.length)&&generation.videoUrl)schedule(80);
    else if(["queued","processing"].indexOf(String(generation.status))>=0)schedule(4500);
  });
  window.addEventListener("focus",function(){schedule(150)});
  document.addEventListener("visibilitychange",function(){if(!document.hidden)schedule(150)});
  window.addEventListener("pagehide",function(){clearTimeout(timer)});

  window.AIVOAdFilmOutputSync={refresh:refresh};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){schedule(1200)},{once:true});else schedule(1200);
})();