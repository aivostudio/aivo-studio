/* AIVO AI Ad Film — prevent the legacy Seedance resume listener from
   replacing/restarting the mounted live preview on ordinary project saves. */
(function AIVO_AD_FILM_SEEDANCE_RESUME_GUARD(){
  "use strict";
  if(window.__AIVO_AD_FILM_SEEDANCE_RESUME_GUARD_V1__)return;
  window.__AIVO_AD_FILM_SEEDANCE_RESUME_GUARD_V1__=true;

  function clean(value){return String(value||"").trim()}
  function stableUrl(value){
    value=clean(value);if(!value)return"";
    try{var parsed=new URL(value,location.href);return parsed.origin+parsed.pathname}
    catch(_){return value.split("?")[0].split("#")[0]}
  }
  function outputOf(source){
    source=source||{};
    var outputs=Array.isArray(source.outputs)?source.outputs.filter(function(item){return item&&clean(item.videoUrl)}):[];
    var id=clean(source.activeOutputId||source.generation&&source.generation.outputId||window.AIVOAdFilmActiveOutputId);
    return outputs.find(function(item){return clean(item.id)===id})||outputs[0]||null;
  }
  function projectVideo(source){
    var item=outputOf(source);
    return clean(item&&item.videoUrl||source&&source.generation&&source.generation.videoUrl);
  }
  function currentVideo(){
    return document.querySelector('.rpPanelWrap[data-panel-key="adfilm"] [data-panel-frame] video[data-adfilm-result-video]');
  }
  function sameMountedVideo(source){
    var video=currentVideo(),next=projectVideo(source);
    if(!video||!next)return false;
    return stableUrl(video.currentSrc||video.src)===stableUrl(next);
  }
  function finalized(source){
    var item=outputOf(source),generation=source&&source.generation||{};
    return Number(item&&item.mixVersion||generation.mixVersion||0)>=4&&!!projectVideo(source);
  }
  function normalizeVideo(video){
    if(!video||!video.matches||!video.matches('video[data-adfilm-result-video]'))return;
    video.autoplay=false;
    video.removeAttribute("autoplay");
    video.controls=false;
    video.removeAttribute("controls");
    if(!video.dataset.aivoSeedanceGuardReady){
      video.dataset.aivoSeedanceGuardReady="1";
      try{video.pause()}catch(_){}
      requestAnimationFrame(function(){
        var source=window.AIVOAdFilmActiveProject||{};
        var item=outputOf(source);
        if(window.AIVOAdFilmResultControls&&typeof window.AIVOAdFilmResultControls.mount==="function"&&item&&clean(item.videoUrl)){
          window.AIVOAdFilmResultControls.mount(item.videoUrl,item.logoUrl||"",{
            projectId:source.id||"",
            outputId:item.id||"",
            version:item.version||1,
            logoApplied:item.logoApplied===true,
            play:false
          });
        }
      });
    }
  }

  var nativeAdd=document.addEventListener.bind(document);
  document.addEventListener=function(type,listener,options){
    if(type==="aivo:adfilm-project-sync"&&typeof listener==="function"){
      var source="";
      try{source=Function.prototype.toString.call(listener)}catch(_){}
      if(source.indexOf("resume(scope")>=0&&source.indexOf("bind(scope)")>=0){
        var original=listener;
        listener=function(event){
          var next=event&&event.detail&&event.detail.project||window.AIVOAdFilmActiveProject;
          if(finalized(next)&&sameMountedVideo(next))return;
          return original.apply(this,arguments);
        };
      }
    }
    return nativeAdd(type,listener,options);
  };

  var observer=new MutationObserver(function(mutations){
    mutations.forEach(function(mutation){
      Array.from(mutation.addedNodes||[]).forEach(function(node){
        if(!node||node.nodeType!==1)return;
        if(node.matches&&node.matches('video[data-adfilm-result-video]'))normalizeVideo(node);
        if(node.querySelectorAll)node.querySelectorAll('video[data-adfilm-result-video]').forEach(normalizeVideo);
      });
    });
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});

  var existing=currentVideo();if(existing)normalizeVideo(existing);
})();
