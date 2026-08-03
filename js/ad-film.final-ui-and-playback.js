/* AIVO AI Reklam Filmi — final UI and one-shot playback */
(function(){
  "use strict";
  if(window.__AIVO_AD_FILM_FINAL_UI_PLAYBACK_V2__)return;
  window.__AIVO_AD_FILM_FINAL_UI_PLAYBACK_V2__=true;

  var playedKeys=new Set();

  function clean(value){return String(value==null?"":value).trim()}
  function lower(value){return clean(value).toLowerCase()}
  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function text(tr,en){return english()?en:tr}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function statusNode(){var scope=root();return scope&&scope.querySelector('[data-adfilm-engine-status]')}
  function generationActive(){
    var scope=root();if(!scope)return false;
    var button=scope.querySelector('[data-adfilm-build]'),action=scope.querySelector('.adfilm-actionbar');
    return !!(button&&(button.classList.contains('is-generating')||button.getAttribute('aria-busy')==='true')||action&&action.classList.contains('is-engine-active'));
  }
  function activeOutput(project){
    project=project||{};
    var gen=project.generation||{},outputs=Array.isArray(project.outputs)?project.outputs:[];
    var id=clean(project.activeOutputId||gen.outputId||gen.requestId);
    return outputs.find(function(item){return clean(item&&item.id)===id&&clean(item&&item.videoUrl)})||outputs.find(function(item){return clean(item&&item.videoUrl)})||null;
  }
  function finalContext(project){
    project=project||{};
    var gen=project.generation||{},item=activeOutput(project);
    var url=clean(item&&item.videoUrl||gen.videoUrl);
    if(!url)return null;
    var state=lower(project.status||gen.status);
    if(state!=="completed"&&Number(item&&item.mixVersion||gen.mixVersion||0)<4)return null;
    return{
      key:[clean(project.id),clean(item&&item.id||project.activeOutputId||gen.outputId||gen.requestId),url.split("?")[0]].join("|"),
      url:url,
      logo:clean(item&&item.logoUrl||gen.logoUrl||project.media&&project.media.logo&&project.media.logo.url),
      logoApplied:!!(item&&item.logoApplied||gen.logoApplied),
      projectId:clean(project.id),
      outputId:clean(item&&item.id||project.activeOutputId||gen.outputId||gen.requestId)
    };
  }
  function renderReady(){
    if(generationActive())return false;
    var scope=root(),node=statusNode();if(!scope||!node)return false;
    node.className="adfilm-engine-status is-visible is-success";
    node.removeAttribute("data-stage");
    node.removeAttribute("data-adfilm-idle-hidden");
    node.style.removeProperty("display");node.style.removeProperty("visibility");node.style.removeProperty("opacity");
    var b=node.querySelector("b"),small=node.querySelector("small");
    if(b)b.textContent=text("Reklam filmi hazır","Advertising film ready");
    if(small)small.textContent=text("Üretim ve final işlemleri tamamlandı.","Production and final processing are complete.");
    var action=scope.querySelector('.adfilm-actionbar');if(action)action.classList.remove('is-engine-active');
    var button=scope.querySelector('[data-adfilm-build]');
    if(button){button.classList.remove('is-generating','is-loading','is-music-preparing');button.disabled=false;button.removeAttribute('aria-busy');var label=button.querySelector('[data-adfilm-i18n="createButton"]');if(label)label.textContent=text("Reklam Filmini Oluştur","Create Advertising Film")}
    return true;
  }
  function stopLoop(video){
    if(!video)return;
    video.loop=false;video.removeAttribute('loop');video.autoplay=false;video.removeAttribute('autoplay');
    if(video.dataset.aivoOneShotReady!=="1"){
      video.dataset.aivoOneShotReady="1";
      video.addEventListener('ended',function(){video.pause();try{video.currentTime=0}catch(_){}},{passive:true});
    }
  }
  function playOnce(project){
    if(generationActive())return;
    var context=finalContext(project);if(!context)return;
    if(!renderReady())return;
    if(playedKeys.has(context.key))return;
    playedKeys.add(context.key);
    setTimeout(function(){
      if(generationActive())return;
      if(window.AIVOAdFilmResultControls&&typeof window.AIVOAdFilmResultControls.mount==="function"){
        var video=window.AIVOAdFilmResultControls.mount(context.url,context.logo,{projectId:context.projectId,outputId:context.outputId,logoApplied:context.logoApplied,play:true,force:false});
        stopLoop(video);
      }else{
        var video=document.querySelector('.rpPanelWrap[data-panel-key="adfilm"] video[data-adfilm-result-video]');
        stopLoop(video);if(video)video.play().catch(function(){});
      }
    },120);
  }
  function normalizeExistingVideos(){document.querySelectorAll('.rpPanelWrap[data-panel-key="adfilm"] video[data-adfilm-result-video]').forEach(stopLoop)}

  document.addEventListener('aivo:adfilm-project-sync',function(event){if(!generationActive())playOnce(event&&event.detail&&event.detail.project||window.AIVOAdFilmActiveProject)},false);
  document.addEventListener('aivo:module-mounted',function(event){if(event&&event.detail&&event.detail.key==='adfilm'){normalizeExistingVideos();setTimeout(function(){if(!generationActive())playOnce(window.AIVOAdFilmActiveProject)},300)}});
  var observer=new MutationObserver(normalizeExistingVideos);
  observer.observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('pagehide',function(){observer.disconnect()});
})();
