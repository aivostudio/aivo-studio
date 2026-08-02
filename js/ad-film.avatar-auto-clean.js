/* AIVO AI Reklam Filmi — generated avatar automatic transparent cleanup */
(function AIVO_AD_FILM_AVATAR_AUTO_CLEAN(){
  "use strict";
  if(window.__AIVO_AD_FILM_AVATAR_AUTO_CLEAN_V1__)return;
  window.__AIVO_AD_FILM_AVATAR_AUTO_CLEAN_V1__=true;

  var nativeFetch=window.fetch.bind(window);
  var cleanFlights=new Map();

  function clean(value){return String(value==null?"":value).trim()}
  function urlOf(input){return typeof input==="string"?input:input&&input.url||""}
  function methodOf(input,init){return clean(init&&init.method||input&&input.method||"GET").toUpperCase()}
  function jsonResponse(data,status){
    return new Response(JSON.stringify(data),{
      status:status||200,
      headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}
    });
  }
  async function readJson(response){try{return await response.clone().json()}catch(_){return null}}
  function projectIdFrom(data,init){
    var id=clean(data&&data.projectId||data&&data.project&&data.project.id);
    if(id)return id;
    try{
      var body=init&&init.body;
      if(typeof body==="string")return clean(JSON.parse(body).projectId);
    }catch(_){}
    return"";
  }
  function generatedNeedsClean(data){
    var image=data&&data.avatar&&data.avatar.image||data&&data.project&&data.project.avatar&&data.project.avatar.image||{};
    return image.source==="generated"&&image.backgroundRemoved!==true&&image.transparent!==true&&/^https:\/\//i.test(clean(image.url));
  }
  async function runClean(projectId){
    if(!cleanFlights.has(projectId)){
      cleanFlights.set(projectId,(async function(){
        var response=await nativeFetch("/api/ad-film/avatar/clean",{
          method:"POST",
          credentials:"include",
          cache:"no-store",
          headers:{"Content-Type":"application/json","Accept":"application/json"},
          body:JSON.stringify({projectId:projectId})
        });
        var data=await readJson(response)||{};
        if(!response.ok||!data.project){
          var error=new Error(data.message||data.error||"avatar_background_removal_failed");
          error.status=response.status;
          error.data=data;
          throw error;
        }
        return data;
      })().finally(function(){cleanFlights.delete(projectId)}));
    }
    return cleanFlights.get(projectId);
  }
  function updatePreviewLabel(){
    var source=document.querySelector('[data-adfilm-avatar-card] [data-avatar-source]');
    var image=window.AIVOAdFilmActiveProject&&window.AIVOAdFilmActiveProject.avatar&&window.AIVOAdFilmActiveProject.avatar.image||{};
    if(!source||image.backgroundRemoved!==true)return;
    var en=String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0;
    source.textContent=en?"Background removed · Transparent PNG":"Arka plan kaldırıldı · Transparan PNG";
    var preview=source.closest('[data-avatar-preview]');if(preview)preview.setAttribute("data-avatar-transparent","1");
  }

  window.fetch=async function(input,init){
    var response=await nativeFetch(input,init);
    var url=urlOf(input);
    if(url.indexOf("/api/ad-film/avatar/create")<0||methodOf(input,init)!=="POST")return response;

    var data=await readJson(response);
    if(!response.ok||!data||!generatedNeedsClean(data))return response;

    var projectId=projectIdFrom(data,init);
    if(!projectId)return jsonResponse({ok:false,error:"missing_project_id_for_avatar_cleanup"},500);

    try{
      document.dispatchEvent(new CustomEvent("aivo:adfilm-avatar-cleaning",{detail:{projectId:projectId}}));
      var cleaned=await runClean(projectId);
      if(cleaned.project){
        window.AIVOAdFilmActiveProject=cleaned.project;
        document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{
          detail:{project:cleaned.project,projectId:cleaned.project.id||projectId,media:cleaned.project.media||{}}
        }));
      }
      document.dispatchEvent(new CustomEvent("aivo:adfilm-avatar-cleaned",{detail:{projectId:projectId,project:cleaned.project||null}}));
      setTimeout(updatePreviewLabel,0);
      setTimeout(updatePreviewLabel,120);
      return jsonResponse(cleaned,200);
    }catch(error){
      console.error("[ADFILM] avatar automatic cleanup",error);
      var message=clean(error&&error.message)||"avatar_background_removal_failed";
      document.dispatchEvent(new CustomEvent("aivo:adfilm-avatar-clean-failed",{detail:{projectId:projectId,error:message}}));
      return jsonResponse({ok:false,error:message,message:message,projectId:projectId},Number(error&&error.status)||502);
    }
  };

  document.addEventListener("aivo:adfilm-project-sync",function(){setTimeout(updatePreviewLabel,40)});
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(updatePreviewLabel,250)});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(updatePreviewLabel,350)},{once:true});else setTimeout(updatePreviewLabel,350);
})();
