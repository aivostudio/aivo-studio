/* AIVO AI Reklam Filmi — generate selected music before video production */
(function AIVO_AD_FILM_MUSIC_PREFLIGHT(){
  "use strict";
  if(window.__AIVO_AD_FILM_MUSIC_PREFLIGHT_V1__)return;
  window.__AIVO_AD_FILM_MUSIC_PREFLIGHT_V1__=true;

  var busy=false;
  function clean(v){return String(v||"").trim()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function text(tr,en){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0?en:tr}
  function toast(message,type){try{var fn=window.toast&&window.toast[type||"info"];if(typeof fn==="function")return fn({message:message,duration:3600});if(typeof window.showToast==="function")return window.showToast(message,type||"info")}catch(_){} }
  function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
  function musicReady(source){source=source||{};var mode=source.music&&source.music.mode||"auto";if(mode==="off")return true;if(mode==="upload")return!!clean(source.media&&source.media.musicTrack&&source.media.musicTrack.url);return!!clean(source.music&&source.music.audio&&source.music.audio.url)}
  async function request(url,options){var r=await fetch(url,Object.assign({credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"}},options||{}));var d=await r.json().catch(function(){return{}});if(!r.ok)throw new Error(d.error||"request_failed");return d}
  async function ensureMusic(source){
    if(musicReady(source))return source;
    var handle=toast(text("Reklam müziği hazırlanıyor...","Preparing advertising music..."),"info");
    try{
      var created=await request("/api/ad-film/music/create",{method:"POST",body:JSON.stringify({projectId:source.id})});
      if(created.project)source=created.project;
      for(var i=0;i<120;i++){
        if(created.status==="COMPLETED"&&created.project){source=created.project;break}
        await sleep(1800);
        var status=await request("/api/ad-film/music/status?projectId="+encodeURIComponent(source.id),{method:"GET"});
        if(status.status==="FAILED")throw new Error("music_generation_failed");
        if(status.status==="COMPLETED"&&status.project){source=status.project;break}
      }
      if(!musicReady(source))throw new Error("music_generation_timeout");
      if(handle&&typeof handle.dismiss==="function")handle.dismiss();
      window.AIVOAdFilmActiveProject=source;
      document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:source,projectId:source.id||"",media:source.media||{}}}));
      toast(text("Reklam müziği hazır.","Advertising music is ready."),"success");
      return source;
    }catch(error){if(handle&&typeof handle.dismiss==="function")handle.dismiss();throw error}
  }

  document.addEventListener("click",function(event){
    var button=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-adfilm-build]');
    if(!button||busy)return;
    var source=project();if(!source||musicReady(source))return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    busy=true;button.disabled=true;
    ensureMusic(source).then(function(){busy=false;button.disabled=false;if(window.AIVOAdFilmNarrationBuildGuard&&typeof window.AIVOAdFilmNarrationBuildGuard.sync==="function")window.AIVOAdFilmNarrationBuildGuard.sync();if(window.AIVOAdFilmSeedanceEngine&&typeof window.AIVOAdFilmSeedanceEngine.generate==="function")window.AIVOAdFilmSeedanceEngine.generate()}).catch(function(error){busy=false;button.disabled=false;console.error("[ADFILM] music preflight",error);toast(text("Reklam müziği hazırlanamadı. Tekrar dene.","Advertising music could not be prepared. Try again."),"error")});
  },true);
})();
