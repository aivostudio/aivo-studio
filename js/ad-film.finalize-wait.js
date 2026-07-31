/* AIVO AI Reklam Filmi — treat avatar finalization 425 as a waiting state */
(function AIVO_AD_FILM_FINALIZE_WAIT(){
  "use strict";
  if(window.__AIVO_AD_FILM_FINALIZE_WAIT_V2__)return;
  window.__AIVO_AD_FILM_FINALIZE_WAIT_V2__=true;

  var previousFetch=window.fetch.bind(window);
  var flights=new Map();
  var POLL_MS=3500;
  var MAX_POLLS=700;

  function clean(value){return String(value==null?"":value).trim()}
  function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function urlOf(input){return typeof input==="string"?input:input&&input.url||""}
  function isFinalize(input){return urlOf(input).indexOf("/api/ad-film/seedance/finalize")>=0}

  function requestData(init){
    try{return JSON.parse(init&&typeof init.body==="string"?init.body:"{}")||{}}
    catch(_){return{}}
  }

  function jsonResponse(payload,status){
    return new Response(JSON.stringify(payload),{
      status:status,
      headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}
    });
  }

  function stageKind(stage){
    stage=clean(stage).toLowerCase();
    if(stage.indexOf("matting")>=0)return"matting";
    if(stage.indexOf("lipsync")>=0)return"lipsync";
    return"motion";
  }

  function setWaitingStage(stage){
    var scope=document.querySelector('[data-module-root][data-module="adfilm"]');
    var status=scope&&scope.querySelector('[data-adfilm-engine-status]');
    var kind=stageKind(stage);
    var title=kind==="matting"
      ?text("Avatar transparanlaştırılıyor","Removing avatar background")
      :kind==="lipsync"
        ?text("Avatar konuşmaya uyarlanıyor","Synchronizing avatar speech")
        :text("Sinematik avatar performansı hazırlanıyor","Preparing cinematic avatar performance");
    var detail=kind==="matting"
      ?text("Saç, kıyafet ve beden kenarları işleniyor. Final montaj transparan video hazır olunca başlayacak.","Hair, clothing and body edges are being refined. Final compositing will start when the transparent video is ready.")
      :kind==="lipsync"
        ?text("Dudak, yüz ve konuşma zamanlaması tamamlanıyor. Üretim ekranını kapatma.","Lip, face and speech timing is being completed. Keep the production screen open.")
        :text("Beden hareketi, yürüyüş ve kamera koreografisi hazırlanıyor. Final işlem otomatik devam edecek.","Body motion, walking and camera choreography are being prepared. Finalization will continue automatically.");

    if(status){
      status.className="adfilm-engine-status is-visible is-busy";
      var strong=status.querySelector("b"),small=status.querySelector("small");
      if(strong)strong.textContent=title;
      if(small)small.textContent=detail;
    }
    var summary=scope&&scope.querySelector('.adfilm-actionbar__summary [data-adfilm-i18n="readyTitle"]');
    if(summary)summary.textContent=title;
    var action=scope&&scope.querySelector(".adfilm-actionbar");
    if(action)action.classList.add("is-engine-active");
    var button=scope&&scope.querySelector("[data-adfilm-build]");
    if(button){button.disabled=true;button.classList.add("is-generating")}
  }

  async function readJson(response){
    try{return await response.clone().json()}
    catch(_){return{}}
  }

  async function advanceAvatar(projectId){
    var response=await previousFetch(
      "/api/ad-film/avatar/pipeline/status?projectId="+encodeURIComponent(projectId),
      {method:"GET",credentials:"include",cache:"no-store",headers:{Accept:"application/json"}}
    );
    var data=await readJson(response);
    if(response.ok&&data.project){
      window.AIVOAdFilmActiveProject=data.project;
    }
    return{response:response,data:data};
  }

  async function waitForAvatar(input,init,projectId,firstPayload){
    setWaitingStage(clean(firstPayload&&firstPayload.avatar_status)||"motion");

    for(var count=0;count<MAX_POLLS;count++){
      var state;
      try{state=await advanceAvatar(projectId)}
      catch(error){
        if(count<8){await sleep(POLL_MS);continue}
        return jsonResponse({ok:false,error:"avatar_pipeline_status_failed",message:clean(error&&error.message)||"avatar_pipeline_status_failed"},503);
      }

      var data=state.data||{};
      var pipeline=data.pipeline||data.project&&data.project.avatar&&data.project.avatar.pipeline||{};
      var publicStatus=clean(data.status).toUpperCase();
      var pipelineStatus=clean(pipeline.status).toLowerCase();
      var currentStage=clean(data.stage||pipeline.stage||pipelineStatus);
      setWaitingStage(currentStage);

      if(publicStatus==="FAILED"||pipelineStatus==="failed"){
        return jsonResponse({
          ok:false,
          error:"avatar_pipeline_failed",
          message:clean(pipeline.error)||"avatar_pipeline_failed"
        },409);
      }

      var transparentUrl=clean(pipeline.transparentVideoUrl||data.video_url);
      if(publicStatus==="COMPLETED"&&pipelineStatus==="completed"&&transparentUrl){
        await sleep(250);
        var finalized=await previousFetch(input,init);
        if(finalized.status!==425)return finalized;
        var pending=await readJson(finalized);
        if(clean(pending.error)!=="avatar_video_processing")return finalized;
      }

      await sleep(POLL_MS);
    }

    return jsonResponse({ok:false,error:"avatar_pipeline_timeout",message:"avatar_pipeline_timeout"},504);
  }

  window.fetch=async function(input,init){
    var response=await previousFetch(input,init);
    if(!isFinalize(input)||response.status!==425)return response;

    var payload=await readJson(response);
    if(clean(payload.error)!=="avatar_video_processing")return response;

    var body=requestData(init);
    var projectId=clean(body.projectId);
    var outputId=clean(body.outputId);
    if(!projectId)return response;

    var key=projectId+"|"+outputId;
    if(!flights.has(key)){
      flights.set(key,waitForAvatar(input,init,projectId,payload).finally(function(){flights.delete(key)}));
    }

    var finalResponse=await flights.get(key);
    return finalResponse.clone();
  };
})();
