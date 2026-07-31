/* AIVO AI Reklam Filmi — keep live preview reserved for finalized project outputs */
(function AIVO_AD_FILM_LIVE_PREVIEW_STATE(){
  "use strict";
  if(window.__AIVO_AD_FILM_LIVE_PREVIEW_STATE_V4__)return;
  window.__AIVO_AD_FILM_LIVE_PREVIEW_STATE_V4__=true;

  var stableByProject=Object.create(null);

  function clean(value){return String(value||"").trim()}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function projectId(source){return clean(source&&source.id)}
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
  function productionActive(source){
    source=source||{};
    var generation=source.generation||{};
    var generationStatus=String(generation.status||"").toLowerCase();
    var projectStatus=String(source.status||"").toLowerCase();
    var avatarStatus=String(source.avatar&&source.avatar.pipeline&&source.avatar.pipeline.status||"").toLowerCase();
    return !!(
      window.AIVOAdFilmFinalizationPending||
      window.AIVOAdFilmSeedanceFinalizing||
      source.preparingNewVersion||
      ["queued","processing","completed","finalizing"].indexOf(generationStatus)>=0||
      ["processing","finalizing"].indexOf(projectStatus)>=0||
      ["motion_queued","motion_processing","lipsync_queued","lipsync_processing","matting_queued","matting_processing"].indexOf(avatarStatus)>=0
    );
  }
  function remember(source,outputs){
    var id=projectId(source);if(!id||!outputs.length)return;
    var active=clean(source&&source.activeOutputId);
    if(!outputs.some(function(item){return clean(item.id)===active}))active=clean(outputs[0]&&outputs[0].id);
    stableByProject[id]={outputs:outputs.slice(),activeOutputId:active};
  }
  function stableSnapshot(source){return stableByProject[projectId(source)]||null}
  function sanitize(source){
    if(!source||typeof source!=="object")return source;
    var next=Object.assign({},source);
    var allOutputs=Array.isArray(source.outputs)?source.outputs:[];
    var finalOutputs=allOutputs.filter(function(item){return isFinalOutput(item,source)});
    if(finalOutputs.length)remember(source,finalOutputs);
    else if(productionActive(source)){
      var snapshot=stableSnapshot(source);
      if(snapshot&&snapshot.outputs.length)finalOutputs=snapshot.outputs.slice();
    }
    next.outputs=finalOutputs;

    var generation=Object.assign({},source.generation||{});
    var activeRaw=clean(generation.outputId||generation.requestId);
    var rawStillPending=activeRaw&&Number(generation.mixVersion||0)<4&&!generation.finalizedAt;
    if(rawStillPending){
      generation.videoUrl=null;
      if(!generation.sourceVideoUrl)generation.sourceVideoUrl=clean(source.generation&&source.generation.videoUrl)||null;
    }
    next.generation=generation;

    var selected=clean(source.activeOutputId);
    if(!finalOutputs.some(function(item){return clean(item.id)===selected})){
      var cached=stableSnapshot(source);
      next.activeOutputId=clean(cached&&cached.activeOutputId||finalOutputs[0]&&finalOutputs[0].id)||null;
    }
    return next;
  }
  function activeVideo(source){
    source=sanitize(source||project()||{})||{};
    var list=Array.isArray(source.outputs)?source.outputs.filter(function(item){return item&&clean(item.videoUrl)}):[];
    if(list.length){
      var id=clean(source.activeOutputId);
      var item=list.find(function(output){return clean(output.id)===id})||list[0];
      return clean(item&&item.videoUrl);
    }
    var generation=source.generation||{};
    if(Number(generation.mixVersion||0)>=4||generation.finalizedAt)return clean(generation.videoUrl);
    return "";
  }
  function existingPreview(){
    var controls=window.AIVOAdFilmResultControls;
    var controlled=controls&&typeof controls.videoUrl==="function"?clean(controls.videoUrl()):"";
    if(controlled)return controlled;
    var video=document.querySelector('.rpPanelWrap[data-panel-key="adfilm"] video[data-adfilm-result-video]');
    return clean(video&&(video.currentSrc||video.src));
  }
  function sync(source){
    source=sanitize(source||project());
    if(source)window.AIVOAdFilmActiveProject=source;
    var wrap=document.querySelector('.rpPanelWrap[data-panel-key="adfilm"]');if(!wrap)return;
    var finalUrl=activeVideo(source);
    var keepExisting=!finalUrl&&productionActive(source)&&!!existingPreview();
    var hasVideo=!!finalUrl||keepExisting;
    var play=wrap.querySelector('.adfilm-live-card .adfilm-preview-play');
    if(play){
      play.hidden=!hasVideo;
      play.style.display=hasVideo?"":"none";
      play.setAttribute("aria-hidden",hasVideo?"false":"true");
    }
    var frame=wrap.querySelector('.adfilm-live-card [data-panel-frame]');
    if(frame)frame.classList.toggle("is-empty-live-preview",!hasVideo);
    if(!hasVideo&&!productionActive(source)&&window.AIVOAdFilmResultControls&&typeof window.AIVOAdFilmResultControls.clear==="function"){
      window.AIVOAdFilmResultControls.clear(false);
    }
  }

  document.addEventListener("aivo:adfilm-project-sync",function(event){
    var next=sanitize(event&&event.detail&&event.detail.project||project());
    if(event&&event.detail&&next)event.detail.project=next;
    if(next)window.AIVOAdFilmActiveProject=next;
  },true);
  document.addEventListener("click",function(event){
    var play=event.target&&event.target.closest&&event.target.closest('.rpPanelWrap[data-panel-key="adfilm"] .adfilm-live-card .adfilm-preview-play');
    if(!play||activeVideo(project())||existingPreview())return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  },true);
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")setTimeout(function(){sync(project())},360)});
  document.addEventListener("aivo:adfilm-project-sync",function(event){setTimeout(function(){sync(event&&event.detail&&event.detail.project||project())},40)});
  window.addEventListener("pageshow",function(){setTimeout(function(){sync(project())},160)});

  window.AIVOAdFilmLivePreviewState={sync:sync,sanitize:sanitize,isFinalOutput:isFinalOutput,productionActive:productionActive};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(function(){sync(project())},240)},{once:true});else setTimeout(function(){sync(project())},240);
})();
