/* AIVO AI Reklam Filmi — upgrade completed outputs to the latest audio mix */
(function AIVO_AD_FILM_MIX_UPGRADE(){
  "use strict";
  if(window.__AIVO_AD_FILM_MIX_UPGRADE_V1__)return;
  window.__AIVO_AD_FILM_MIX_UPGRADE_V1__=true;

  var TARGET_MIX_VERSION=6;
  var busy=false;
  var attempted=new Set();
  var timer=null;

  function clean(value){return String(value||"").trim()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function outputOf(source){
    source=source||{};
    var outputs=Array.isArray(source.outputs)?source.outputs.filter(function(item){return item&&clean(item.videoUrl)}):[];
    var id=clean(source.activeOutputId||source.generation&&source.generation.outputId);
    return outputs.find(function(item){return clean(item.id)===id})||outputs[0]||null;
  }
  function musicUrl(source){
    var mode=source&&source.music&&source.music.mode||"auto";
    if(mode==="off")return"";
    if(mode==="upload")return clean(source&&source.media&&source.media.musicTrack&&source.media.musicTrack.url);
    return clean(source&&source.music&&source.music.audio&&source.music.audio.url);
  }
  function eligible(source,item){
    if(!root()||!source||!source.id||!item||!clean(item.videoUrl))return false;
    if(Number(item.mixVersion||source.generation&&source.generation.mixVersion||0)>=TARGET_MIX_VERSION)return false;
    if(clean(source.generation&&source.generation.status||source.status).toLowerCase()!=="completed")return false;
    var narrationEnabled=source.narration&&source.narration.enabled!==false;
    var audio=source.narration&&source.narration.audio;
    if(narrationEnabled&&(!audio||audio.approved!==true||!clean(audio.url)))return false;
    var mode=source.music&&source.music.mode||"auto";
    if(mode!=="off"&&!musicUrl(source))return false;
    return true;
  }
  function schedule(delay){clearTimeout(timer);timer=setTimeout(run,delay==null?1600:delay)}

  async function run(){
    clearTimeout(timer);
    if(busy||window.AIVOAdFilmSeedanceFinalizing){schedule(1800);return}
    var source=project(),item=outputOf(source);
    if(!eligible(source,item))return;
    var key=[source.id,item.id,item.sourceVideoUrl||item.videoUrl,TARGET_MIX_VERSION].join("|");
    if(attempted.has(key))return;
    attempted.add(key);busy=true;window.AIVOAdFilmSeedanceFinalizing=true;
    try{
      var response=await fetch("/api/ad-film/seedance/finalize",{method:"POST",credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectId:source.id,outputId:item.id||source.generation&&source.generation.outputId||""})});
      var data=await response.json().catch(function(){return{}});
      if(!response.ok||!data.ok||!data.project||!data.video_url)throw new Error(data.message||data.error||"mix_upgrade_failed");
      window.AIVOAdFilmActiveProject=data.project;
      window.AIVOAdFilmGeneratedVideo=data.video_url;
      document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:data.project,projectId:data.project.id||"",media:data.project.media||{}}}));
      if(window.AIVOAdFilmResultControls&&typeof window.AIVOAdFilmResultControls.mount==="function")window.AIVOAdFilmResultControls.mount(data.video_url,"",{projectId:data.projectId,outputId:data.outputId,logoApplied:!!data.logo_applied,play:false});
    }catch(error){
      console.warn("[ADFILM] mix upgrade",error);
    }finally{
      busy=false;window.AIVOAdFilmSeedanceFinalizing=false;
    }
  }

  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")schedule(1700)});
  document.addEventListener("aivo:adfilm-project-sync",function(){schedule(1400)});
  window.addEventListener("pageshow",function(){schedule(1800)});
  window.addEventListener("pagehide",function(){clearTimeout(timer)});
  window.AIVOAdFilmMixUpgrade={run:run};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){schedule(1800)},{once:true});else schedule(1800);
})();
