/* AIVO AI Reklam Filmi — final output narration/music/logo post-production */
(function AIVO_AD_FILM_FINALIZE_OUTPUT(){
  "use strict";
  if(window.__AIVO_AD_FILM_FINALIZE_OUTPUT_V4__)return;
  window.__AIVO_AD_FILM_FINALIZE_OUTPUT_V4__=true;

  var REQUIRED_MIX_VERSION=4;
  var busy=false,timer=null,attempted=new Set(),failed=new Set();
  function clean(value){return String(value||"").trim()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function toast(message,type){try{var fn=window.toast&&window.toast[type||"info"];if(typeof fn==="function")return fn({message:message,duration:3600});if(typeof window.showToast==="function")return window.showToast(message,type||"info")}catch(_){} }
  function outputOf(source){source=source||{};var list=Array.isArray(source.outputs)?source.outputs.filter(function(item){return item&&clean(item.videoUrl)}):[];var id=clean(source.activeOutputId||source.generation&&source.generation.outputId);return list.find(function(item){return clean(item.id)===id})||list[0]||null}
  function musicUrl(source){var mode=source&&source.music&&source.music.mode||"auto";if(mode==="off")return"";if(mode==="upload")return clean(source&&source.media&&source.media.musicTrack&&source.media.musicTrack.url);return clean(source&&source.music&&source.music.audio&&source.music.audio.url)}
  function ready(source,item){
    if(!source||!source.id||!item)return false;
    var generation=source.generation||{},status=clean(generation.status||source.status).toLowerCase();if(status!=="completed")return false;
    var narrationEnabled=source.narration&&source.narration.enabled!==false,audio=source.narration&&source.narration.audio;if(narrationEnabled&&(!audio||audio.approved!==true||!clean(audio.url)))return false;
    var logo=clean(source.media&&source.media.logo&&source.media.logo.url||item.logoUrl||generation.logoUrl),musicMode=source.music&&source.music.mode||"auto",music=musicUrl(source);if(musicMode!=="off"&&!music)return false;
    var logoDone=!logo||item.logoApplied===true,narrationDone=!narrationEnabled||item.narrationApplied===true,musicDone=musicMode==="off"||item.musicApplied===true,mixDone=Number(item.mixVersion||0)>=REQUIRED_MIX_VERSION;
    return !(logoDone&&narrationDone&&musicDone&&mixDone);
  }
  function keyOf(source,item){return[source&&source.id,item&&item.id,item&&item.videoUrl,source&&source.narration&&source.narration.audio&&source.narration.audio.url,musicUrl(source),REQUIRED_MIX_VERSION].join("|")}
  function schedule(delay){clearTimeout(timer);timer=setTimeout(check,delay==null?900:delay)}
  async function finalize(source,item){
    if(busy)return;
    var key=keyOf(source,item);
    if(attempted.has(key)||failed.has(key))return;
    busy=true;attempted.add(key);
    var handle=toast(text("Ses ve reklam müziği profesyonel olarak dengeleniyor...","Balancing narration and advertising music..."),"info");
    try{
      var response=await fetch("/api/ad-film/seedance/finalize",{method:"POST",credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectId:source.id,outputId:item.id||source.generation&&source.generation.outputId||""})});
      var data=await response.json().catch(function(){return{}});
      if(!response.ok||!data.ok||!data.project){var error=new Error(data.message||data.error||"finalize_failed");error.data=data;throw error}
      if(handle&&typeof handle.dismiss==="function")handle.dismiss();
      failed.delete(key);window.AIVOAdFilmActiveProject=data.project;
      document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync",{detail:{project:data.project,projectId:data.project.id||"",media:data.project.media||{}}}));
      if(window.AIVOAdFilmResultControls&&typeof window.AIVOAdFilmResultControls.mount==="function")window.AIVOAdFilmResultControls.mount(data.video_url,data.logo_applied?"":data.logo_url||"",{projectId:data.projectId,outputId:data.outputId,logoApplied:!!data.logo_applied,play:false});
      toast(text("Müzik girişi ve konuşma dengesi videoya uygulandı.","The music intro and narration balance were applied."),"success");
    }catch(error){
      if(handle&&typeof handle.dismiss==="function")handle.dismiss();
      failed.add(key);
      console.warn("[ADFILM] final output",error,error&&error.data||"");
      toast(text("Yeni ses dengesi uygulanamadı. Sayfayı yenilediğinde tekrar denenecek.","The new audio balance could not be applied. It will retry after a refresh."),"warning");
    }finally{busy=false}
  }
  async function check(){clearTimeout(timer);var source=project(),item=outputOf(source);if(!ready(source,item))return;finalize(source,item)}
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")schedule(1200)});
  document.addEventListener("aivo:adfilm-project-sync",function(){if(!busy)schedule(800)});
  window.addEventListener("pageshow",function(){schedule(1200)});window.addEventListener("pagehide",function(){clearTimeout(timer)});
  window.AIVOAdFilmFinalizeOutput={run:function(){var source=project(),item=outputOf(source);if(!source||!item)return;var key=keyOf(source,item);failed.delete(key);attempted.delete(key);finalize(source,item)}};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){if(root())schedule(1200)},{once:true});else if(root())schedule(1200);
})();
