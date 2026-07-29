/* AIVO AI Reklam Filmi — keep live preview reserved for the active project */
(function AIVO_AD_FILM_LIVE_PREVIEW_STATE(){
  "use strict";
  if(window.__AIVO_AD_FILM_LIVE_PREVIEW_STATE__)return;
  window.__AIVO_AD_FILM_LIVE_PREVIEW_STATE__=true;

  function clean(value){return String(value||"").trim()}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function activeVideo(source){
    source=source||project()||{};
    var list=Array.isArray(source.outputs)?source.outputs.filter(function(item){return item&&clean(item.videoUrl)}):[];
    if(source.preparingNewVersion)return"";
    if(list.length){
      var id=clean(source.activeOutputId||source.generation&&source.generation.outputId);
      var item=list.find(function(output){return clean(output.id)===id})||list[0];
      return clean(item&&item.videoUrl);
    }
    return clean(source.generation&&source.generation.videoUrl);
  }
  function sync(source){
    var wrap=document.querySelector('.rpPanelWrap[data-panel-key="adfilm"]');if(!wrap)return;
    var play=wrap.querySelector('.adfilm-live-card .adfilm-preview-play');
    var hasVideo=!!activeVideo(source||project());
    if(play){
      play.hidden=!hasVideo;
      play.style.display=hasVideo?"":"none";
      play.setAttribute("aria-hidden",hasVideo?"false":"true");
    }
    var frame=wrap.querySelector('.adfilm-live-card [data-panel-frame]');
    if(frame)frame.classList.toggle("is-empty-live-preview",!hasVideo);
  }

  document.addEventListener("click",function(event){
    var play=event.target&&event.target.closest&&event.target.closest('.rpPanelWrap[data-panel-key="adfilm"] .adfilm-live-card .adfilm-preview-play');
    if(!play||activeVideo(project()))return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  },true);
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(function(){sync(project())},360)});
  document.addEventListener("aivo:adfilm-project-sync",function(event){setTimeout(function(){sync(event&&event.detail&&event.detail.project||project())},40)});
  window.addEventListener("pageshow",function(){setTimeout(function(){sync(project())},160)});

  window.AIVOAdFilmLivePreviewState={sync:sync};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(function(){sync(project())},240)},{once:true});else setTimeout(function(){sync(project())},240);
})();
