/* AIVO AI Reklam Filmi — only finalized outputs may enter ready-video UI */
(function AIVO_AD_FILM_FINAL_OUTPUT_UI_GUARD(){
  "use strict";
  if(window.__AIVO_AD_FILM_FINAL_OUTPUT_UI_GUARD_V1__)return;
  window.__AIVO_AD_FILM_FINAL_OUTPUT_UI_GUARD_V1__=true;

  var timer=null;
  var wrappedGallery=false;

  function clean(value){return String(value==null?"":value).trim()}
  function lower(value){return clean(value).toLowerCase()}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function generation(source){return source&&source.generation||{}}
  function pipeline(source){return source&&source.avatar&&source.avatar.pipeline||{}}
  function finalization(source){var gen=generation(source);return source&&source.finalization||gen.finalization||{}}
  function stableUrl(value){try{var parsed=new URL(clean(value),location.href);return parsed.origin+parsed.pathname}catch(_){return clean(value).split("?")[0].split("#")[0]}}
  function isFinal(item){
    return Boolean(item&&clean(item.videoUrl)&&(
      Number(item.mixVersion||0)>=4||
      item.finalizedAt||
      item.logoApplied===true||
      item.narrationApplied===true||
      item.musicApplied===true||
      item.avatarApplied===true||
      item.avatarIntegrated===true||
      item.hybridTimeline===true||
      clean(item.avatarCompositeMode)
    ));
  }
  function finalOutputs(source){return (Array.isArray(source&&source.outputs)?source.outputs:[]).filter(isFinal)}
  function terminal(source){
    return [source&&source.status,generation(source).status,pipeline(source).status,finalization(source).status]
      .map(lower)
      .some(function(value){return ["failed","error","cancelled","canceled"].indexOf(value)>=0});
  }
  function productionActive(source){
    var gen=generation(source),pipe=pipeline(source),finish=finalization(source);
    return !terminal(source)&&(
      ["queued","processing","running","in_queue"].indexOf(lower(source&&source.status))>=0||
      ["queued","processing","running","in_queue"].indexOf(lower(gen.status))>=0||
      ["waiting_for_seedance","motion_queued","motion_processing","lipsync_queued","lipsync_processing","rendering"].indexOf(lower(pipe.status))>=0||
      ["queued","processing","running","rendering"].indexOf(lower(finish.status))>=0||
      gen.avatarWaiting===true||gen.awaitingFinalComposite===true||gen.finalizing===true||gen.sourceOnly===true||
      source&&source.preparingNewVersion===true
    );
  }
  function safeProject(source){return Object.assign({},source||{}, {outputs:finalOutputs(source)})}
  function preferredFinal(source){
    var outputs=finalOutputs(source),active=clean(source&&source.activeOutputId);
    return outputs.find(function(item){return clean(item.id)===active})||outputs[0]||null;
  }
  function currentPreviewUrl(){return window.AIVOAdFilmResultControls&&typeof window.AIVOAdFilmResultControls.videoUrl==="function"?clean(window.AIVOAdFilmResultControls.videoUrl()):clean(window.AIVOAdFilmGeneratedVideo)}
  function sourceVideo(source){var gen=generation(source);return clean(gen.sourceVideoUrl||gen.videoUrl)}
  function restoreFinalPreview(source){
    if(!window.AIVOAdFilmResultControls)return;
    var current=currentPreviewUrl(),raw=sourceVideo(source),item=preferredFinal(source);
    var showingRaw=raw&&stableUrl(current)===stableUrl(raw)&&(!item||stableUrl(item.videoUrl)!==stableUrl(raw));
    if(!showingRaw&&!productionActive(source)&&!terminal(source))return;
    if(item&&typeof window.AIVOAdFilmResultControls.mount==="function"){
      window.AIVOAdFilmResultControls.mount(item.videoUrl,item.logoUrl||"",{
        projectId:clean(source.id),outputId:clean(item.id),version:Number(item.version)||1,
        logoApplied:item.logoApplied===true,play:false,force:true,source:"final-output-guard"
      });
      window.AIVOAdFilmGeneratedVideo=item.videoUrl;
      window.AIVOAdFilmActiveOutputId=item.id;
    }else if(typeof window.AIVOAdFilmResultControls.clear==="function"){
      window.AIVOAdFilmResultControls.clear();
    }
  }
  function wrapGallery(){
    var gallery=window.AIVOAdFilmOutputGallery;
    if(!gallery||wrappedGallery||typeof gallery.render!=="function")return;
    var original=gallery.render.bind(gallery);
    gallery.render=function(source){return original(safeProject(source||project()))};
    gallery.outputs=function(source){return finalOutputs(source||project())};
    wrappedGallery=true;
  }
  function pruneGallery(source){
    var allowed=new Set(finalOutputs(source).map(function(item){return clean(item.id)}));
    document.querySelectorAll('[data-adfilm-output-gallery] [data-output-id]').forEach(function(card){
      if(!allowed.has(clean(card.getAttribute("data-output-id"))))card.remove();
    });
    var host=document.querySelector('[data-adfilm-output-gallery]');
    if(host){
      var cards=host.querySelectorAll('[data-output-id]');
      var count=host.querySelector('.adfilm-output-gallery__head span');
      if(count)count.textContent=String(cards.length)+(document.documentElement.lang.toLowerCase().indexOf("en")===0?" videos":" video");
      if(!cards.length){host.hidden=true;host.innerHTML="";host.dataset.gallerySignature=""}
    }
  }
  function enforce(source){
    source=source||project();if(!source)return;
    wrapGallery();
    if(window.AIVOAdFilmOutputGallery&&typeof window.AIVOAdFilmOutputGallery.render==="function")window.AIVOAdFilmOutputGallery.render(safeProject(source));
    pruneGallery(source);
    restoreFinalPreview(source);
  }
  function schedule(source,delay){clearTimeout(timer);timer=setTimeout(function(){enforce(source||project())},delay==null?30:delay)}

  document.addEventListener("aivo:adfilm-project-sync",function(event){schedule(event&&event.detail&&event.detail.project,20)});
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")schedule(project(),260)});
  document.addEventListener("aivo:adfilm-assets-ready",function(){schedule(project(),80)});
  window.addEventListener("pageshow",function(){schedule(project(),120)});
  setInterval(function(){var source=project();if(source&&(productionActive(source)||terminal(source)))enforce(source)},700);
  window.AIVOAdFilmFinalOutputUIGuard={enforce:enforce,finalOutputs:finalOutputs,isFinal:isFinal};
})();
