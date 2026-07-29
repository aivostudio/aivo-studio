/* AIVO AI Reklam Filmi — generate selected music before video production */
(function AIVO_AD_FILM_MUSIC_PREFLIGHT(){
  "use strict";
  if(window.__AIVO_AD_FILM_MUSIC_PREFLIGHT_V2__)return;
  window.__AIVO_AD_FILM_MUSIC_PREFLIGHT_V2__=true;

  var busy=false;
  function clean(v){return String(v||"").trim()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function text(tr,en){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0?en:tr}
  function toast(message,type,duration){try{var fn=window.toast&&window.toast[type||"info"];if(typeof fn==="function")return fn({message:message,duration:duration||4200});if(typeof window.showToast==="function")return window.showToast(message,type||"info")}catch(_){} }
  function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
  function musicReady(source){source=source||{};var mode=source.music&&source.music.mode||"auto";if(mode==="off")return true;if(mode==="upload")return!!clean(source.media&&source.media.musicTrack&&source.media.musicTrack.url);return!!clean(source.music&&source.music.audio&&source.music.audio.url)}
  function errorMessage(data,response){return clean(data&&(
    data.message||data.error||data.detail||
    data.fal_response&&data.fal_response.detail||
    data.project&&data.project.musicGeneration&&data.project.musicGeneration.error
  )||("HTTP "+response.status))}
  async function request(url,options){
    var r=await fetch(url,Object.assign({credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"}},options||{}));
    var d=await r.json().catch(function(){return{}});
    if(!r.ok){var e=new Error(errorMessage(d,r));e.data=d;e.status=r.status;throw e}
    return d;
  }
  function setBuildBusy(button,on){
    if(!button)return;
    button.classList.toggle("is-music-preparing",!!on);
    if(on)button.setAttribute("aria-busy","true");else button.removeAttribute("aria-busy");
    button.disabled=!!on;
  }
  async function ensureMusic(source,button){
    if(musicReady(source))return source;
    var handle=toast(text("Reklam müziği hazırlanıyor...","Preparing advertising music..."),"info",0);
    try{
      var created=await request("/api/ad-film/music/create",{method:"POST",body:JSON.stringify({projectId:source.id})});
      if(created.project)source=created.project;
      if(created.status==="DISABLED")return source;
      for(var i=0;i<120;i++){
        if(created.status==="COMPLETED"&&created.project){source=created.project;break}
        await sleep(1800);
        var status=await request("/api/ad-film/music/status?projectId="+encodeURIComponent(source.id),{method:"GET"});
        if(status.project)source=status.project;
        if(status.status==="FAILED")throw new Error(clean(status.error||source.musicGeneration&&source.musicGeneration.error)||"music_generation_failed");
        if(status.status==="COMPLETED"&&status.project){source=status.project;break}
      }
      if(!musicReady(source))throw new Error("music_generation_timeout");
      if(handle&&typeof handle.dismiss==="function")handle.dismiss();
      window.AIVOAdFilmActiveProject=source;
      document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:source,projectId:source.id||"",media:source.media||{}}}));
      toast(text("Reklam müziği hazır. Video üretimi başlıyor.","Advertising music is ready. Video generation is starting."),"success");
      return source;
    }catch(error){if(handle&&typeof handle.dismiss==="function")handle.dismiss();throw error}
    finally{setBuildBusy(button,false)}
  }

  document.addEventListener("click",function(event){
    var button=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-adfilm-build]');
    if(!button||busy)return;
    var guard=window.AIVOAdFilmNarrationBuildGuard&&window.AIVOAdFilmNarrationBuildGuard.state&&window.AIVOAdFilmNarrationBuildGuard.state();
    if(guard&&guard.ready===false)return;
    var source=project();if(!source||musicReady(source))return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    busy=true;setBuildBusy(button,true);
    ensureMusic(source,button).then(function(){
      busy=false;
      if(window.AIVOAdFilmNarrationBuildGuard&&typeof window.AIVOAdFilmNarrationBuildGuard.sync==="function")window.AIVOAdFilmNarrationBuildGuard.sync();
      if(window.AIVOAdFilmSeedanceEngine&&typeof window.AIVOAdFilmSeedanceEngine.generate==="function")window.AIVOAdFilmSeedanceEngine.generate();
    }).catch(function(error){
      busy=false;setBuildBusy(button,false);
      console.error("[ADFILM] music preflight",error,error&&error.data||"");
      var detail=clean(error&&error.message);
      var message=detail&&detail!=="music_generation_failed"&&detail!=="music_generation_timeout"
        ?text("Reklam müziği hazırlanamadı: ","Advertising music could not be prepared: ")+detail
        :text("Reklam müziği hazırlanamadı. Tekrar dene.","Advertising music could not be prepared. Try again.");
      toast(message,"error",6200);
    });
  },true);
})();
