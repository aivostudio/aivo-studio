/* AIVO AI Reklam Filmi — release finalization when both native avatar and Seedance source are ready */
(function AIVO_AD_FILM_AVATAR_FINALIZATION_BRIDGE(){
  "use strict";
  if(window.__AIVO_AD_FILM_AVATAR_FINALIZATION_BRIDGE_V1__)return;
  window.__AIVO_AD_FILM_AVATAR_FINALIZATION_BRIDGE_V1__=true;

  var previousFetch=window.fetch.bind(window);

  function urlOf(input){return typeof input==="string"?input:input&&input.url||""}
  async function readJson(response){try{return await response.clone().json()}catch(_){return null}}

  window.fetch=async function(input,init){
    var response=await previousFetch(input,init);
    var url=urlOf(input);
    if(url.indexOf("/api/ad-film/seedance/status")<0||!response.ok)return response;

    try{
      var data=await readJson(response);
      if(!data)return response;

      var current=window.AIVOAdFilmActiveProject||{};
      var pipeline=current.avatar&&current.avatar.pipeline||{};
      var sourceUrl=data.source_video_url||data.generation&&data.generation.sourceVideoUrl||current.generation&&current.generation.sourceVideoUrl||"";
      var avatarReady=pipeline.status==="completed"&&!!pipeline.videoUrl;
      var sourceReady=!!sourceUrl;

      if(avatarReady&&sourceReady){
        data.status="COMPLETED";
        data.video_url=sourceUrl;
        data.source_video_url=sourceUrl;
        data.source_ready=true;
        data.avatar_ready=true;
        data.generation=Object.assign({},data.generation||current.generation||{}, {
          status:"processing",
          sourceVideoUrl:sourceUrl,
          awaitingFinalComposite:true,
          avatarWaiting:false
        });
        return new Response(JSON.stringify(data),{
          status:response.status,
          statusText:response.statusText,
          headers:{"Content-Type":"application/json","Cache-Control":"no-store"}
        });
      }
    }catch(_){}

    return response;
  };
})();
