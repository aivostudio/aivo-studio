/* AIVO AI Reklam Filmi — canonical fresh-production coherence */
(function AIVO_AD_FILM_PRODUCTION_COHERENCE(){
  "use strict";
  if(window.__AIVO_AD_FILM_PRODUCTION_COHERENCE_V5__)return;
  window.__AIVO_AD_FILM_PRODUCTION_COHERENCE_V5__=true;

  var previousFetch=window.fetch.bind(window);
  var LATCH_KEY="__AIVO_AD_FILM_PRODUCTION_UI_LATCH__";
  var launch=null;
  var canonicalSnapshot=null;

  function clean(value){return String(value==null?"":value).trim()}
  function lower(value){return clean(value).toLowerCase()}
  function urlOf(input){return typeof input==="string"?input:input&&input.url||""}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function currentProjectId(){var scope=document.querySelector('[data-module-root][data-module="adfilm"]');return clean(project()&&project().id||scope&&scope.dataset.adfilmProjectId)}
  function lock(){return window.__AIVO_AD_FILM_PRODUCTION_LOCK__&&typeof window.__AIVO_AD_FILM_PRODUCTION_LOCK__==="object"?window.__AIVO_AD_FILM_PRODUCTION_LOCK__:null}
  function forceFresh(){return window.__AIVO_AD_FILM_FORCE_FRESH__&&typeof window.__AIVO_AD_FILM_FORCE_FRESH__==="object"?window.__AIVO_AD_FILM_FORCE_FRESH__:null}
  function canonicalId(source){source=source||project()||{};var generation=source.generation||{},input=generation.input||{};return clean(generation.productionId||input.productionId||source.productionPlan&&source.productionPlan.productionId)}
  function productionId(){var force=forceFresh(),currentLock=lock();return clean(currentLock&&currentLock.id||force&&force.productionId||launch&&launch.productionId||canonicalId())}
  function parseBody(init){if(!init||typeof init.body!=="string")return null;try{var data=JSON.parse(init.body);return data&&typeof data==="object"?data:null}catch(_){return null}}
  function withBody(init,data){var next=Object.assign({},init||{});next.headers=Object.assign({},init&&init.headers||{}, {"Content-Type":"application/json"});next.body=JSON.stringify(data);return next}
  async function readJson(response){try{return await response.clone().json()}catch(_){return null}}
  function syncProject(next,id){if(!next||typeof next!=="object")return;canonicalSnapshot=next;window.AIVOAdFilmActiveProject=next;document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:next,projectId:next.id||id||"",media:next.media||{}}}))}
  function updateLatch(productionIdValue,startedAt,projectId){var now=Date.now(),current=window[LATCH_KEY]&&typeof window[LATCH_KEY]==="object"?window[LATCH_KEY]:{};window[LATCH_KEY]={projectId:clean(projectId||current.projectId||currentProjectId()),productionId:clean(productionIdValue||current.productionId),startedAt:clean(startedAt||current.startedAt)||new Date(now).toISOString(),until:Math.max(Number(current.until||0),now+30*60*1000)}}
  function adoptActualLock(pid){
    pid=clean(pid);if(!pid)return;
    if(launch)launch.productionId=pid;
    var force=forceFresh();if(force)force.productionId=pid;
    updateLatch(pid,launch&&launch.startedAt,currentProjectId());
  }
  function optimisticLaunch(now,pid){
    var current=project();if(!current)return;
    var next=Object.assign({},current,{status:"processing",generation:{status:"processing",startedAt:now,updatedAt:now,requestId:null,outputId:null,productionId:pid,sourceVideoUrl:null,videoUrl:null,completedAt:null,avatarWaiting:false,awaitingFinalComposite:false,finalizing:false,sourceOnly:false,error:null,input:{productionId:pid}},activeOutputId:null,finalization:null,error:null,lastError:null,preparingNewVersion:true});
    if(current.avatar)next.avatar=Object.assign({},current.avatar,{pipeline:null,videoUrl:null});
    canonicalSnapshot=next;syncProject(next,current.id);
  }
  function mergeCreated(data,projectId){
    if(!data||!data.generation)return;
    var current=project()||{};if(projectId&&clean(current.id)&&clean(current.id)!==clean(projectId))return;
    var createdId=clean(data.production_id||data.generation.productionId||data.generation.input&&data.generation.input.productionId);
    adoptActualLock(createdId);
    var next=Object.assign({},current,{status:"processing",generation:data.generation,activeOutputId:data.activeOutputId||null,finalization:null,error:null,lastError:null,preparingNewVersion:false});
    if(data.director_plan)next.productionPlan=Object.assign({},data.director_plan,{productionId:createdId});
    if(current.avatar)next.avatar=Object.assign({},current.avatar,{pipeline:null,videoUrl:null});
    canonicalSnapshot=next;syncProject(next,projectId);updateLatch(createdId,data.generation.startedAt,projectId);
    if(launch)launch.accepted=true;
  }
  function isSeedanceCreate(url,init){return url.indexOf("/api/ad-film/seedance/create")>=0&&clean(init&&init.method||"GET").toUpperCase()==="POST"}
  function isSeedanceStatus(url){return url.indexOf("/api/ad-film/seedance/status")>=0}
  function isPipelineWrite(url,init){if(clean(init&&init.method||"GET").toUpperCase()!=="POST")return false;return url.indexOf("/api/ad-film/avatar/pipeline/prepare")>=0||url.indexOf("/api/ad-film/avatar/pipeline/create-native-fixed")>=0||url.indexOf("/api/ad-film/avatar/pipeline/create-after-seedance")>=0}
  function sameLaunchProject(next){return launch&&next&&clean(next.id)===clean(launch.projectId)}
  function staleProject(next){
    if(!sameLaunchProject(next))return false;
    var id=canonicalId(next),expected=productionId();
    if(id&&id===expected)return false;
    var status=lower(next&&next.status||next&&next.generation&&next.generation.status);
    if(["failed","cancelled","canceled"].indexOf(status)>=0&&id===expected)return false;
    return true;
  }
  async function supersede(projectId,pid){
    var response=await previousFetch("/api/ad-film/production/supersede",{method:"POST",credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({projectId:projectId,production_id:pid})});
    var data=await readJson(response)||{};
    if(!response.ok)throw new Error(clean(data.error||data.message)||"production_supersede_failed");
    return data;
  }
  async function awaitPrepared(){if(launch&&launch.promise)await launch.promise}

  window.fetch=async function(input,init){
    var url=urlOf(input),body=parseBody(init),nextInit=init;

    if((isSeedanceCreate(url,init)||isSeedanceStatus(url)||isPipelineWrite(url,init))&&launch&&!launch.accepted){await awaitPrepared()}

    if(isSeedanceCreate(url,init)&&body){
      var currentLock=lock();
      if(currentLock&&clean(currentLock.id))adoptActualLock(currentLock.id);
      var pid=productionId();
      if(pid){body.production_id=pid;nextInit=withBody(init,body);updateLatch(pid,launch&&launch.startedAt,body.projectId)}
      var createdResponse=await previousFetch(input,nextInit);
      if(createdResponse.ok){var createdData=await readJson(createdResponse);mergeCreated(createdData,body&&body.projectId)}
      return createdResponse;
    }

    if(isPipelineWrite(url,init)&&body){
      var expected=productionId()||canonicalId();
      if(expected&&clean(body.production_id)!==expected){body.production_id=expected;nextInit=withBody(init,body)}
      var response=await previousFetch(input,nextInit),data=await readJson(response);
      if(response.status===409&&data&&data.error==="production_lock_mismatch"){
        console.error("[ADFILM] stale production lock rejected",{expected:expected,accepted:data.accepted_production_id||null,projectId:body.projectId||null});
        return response;
      }
      if(response.ok&&data&&data.project){
        var responseId=canonicalId(data.project);
        if(!launch||!responseId||responseId===productionId())syncProject(data.project,body.projectId);
      }
      return response;
    }

    return previousFetch(input,init);
  };

  document.addEventListener("aivo:adfilm-project-sync",function(event){
    var next=event&&event.detail&&event.detail.project;
    if(!staleProject(next))return;
    event.preventDefault();event.stopImmediatePropagation();
    if(canonicalSnapshot)window.AIVOAdFilmActiveProject=canonicalSnapshot;
  },true);

  window.addEventListener("click",function(event){
    var button=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-adfilm-build]');
    if(!button||button.disabled)return;
    var projectId=currentProjectId();if(!projectId)return;
    var now=new Date().toISOString();
    var pid="adfilm-"+Date.now()+"-"+Math.random().toString(36).slice(2,10);
    window.__AIVO_AD_FILM_LAUNCH_EPOCH__=now;
    window.__AIVO_AD_FILM_FORCE_FRESH__={projectId:projectId,productionId:pid,startedAt:now,until:Date.now()+30*60*1000};
    window.__AIVO_AD_FILM_PRODUCTION_LOCK__=Object.freeze({id:pid,projectId:projectId,capturedAt:now});
    launch={projectId:projectId,productionId:pid,startedAt:now,accepted:false,promise:null};
    updateLatch(pid,now,projectId);optimisticLaunch(now,pid);
    launch.promise=supersede(projectId,pid).then(function(data){
      if(data&&data.project){
        var prepared=Object.assign({},data.project,{status:"processing",generation:canonicalSnapshot&&canonicalSnapshot.generation||null,preparingNewVersion:true,error:null,lastError:null});
        canonicalSnapshot=prepared;window.AIVOAdFilmActiveProject=prepared;
      }
      return data;
    }).catch(function(error){launch=null;throw error});
  },true);
})();
