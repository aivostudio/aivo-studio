/* AIVO AI Reklam Filmi — keep live preview reserved for finalized project outputs */
(function AIVO_AD_FILM_LIVE_PREVIEW_STATE(){
  "use strict";
  if(window.__AIVO_AD_FILM_LIVE_PREVIEW_STATE_V2__)return;
  window.__AIVO_AD_FILM_LIVE_PREVIEW_STATE_V2__=true;

  function clean(value){return String(value||"").trim()}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function currentOutputId(source){return clean(source&&source.generation&&(source.generation.outputId||source.generation.requestId))}
  function isFinalOutput(item,source){
    if(!item||!clean(item.videoUrl))return false;
    if(Number(item.mixVersion||0)>=4||item.finalizedAt)return true;
    if(item.logoApplied===true||item.narrationApplied===true||item.musicApplied===true||item.avatarApplied===true)return true;
    var generation=source&&source.generation||{};
    if(clean(item.id)!==currentOutputId(source))return true;
    if(Number(generation.mixVersion||0)>=4||generation.finalizedAt)return true;
    if(generation.logoApplied===true||generation.narrationApplied===true||generation.musicApplied===true||generation.avatarApplied===true)return true;
    return false;
  }
  function sanitize(source){
    if(!source||typeof source!=="object")return source;
    var avatarEnabled=source.avatar&&source.avatar.enabled===true;
    var finalizing=String(source.generation&&source.generation.status||source.status||"").toLowerCase()==="finalizing";
    var pending=!!window.AIVOAdFilmFinalizationPending;
    if(!avatarEnabled&&!finalizing&&!pending)return source;
    var next=Object.assign({},source);
    var outputs=Array.isArray(source.outputs)?source.outputs:[];
    next.outputs=outputs.filter(function(item){return isFinalOutput(item,source)});
    var generation=Object.assign({},source.generation||{});
    var activeRaw=clean(generation.outputId||generation.requestId);
    var rawStillPending=activeRaw&&Number(generation.mixVersion||0)<4&&!generation.finalizedAt;
    if(rawStillPending){
      generation.videoUrl=null;
      if(!generation.sourceVideoUrl)generation.sourceVideoUrl=clean(source.generation&&source.generation.videoUrl)||null;
      next.activeOutputId=next.outputs[0]&&next.outputs[0].id||null;
    }
    next.generation=generation;
    return next;
  }
  function activeVideo(source){
    source=sanitize(source||project()||{})||{};
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
    source=sanitize(source||project());
    if(source)window.AIVOAdFilmActiveProject=source;
    var wrap=document.querySelector('.rpPanelWrap[data-panel-key="adfilm"]');if(!wrap)return;
    var play=wrap.querySelector('.adfilm-live-card .adfilm-preview-play');
    var hasVideo=!!activeVideo(source);
    if(play){
      play.hidden=!hasVideo;
      play.style.display=hasVideo?"":"none";
      play.setAttribute("aria-hidden",hasVideo?"false":"true");
    }
    var frame=wrap.querySelector('.adfilm-live-card [data-panel-frame]');
    if(frame)frame.classList.toggle("is-empty-live-preview",!hasVideo);
    if(!hasVideo&&window.AIVOAdFilmResultControls&&typeof window.AIVOAdFilmResultControls.clear==="function")window.AIVOAdFilmResultControls.clear(false);
  }

  document.addEventListener("aivo:adfilm-project-sync",function(event){
    var next=sanitize(event&&event.detail&&event.detail.project||project());
    if(event&&event.detail&&next)event.detail.project=next;
    if(next)window.AIVOAdFilmActiveProject=next;
  },true);
  document.addEventListener("click",function(event){
    var play=event.target&&event.target.closest&&event.target.closest('.rpPanelWrap[data-panel-key="adfilm"] .adfilm-live-card .adfilm-preview-play');
    if(!play||activeVideo(project()))return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  },true);
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(function(){sync(project())},360)});
  document.addEventListener("aivo:adfilm-project-sync",function(event){setTimeout(function(){sync(event&&event.detail&&event.detail.project||project())},40)});
  window.addEventListener("pageshow",function(){setTimeout(function(){sync(project())},160)});

  window.AIVOAdFilmLivePreviewState={sync:sync,sanitize:sanitize,isFinalOutput:isFinalOutput};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(function(){sync(project())},240)},{once:true});else setTimeout(function(){sync(project())},240);
})();
