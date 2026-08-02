/* AIVO AI Reklam Filmi — canonical production ID and fresh-launch coherence */
(function AIVO_AD_FILM_PRODUCTION_COHERENCE(){
  "use strict";
  if(window.__AIVO_AD_FILM_PRODUCTION_COHERENCE_V1__)return;
  window.__AIVO_AD_FILM_PRODUCTION_COHERENCE_V1__=true;

  var previousFetch=window.fetch.bind(window);
  var LATCH_KEY="__AIVO_AD_FILM_PRODUCTION_UI_LATCH__";

  function clean(value){return String(value==null?"":value).trim()}
  function urlOf(input){return typeof input==="string"?input:input&&input.url||""}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function currentProjectId(){return clean(project()&&project().id)}
  function lock(){return window.__AIVO_AD_FILM_PRODUCTION_LOCK__&&typeof window.__AIVO_AD_FILM_PRODUCTION_LOCK__==="object"?window.__AIVO_AD_FILM_PRODUCTION_LOCK__:null}
  function canonicalId(source){
    source=source||project()||{};
    var generation=source.generation||{},input=generation.input||{};
    return clean(generation.productionId||input.productionId||source.productionPlan&&source.productionPlan.productionId);
  }
  function parseBody(init){
    if(!init||typeof init.body!=="string")return null;
    try{var data=JSON.parse(init.body);return data&&typeof data==="object"?data:null}catch(_){return null}
  }
  function withBody(init,data){
    var next=Object.assign({},init||{});
    next.headers=Object.assign({},init&&init.headers||{}, {"Content-Type":"application/json"});
    next.body=JSON.stringify(data);
    return next;
  }
  async function readJson(response){try{return await response.clone().json()}catch(_){return null}}
  function syncProject(next,id){
    if(!next||typeof next!=="object")return;
    window.AIVOAdFilmActiveProject=next;
    document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:next,projectId:next.id||id||"",media:next.media||{}}}));
  }
  function updateLatch(productionId,startedAt,projectId){
    var now=Date.now(),current=window[LATCH_KEY]&&typeof window[LATCH_KEY]==="object"?window[LATCH_KEY]:{};
    window[LATCH_KEY]={
      projectId:clean(projectId||current.projectId||currentProjectId()),
      productionId:clean(productionId||current.productionId),
      startedAt:clean(startedAt||current.startedAt)||new Date(now).toISOString(),
      until:Math.max(Number(current.until||0),now+5*60*1000)
    };
  }
  function mergeCreated(data,projectId){
    if(!data||!data.generation)return;
    var current=project()||{};
    if(projectId&&clean(current.id)&&clean(current.id)!==clean(projectId))return;
    var next=Object.assign({},current,{
      status:"processing",
      generation:data.generation,
      activeOutputId:data.activeOutputId||null,
      finalization:null,
      error:null,
      lastError:null
    });
    if(data.director_plan)next.productionPlan=Object.assign({},data.director_plan,{productionId:clean(data.production_id||data.generation.productionId)});
    if(current.avatar)next.avatar=Object.assign({},current.avatar,{pipeline:null,videoUrl:null});
    syncProject(next,projectId);
    updateLatch(data.production_id||data.generation.productionId,data.generation.startedAt,projectId);
  }
  function isSeedanceCreate(url,init){return url.indexOf("/api/ad-film/seedance/create")>=0&&clean(init&&init.method||"GET").toUpperCase()==="POST"}
  function isPipelineWrite(url,init){
    if(clean(init&&init.method||"GET").toUpperCase()!=="POST")return false;
    return url.indexOf("/api/ad-film/avatar/pipeline/prepare")>=0||url.indexOf("/api/ad-film/avatar/pipeline/create-native-fixed")>=0||url.indexOf("/api/ad-film/avatar/pipeline/create-after-seedance")>=0;
  }

  window.fetch=async function(input,init){
    var url=urlOf(input),body=parseBody(init),nextInit=init;

    if(isSeedanceCreate(url,init)&&body){
      var currentLock=lock();
      if(currentLock&&clean(currentLock.id)&&(!body.projectId||!currentLock.projectId||clean(body.projectId)===clean(currentLock.projectId))){
        body.production_id=clean(currentLock.id);
        updateLatch(currentLock.id,currentLock.capturedAt,body.projectId);
        nextInit=withBody(init,body);
      }
      var createdResponse=await previousFetch(input,nextInit);
      if(createdResponse.ok){
        var createdData=await readJson(createdResponse);
        mergeCreated(createdData,body&&body.projectId);
      }
      return createdResponse;
    }

    if(isPipelineWrite(url,init)&&body){
      var accepted=canonicalId();
      var currentLock2=lock();
      if(!accepted&&currentLock2&&clean(currentLock2.projectId)===clean(body.projectId))accepted=clean(currentLock2.id);
      if(accepted&&clean(body.production_id)!==accepted){body.production_id=accepted;nextInit=withBody(init,body)}

      var response=await previousFetch(input,nextInit);
      var data=await readJson(response);
      if(response.status===409&&data&&data.error==="production_lock_mismatch"&&clean(data.accepted_production_id)){
        body.production_id=clean(data.accepted_production_id);
        updateLatch(body.production_id,null,body.projectId);
        response=await previousFetch(input,withBody(init,body));
        data=await readJson(response);
      }
      if(response.ok&&data&&data.project)syncProject(data.project,body.projectId);
      return response;
    }

    return previousFetch(input,init);
  };

  window.addEventListener("click",function(event){
    var button=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-adfilm-build]');
    if(!button||button.disabled)return;
    var now=new Date().toISOString();
    window.__AIVO_AD_FILM_LAUNCH_EPOCH__=now;
    updateLatch("",now,currentProjectId());
  },true);
})();
