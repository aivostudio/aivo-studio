/* AIVO AI Reklam Filmi — keep browser state aligned with Seedance server state */
(function AIVO_AD_FILM_SERVER_STATE_SYNC(){
  "use strict";
  if(window.__AIVO_AD_FILM_SERVER_STATE_SYNC_V1__)return;
  window.__AIVO_AD_FILM_SERVER_STATE_SYNC_V1__=true;

  var nativeFetch=window.fetch.bind(window);
  var lastKey="";
  var refreshFlight=null;

  function clean(value){return String(value==null?"":value).trim()}
  function lower(value){return clean(value).toLowerCase()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function current(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function currentId(){var source=current(),scope=root();return clean(source&&source.id||scope&&scope.dataset.adfilmProjectId)}
  function own(object,key){return Object.prototype.hasOwnProperty.call(object||{},key)}
  function requestUrl(input){return typeof input==="string"?input:clean(input&&input.url)}
  function endpoint(url){try{return new URL(url,location.href).pathname}catch(_){return clean(url).split("?")[0]}}
  function queryProjectId(url){try{return clean(new URL(url,location.href).searchParams.get("projectId"))}catch(_){return""}}
  function bodyProjectId(options){try{var body=options&&options.body;if(typeof body!=="string")return"";return clean(JSON.parse(body).projectId)}catch(_){return""}}
  function statusFrom(data,generation,hasFinal){
    var publicStatus=clean(data&&data.status).toUpperCase();
    var generationStatus=lower(generation&&generation.status);
    if(publicStatus==="FAILED"||generationStatus==="failed")return"failed";
    if(publicStatus==="IN_QUEUE"||publicStatus==="RUNNING"||["queued","processing","running","in_queue"].indexOf(generationStatus)>=0)return"processing";
    if(publicStatus==="COMPLETED")return hasFinal?"completed":"processing";
    return lower(data&&data.project&&data.project.status)||lower(current()&&current().status)||"draft";
  }
  function finalItem(item){
    return Boolean(item&&/^https:\/\//i.test(clean(item.videoUrl))&&(
      Number(item.mixVersion||0)>=4||item.finalizedAt||item.narrationApplied===true||item.musicApplied===true||item.logoApplied===true
    ));
  }
  function finalForGeneration(outputs,generation,activeOutputId){
    var ids=[activeOutputId,generation&&generation.outputId,generation&&generation.requestId].map(clean).filter(Boolean);
    return (Array.isArray(outputs)?outputs:[]).some(function(item){return finalItem(item)&&ids.indexOf(clean(item&&item.id))>=0});
  }
  function projectFrom(data,fallbackId){
    if(data&&data.project&&typeof data.project==="object")return data.project;
    var source=current()||{};
    var generation=data&&data.generation&&typeof data.generation==="object"?data.generation:source.generation||{};
    var outputs=Array.isArray(data&&data.outputs)?data.outputs:Array.isArray(source.outputs)?source.outputs:[];
    var activeOutputId=own(data,"activeOutputId")?data.activeOutputId:source.activeOutputId;
    var hasFinal=finalForGeneration(outputs,generation,activeOutputId);
    var nextGeneration=Object.assign({},generation);
    if(clean(data&&data.status).toUpperCase()==="COMPLETED"&&!hasFinal&&clean(data&&data.video_url))nextGeneration.finalizing=true;
    if(hasFinal||clean(data&&data.status).toUpperCase()==="FAILED")nextGeneration.finalizing=false;
    return Object.assign({},source,{
      id:clean(data&&data.projectId||fallbackId||source.id),
      status:statusFrom(data,nextGeneration,hasFinal),
      generation:nextGeneration,
      outputs:outputs,
      activeOutputId:activeOutputId
    });
  }
  function stateKey(source){
    var gen=source&&source.generation||{};
    return[
      clean(source&&source.id),clean(source&&source.status),clean(gen.requestId),clean(gen.status),
      clean(gen.updatedAt),clean(gen.videoUrl),clean(source&&source.activeOutputId),
      Array.isArray(source&&source.outputs)?source.outputs.length:0
    ].join("|");
  }
  function apply(data,fallbackId){
    if(!data||typeof data!=="object"||(!data.generation&&!data.project))return null;
    var next=projectFrom(data,fallbackId);
    if(!next||!clean(next.id))return null;
    var key=stateKey(next);if(key===lastKey)return next;
    lastKey=key;
    window.AIVOAdFilmActiveProject=next;
    document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:next,projectId:next.id,media:next.media||{}}}));
    return next;
  }
  function observeResponse(response,url,options){
    var path=endpoint(url);
    if([
      "/api/ad-film/seedance/create",
      "/api/ad-film/seedance/status",
      "/api/ad-film/seedance/finalize"
    ].indexOf(path)<0)return;
    var fallback=queryProjectId(url)||bodyProjectId(options)||currentId();
    try{
      response.clone().json().then(function(data){apply(data,fallback)}).catch(function(){});
    }catch(_){}
  }

  window.fetch=function(input,options){
    var url=requestUrl(input);
    return nativeFetch(input,options).then(function(response){observeResponse(response,url,options);return response});
  };

  async function refresh(){
    var id=currentId();if(!id||refreshFlight)return refreshFlight;
    refreshFlight=(async function(){
      try{
        var response=await nativeFetch("/api/ad-film/seedance/status?projectId="+encodeURIComponent(id),{method:"GET",credentials:"include",cache:"no-store",headers:{Accept:"application/json"}});
        var data=await response.json().catch(function(){return{}});
        if(response.ok)apply(data,id);
      }catch(error){console.warn("[ADFILM] server state refresh",error)}
    })().finally(function(){refreshFlight=null});
    return refreshFlight;
  }

  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(refresh,250)});
  document.addEventListener("aivo:adfilm-assets-ready",function(){setTimeout(refresh,120)});
  window.addEventListener("pageshow",function(){setTimeout(refresh,180)});
  window.AIVOAdFilmServerStateSync={apply:apply,refresh:refresh};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(refresh,350)},{once:true});else setTimeout(refresh,350);
})();
