/* AIVO AI Reklam Filmi — advance avatar, enforce SLA and release finalization */
(function AIVO_AD_FILM_AVATAR_FINALIZATION_BRIDGE(){
  "use strict";
  if(window.__AIVO_AD_FILM_AVATAR_FINALIZATION_BRIDGE_V7__)return;
  window.__AIVO_AD_FILM_AVATAR_FINALIZATION_BRIDGE_V7__=true;

  var previousFetch=window.fetch.bind(window);
  var avatarFlights=new Map();
  var guardFlights=new Map();
  var startFlights=new Map();

  function clean(value){return String(value==null?"":value).trim()}
  function urlOf(input){return typeof input==="string"?input:input&&input.url||""}
  async function readJson(response){try{return await response.clone().json()}catch(_){return null}}
  function projectIdFrom(data){return clean(data&&data.projectId||window.AIVOAdFilmActiveProject&&window.AIVOAdFilmActiveProject.id)}
  function projectIdFromUrl(url){try{return clean(new URL(url,location.origin).searchParams.get("projectId"))}catch(_){return""}}
  function syncProject(next,id){
    if(!next)return;
    window.AIVOAdFilmActiveProject=next;
    document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{
      detail:{project:next,projectId:next.id||id||"",media:next.media||{}}
    }));
  }
  function jsonResponse(response,data){
    return new Response(JSON.stringify(data),{
      status:response&&response.status||200,
      statusText:response&&response.statusText||"OK",
      headers:{"Content-Type":"application/json","Cache-Control":"no-store"}
    });
  }
  function generationOf(current){return current&&current.generation||{}}
  function sourceUrlOf(data,current){
    var generation=generationOf(current);
    return clean(data&&data.source_video_url||data&&data.generation&&data.generation.sourceVideoUrl||generation.sourceVideoUrl);
  }
  function avatarEnabled(current){return current&&current.avatar&&current.avatar.enabled===true}
  function terminalPipeline(pipeline){
    var status=clean(pipeline&&pipeline.status).toLowerCase();
    return status==="completed"||status==="failed"||status==="cancelled"||status==="canceled";
  }
  function pipelineNeedsStart(current){
    var pipeline=current&&current.avatar&&current.avatar.pipeline;
    var status=clean(pipeline&&pipeline.status).toLowerCase();
    var videoUrl=clean(pipeline&&pipeline.videoUrl);
    var pipelineProductionId=clean(pipeline&&pipeline.productionId);
    var currentProductionId=productionId(current);
    if(!pipeline||!status||status==="waiting_for_seedance"||status==="idle")return true;
    if(status==="completed"&&!videoUrl)return true;
    if(currentProductionId&&pipelineProductionId&&currentProductionId!==pipelineProductionId)return true;
    return false;
  }
  function productionId(current){
    var generation=generationOf(current),input=generation.input||{};
    return clean(generation.productionId||input.productionId||current&&current.productionPlan&&current.productionPlan.productionId);
  }
  function canonicalSeedanceReady(current){
    var generation=generationOf(current),input=generation.input||{};
    var id=clean(generation.productionId||input.productionId||current&&current.productionPlan&&current.productionPlan.productionId);
    return Boolean(
      id&&
      clean(generation.requestId)&&
      /^https:\/\//i.test(clean(generation.sourceVideoUrl||generation.videoUrl))&&
      ["queued","processing","completed"].indexOf(clean(generation.status).toLowerCase())>=0
    );
  }
  function duration(current){
    var generation=generationOf(current),input=generation.input||{},pipeline=current&&current.avatar&&current.avatar.pipeline||{};
    return clean(input.duration||current&&current.output&&current.output.duration||pipeline.duration||"10");
  }
  function ratio(current){
    var generation=generationOf(current),input=generation.input||{},pipeline=current&&current.avatar&&current.avatar.pipeline||{};
    var value=clean(input.aspectRatio||input.aspect_ratio||current&&current.output&&current.output.aspectRatio||pipeline.aspectRatio||"16:9");
    return value==="4:5"?"3:4":value;
  }
  function quality(current){
    var generation=generationOf(current),input=generation.input||{},pipeline=current&&current.avatar&&current.avatar.pipeline||{};
    return clean(input.resolution||current&&current.output&&current.output.quality||pipeline.quality||"1080p").toLowerCase();
  }

  async function enforceGuard(id){
    if(!id)return null;
    if(!guardFlights.has(id)){
      guardFlights.set(id,(async function(){
        var response=await previousFetch(
          "/api/ad-film/production/guard?projectId="+encodeURIComponent(id),
          {method:"GET",credentials:"include",cache:"no-store",headers:{Accept:"application/json"}}
        );
        var data=await readJson(response)||{};
        if(response.ok&&data.project)syncProject(data.project,id);
        return{response:response,data:data};
      })().finally(function(){guardFlights.delete(id)}));
    }
    return guardFlights.get(id);
  }

  async function ensureAvatarStarted(id,current){
    if(!id||!avatarEnabled(current)||!pipelineNeedsStart(current)||!canonicalSeedanceReady(current))return current;
    var lock=productionId(current);if(!lock)return current;
    var key=id+"|"+lock;
    if(!startFlights.has(key)){
      startFlights.set(key,(async function(){
        var response=await previousFetch("/api/ad-film/avatar/pipeline/create-native-fixed",{
          method:"POST",credentials:"include",cache:"no-store",
          headers:{"Content-Type":"application/json",Accept:"application/json"},
          body:JSON.stringify({
            projectId:id,
            production_id:lock,
            duration:duration(current),
            aspect_ratio:ratio(current),
            quality:quality(current)
          })
        });
        var data=await readJson(response)||{};
        if(response.ok&&data.project){syncProject(data.project,id);return data.project}
        if(response.status===409&&data.error==="production_already_completed"){
          console.warn("[ADFILM] avatar start rejected by completed-output guard",data);
          return current;
        }
        if(response.status===409&&data.error==="production_lock_mismatch"){
          console.warn("[ADFILM] avatar start skipped: production lock unavailable",data);
          return current;
        }
        if(response.status===425&&data.error==="seedance_generation_not_ready")return current;
        if(!response.ok)throw new Error(clean(data.error||data.message)||"avatar_pipeline_not_started");
        return current;
      })().finally(function(){startFlights.delete(key)}));
    }
    return startFlights.get(key);
  }

  async function advanceAvatar(id,current){
    if(!id)return null;
    current=await ensureAvatarStarted(id,current||window.AIVOAdFilmActiveProject||{});
    if(!avatarFlights.has(id)){
      avatarFlights.set(id,(async function(){
        var response=await previousFetch(
          "/api/ad-film/avatar/pipeline/status-native?projectId="+encodeURIComponent(id),
          {method:"GET",credentials:"include",cache:"no-store",headers:{Accept:"application/json"}}
        );
        var data=await readJson(response)||{};
        if(response.ok&&data.project)syncProject(data.project,id);
        return{response:response,data:data};
      })().finally(function(){avatarFlights.delete(id)}));
    }
    return avatarFlights.get(id);
  }

  function isCancelled(guardData){
    return clean(guardData&&guardData.status).toUpperCase()==="CANCELLED"||guardData&&guardData.error==="production_sla_timeout";
  }
  function cancelledData(guardData){
    var project=guardData&&guardData.project||{};
    return{
      ok:true,
      projectId:project.id||null,
      status:"FAILED",
      stage:"cancelled",
      error:"production_sla_timeout",
      cancelled:true,
      video_url:null,
      source_video_url:project.generation&&project.generation.sourceVideoUrl||null,
      refund_eligible:true,
      refund_status:guardData&&guardData.refund_status||"pending_credit_system",
      deadline_at:guardData&&guardData.deadline_at||null,
      elapsed_ms:guardData&&guardData.elapsed_ms||null,
      limit_ms:guardData&&guardData.limit_ms||null,
      generation:Object.assign({},project.generation||{}, {
        status:"failed",error:"production_sla_timeout",avatarWaiting:false,awaitingFinalComposite:false,finalizing:false
      }),
      pipeline:project.avatar&&project.avatar.pipeline||null,
      project:project
    };
  }
  function cancelledPayload(response,data,guardData){
    return jsonResponse(response,Object.assign({},data||{},cancelledData(guardData)));
  }

  window.fetch=async function(input,init){
    var url=urlOf(input);
    var isSeedanceStatus=url.indexOf("/api/ad-film/seedance/status")>=0;
    var isAvatarStatus=url.indexOf("/api/ad-film/avatar/pipeline/status-native")>=0;

    if(isAvatarStatus){
      try{
        var directId=projectIdFromUrl(url)||projectIdFrom(null);
        var directGuard=await enforceGuard(directId);
        if(isCancelled(directGuard&&directGuard.data))return jsonResponse(null,cancelledData(directGuard.data));
      }catch(error){console.warn("[ADFILM] production guard",error)}
    }

    var response=await previousFetch(input,init);
    if(!isSeedanceStatus||!response.ok)return response;

    try{
      var data=await readJson(response);
      if(!data)return response;

      var current=window.AIVOAdFilmActiveProject||{};
      var id=projectIdFrom(data);
      if(id){
        var guarded=await enforceGuard(id);
        var guardData=guarded&&guarded.data||{};
        if(isCancelled(guardData))return cancelledPayload(response,data,guardData);
        if(guardData.project)current=guardData.project;
      }

      var sourceUrl=sourceUrlOf(data,current);
      var sourceReady=Boolean(sourceUrl||data.source_ready===true);
      var seedanceReady=canonicalSeedanceReady(current);

      if(sourceReady&&seedanceReady&&id&&avatarEnabled(current)){
        var advanced=await advanceAvatar(id,current);
        var avatarData=advanced&&advanced.data||{};
        if(avatarData.project)current=avatarData.project;

        var pipeline=avatarData.pipeline||current.avatar&&current.avatar.pipeline||{};
        var publicStatus=clean(avatarData.status).toUpperCase();
        var pipelineStatus=clean(pipeline.status).toLowerCase();
        var avatarVideoUrl=clean(avatarData.video_url||pipeline.videoUrl);

        data.avatar_status=pipelineStatus||clean(avatarData.stage)||"waiting";
        data.avatar_stage=clean(avatarData.stage||pipeline.stage||pipelineStatus);

        if(publicStatus==="FAILED"||["failed","cancelled","canceled"].indexOf(pipelineStatus)>=0){
          data.status="FAILED";
          data.video_url=null;
          data.error=clean(avatarData.error||pipeline.error)||"avatar_pipeline_failed";
          data.refund_eligible=data.error==="production_sla_timeout";
          data.generation=Object.assign({},data.generation||current.generation||{}, {
            status:"failed",error:data.error,avatarWaiting:false,awaitingFinalComposite:false,finalizing:false
          });
          return jsonResponse(response,data);
        }

        if(publicStatus==="COMPLETED"&&pipelineStatus==="completed"&&avatarVideoUrl){
          data.status="COMPLETED";
          data.video_url=sourceUrl;
          data.source_video_url=sourceUrl;
          data.source_ready=true;
          data.avatar_ready=true;
          data.avatar_video_url=avatarVideoUrl;
          data.generation=Object.assign({},data.generation||current.generation||{}, {
            status:"processing",sourceVideoUrl:sourceUrl,avatarVideoUrl:avatarVideoUrl,
            awaitingFinalComposite:true,avatarWaiting:false,finalizing:true,error:null
          });
          return jsonResponse(response,data);
        }

        data.status="RUNNING";
        data.video_url=null;
        data.source_video_url=sourceUrl;
        data.source_ready=true;
        data.generation=Object.assign({},data.generation||current.generation||{}, {
          status:"processing",sourceVideoUrl:sourceUrl,awaitingFinalComposite:true,
          avatarWaiting:true,finalizing:false,error:null
        });
        return jsonResponse(response,data);
      }

      var pipeline=current.avatar&&current.avatar.pipeline||{};
      if(sourceReady&&seedanceReady&&terminalPipeline(pipeline)){
        var status=clean(pipeline.status).toLowerCase();
        if(status==="completed"&&pipeline.videoUrl){
          data.status="COMPLETED";
          data.video_url=sourceUrl;
          data.source_video_url=sourceUrl;
          data.source_ready=true;
          data.avatar_ready=true;
          data.avatar_video_url=pipeline.videoUrl;
          data.generation=Object.assign({},data.generation||current.generation||{}, {
            status:"processing",sourceVideoUrl:sourceUrl,avatarVideoUrl:pipeline.videoUrl,
            awaitingFinalComposite:true,avatarWaiting:false,finalizing:true,error:null
          });
          return jsonResponse(response,data);
        }
      }
    }catch(error){
      console.warn("[ADFILM] avatar finalization bridge",error);
      return response;
    }

    return response;
  };
})();
