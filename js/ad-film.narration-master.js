/* AIVO AI Reklam Filmi — automatic narration mastering */
(function AIVO_AD_FILM_NARRATION_MASTER(){
  "use strict";
  if(window.__AIVO_AD_FILM_NARRATION_MASTER_V3__)return;
  window.__AIVO_AD_FILM_NARRATION_MASTER_V3__=true;

  var busy=false,currentPromise=null,attempted=new Set();
  function clean(value){return String(value||"").trim()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function lang(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0?"en":"tr"}
  function text(tr,en){return lang()==="en"?en:tr}
  function toast(message,type){try{var fn=window.toast&&window.toast[type||"info"];if(typeof fn==="function")return fn({message:message,duration:3200});if(typeof window.showToast==="function")return window.showToast(message,type||"info")}catch(_){} }
  function signature(source){var audio=source&&source.narration&&source.narration.audio;return[source&&source.id,audio&&audio.sourceUrl||audio&&audio.url,audio&&audio.createdAt,audio&&audio.masteringVersion].join("|")}

  function master(source,options){
    source=source||project();options=options||{};
    var audio=source&&source.narration&&source.narration.audio;
    if(!source||!source.id||!audio||!clean(audio.url))return Promise.resolve(null);
    if(audio.mastered===true&&Number(audio.masteringVersion)>=2)return Promise.resolve(source);
    if(busy&&currentPromise)return currentPromise;
    var key=signature(source);if(attempted.has(key)&&!options.force)return Promise.resolve(null);
    attempted.add(key);busy=true;

    currentPromise=(async function(){
      var handle=options.silent?null:toast(text("Ses daha doğal ve güçlü hale getiriliyor...","Refining narration for a more natural and powerful sound..."),"info");
      try{
        var response=await fetch("/api/ad-film/narration/master",{method:"POST",credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectId:source.id})});
        var data=await response.json().catch(function(){return{}});if(!response.ok||!data.project)throw new Error(data.message||data.error||"master_failed");
        if(handle&&typeof handle.dismiss==="function")handle.dismiss();
        window.AIVOAdFilmActiveProject=data.project;
        document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:data.project,projectId:data.project.id||"",media:data.project.media||{}}}));
        if(!options.silent)toast(text("Ses doğal ton ve yayın seviyesinde hazırlandı. Yeniden dinleyip onayla.","Narration was prepared with a natural tone and broadcast level. Preview and approve it again."),"success");
        return data.project;
      }catch(error){
        if(handle&&typeof handle.dismiss==="function")handle.dismiss();
        console.error("[ADFILM] narration mastering",error);attempted.delete(key);
        if(!options.silent)toast(text("Ses işleme tamamlanamadı. Tekrar denenecek.","Narration mastering could not finish. It will be retried."),"warning");
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
