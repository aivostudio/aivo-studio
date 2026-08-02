/* AIVO AI Reklam Filmi — advance native avatar and release finalization from the main poll */
(function AIVO_AD_FILM_AVATAR_FINALIZATION_BRIDGE(){
  "use strict";
  if(window.__AIVO_AD_FILM_AVATAR_FINALIZATION_BRIDGE_V2__)return;
  window.__AIVO_AD_FILM_AVATAR_FINALIZATION_BRIDGE_V2__=true;

  var previousFetch=window.fetch.bind(window);
  var avatarFlights=new Map();

  function clean(value){return String(value==null?"":value).trim()}
  function urlOf(input){return typeof input==="string"?input:input&&input.url||""}
  async function readJson(response){try{return await response.clone().json()}catch(_){return null}}
  function projectIdFrom(data){
    return clean(data&&data.projectId||window.AIVOAdFilmActiveProject&&window.AIVOAdFilmActiveProject.id);
  }
  function syncProject(next,id){
    if(!next)return;
    window.AIVOAdFilmActiveProject=next;
    document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{
      detail:{project:next,projectId:next.id||id||"",media:next.media||{}}
    }));
  }
  function jsonResponse(response,data){
    return new Response(JSON.stringify(data),{
      status:response.status,
      statusText:response.statusText,
      headers:{"Content-Type":"application/json","Cache-Control":"no-store"}
    });
  }
  function sourceUrlOf(data,current){
    return clean(
      data&&data.source_video_url||
      data&&data.generation&&data.generation.sourceVideoUrl||
      current&&current.generation&&current.generation.sourceVideoUrl
    );
  }
  function avatarEnabled(current){return current&&current.avatar&&current.avatar.enabled===true}
  function terminalPipeline(pipeline){
    var status=clean(pipeline&&pipeline.status).toLowerCase();
    return status==="completed"||status==="failed";
  }

  async function advanceAvatar(id){
    if(!id)return null;
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

  window.fetch=async function(input,init){
    var response=await previousFetch(input,init);
    var url=urlOf(input);
    if(url.indexOf("/api/ad-film/seedance/status")<0||!response.ok)return response;

    try{
      var data=await readJson(response);
      if(!data)return response;

      var current=window.AIVOAdFilmActiveProject||{};
      var id=projectIdFrom(data);
      var sourceUrl=sourceUrlOf(data,current);
      var sourceReady=Boolean(sourceUrl||data.source_ready===true);

      if(sourceReady&&id&&avatarEnabled(current)){
        var advanced=await advanceAvatar(id);
        var avatarData=advanced&&advanced.data||{};
        if(avatarData.project)current=avatarData.project;

        var pipeline=avatarData.pipeline||current.avatar&&current.avatar.pipeline||{};
        var publicStatus=clean(avatarData.status).toUpperCase();
        var pipelineStatus=clean(pipeline.status).toLowerCase();
        var avatarVideoUrl=clean(avatarData.video_url||pipeline.videoUrl);

        data.avatar_status=pipelineStatus||clean(avatarData.stage)||"waiting";
        data.avatar_stage=clean(avatarData.stage||pipeline.stage||pipelineStatus);

        if(publicStatus==="FAILED"||pipelineStatus==="failed"){
          data.status="FAILED";
          data.video_url=null;
          data.error=clean(avatarData.error||pipeline.error)||"avatar_pipeline_failed";
          data.generation=Object.assign({},data.generation||current.generation||{}, {
            status:"failed",
            error:data.error,
            avatarWaiting:false,
            awaitingFinalComposite:false
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
            status:"processing",
            sourceVideoUrl:sourceUrl,
            avatarVideoUrl:avatarVideoUrl,
            awaitingFinalComposite:true,
            avatarWaiting:false,
            finalizing:true,
            error:null
          });
          return jsonResponse(response,data);
        }

        data.status="RUNNING";
        data.video_url=null;
        data.source_video_url=sourceUrl;
        data.source_ready=true;
        data.generation=Object.assign({},data.generation||current.generation||{}, {
          status:"processing",
          sourceVideoUrl:sourceUrl,
          awaitingFinalComposite:true,
          avatarWaiting:true,
          finalizing:false,
          error:null
        });
        return jsonResponse(response,data);
      }

      var pipeline=current.avatar&&current.avatar.pipeline||{};
      if(sourceReady&&terminalPipeline(pipeline)){
        var status=clean(pipeline.status).toLowerCase();
        if(status==="completed"&&pipeline.videoUrl){
          data.status="COMPLETED";
          data.video_url=sourceUrl;
          data.source_video_url=sourceUrl;
          data.source_ready=true;
          data.avatar_ready=true;
          data.avatar_video_url=pipeline.videoUrl;
          data.generation=Object.assign({},data.generation||current.generation||{}, {
            status:"processing",
            sourceVideoUrl:sourceUrl,
            avatarVideoUrl:pipeline.videoUrl,
            awaitingFinalComposite:true,
            avatarWaiting:false,
            finalizing:true,
            error:null
          });
          return jsonResponse(response,data);
        }
      }
    }catch(error){
      console.warn("[ADFILM] avatar finalization bridge",error);
    }

    return response;
  };
})();