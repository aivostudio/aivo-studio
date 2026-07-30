/* AIVO AI Reklam Filmi — automatic narration mastering */
(function AIVO_AD_FILM_NARRATION_MASTER(){
  "use strict";
  if(window.__AIVO_AD_FILM_NARRATION_MASTER_V4__)return;
  window.__AIVO_AD_FILM_NARRATION_MASTER_V4__=true;

  var busy=false,currentPromise=null,attempted=new Set();
  function clean(value){return String(value||"").trim()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function lang(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0?"en":"tr"}
  function text(tr,en){return lang()==="en"?en:tr}
  function toast(message,type){try{var fn=window.toast&&window.toast[type||"info"];if(typeof fn==="function")return fn({message:message,duration:3200});if(typeof window.showToast==="function")return window.showToast(message,type||"info")}catch(_){} }
  function signature(source){var audio=source&&source.narration&&source.narration.audio;return[source&&source.id,audio&&audio.sourceUrl||audio&&audio.url,audio&&audio.createdAt,audio&&audio.masteringVersion].join("|")}
  function emit(status,detail){document.dispatchEvent(new CustomEvent("aivo:adfilm-narration-mastering",{detail:Object.assign({status:status},detail||{})}))}
  function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}

  function master(source,options){
    source=source||project();options=options||{};
    var audio=source&&source.narration&&source.narration.audio;
    if(!source||!source.id||!audio||!clean(audio.url))return Promise.resolve(null);
    if(audio.mastered===true&&Number(audio.masteringVersion)>=2)return Promise.resolve(source);
    if(busy&&currentPromise)return currentPromise;
    var key=signature(source);if(attempted.has(key)&&!options.force)return Promise.resolve(null);
    attempted.add(key);busy=true;

    currentPromise=(async function(){
      var handle=options.silent?null:toast(text("Ses profesyonel olarak işleniyor...","The voice is being professionally processed..."),"info");
      emit("processing",{project:source});
      var lastError=null;
      try{
        for(var attempt=0;attempt<2;attempt++){
          try{
            if(attempt>0){emit("retrying",{project:project()||source,attempt:attempt+1});await sleep(1400)}
            var current=project()||source;
            var response=await fetch("/api/ad-film/narration/master",{method:"POST",credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectId:current.id})});
            var data=await response.json().catch(function(){return{}});
            if(!response.ok||!data.project)throw new Error(data.message||data.error||"master_failed");
            if(handle&&typeof handle.dismiss==="function")handle.dismiss();
            window.AIVOAdFilmActiveProject=data.project;
            emit("completed",{project:data.project});
            document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:data.project,projectId:data.project.id||"",media:data.project.media||{}}}));
            if(!options.silent)toast(text("Ses doğal ton ve yayın seviyesinde hazırlandı. Dinleyip onaylayabilirsin.","The voice was prepared with a natural tone and broadcast level. Preview and approve it."),"success");
            return data.project;
          }catch(error){lastError=error;console.warn("[ADFILM] narration mastering attempt",attempt+1,error)}
        }
        attempted.delete(key);
        if(handle&&typeof handle.dismiss==="function")handle.dismiss();
        emit("failed",{project:project()||source,error:clean(lastError&&lastError.message)});
        if(!options.silent)toast(text("Ses işleme şu anda tamamlanamadı. Biraz sonra yeniden deneyebilirsin.","Voice processing could not finish right now. You can try again shortly."),"warning");
        return null;
      }finally{busy=false;currentPromise=null}
    })();
    return currentPromise;
  }

  function schedule(source,delay){setTimeout(function(){master(source||project())},delay==null?100:delay)}
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")schedule(project(),500)});
  document.addEventListener("aivo:adfilm-project-sync",function(event){schedule(event&&event.detail&&event.detail.project,120)});
  window.addEventListener("pageshow",function(){schedule(project(),600)});
  window.AIVOAdFilmNarrationMaster={run:function(options){return master(project(),options||{})},isBusy:function(){return busy},promise:function(){return currentPromise}};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){if(root())schedule(project(),500)},{once:true});else if(root())schedule(project(),500);
})();
