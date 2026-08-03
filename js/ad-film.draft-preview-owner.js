/* AIVO AI Reklam Filmi — current draft owns the live preview until user selects a saved version */
(function AIVO_AD_FILM_DRAFT_PREVIEW_OWNER(){
  "use strict";
  if(window.__AIVO_AD_FILM_DRAFT_PREVIEW_OWNER_V1__)return;
  window.__AIVO_AD_FILM_DRAFT_PREVIEW_OWNER_V1__=true;

  var manualOutputSelected=false;
  var runStartedAt=0;
  var observer=null;
  var wrapTimer=null;

  function clean(value){return String(value==null?"":value).trim()}
  function lower(value){return clean(value).toLowerCase()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function panel(){return document.querySelector('.rpPanelWrap[data-panel-key="adfilm"]')}
  function media(){var scope=panel();return scope&&scope.querySelector('[data-panel-media]')}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function generation(source){return source&&source.generation||{}}
  function validUrl(value){return /^https:\/\//i.test(clean(value))}

  function draftActive(){
    var preview=window.AIVOAdFilmPreviewState;
    if(preview&&Number(preview.mediaCount||0)>0)return true;
    var target=media();
    if(!target)return false;
    var background=clean(target.style&&target.style.backgroundImage);
    return Boolean(background&&background!=="none");
  }

  function generationIsFreshCompletion(source){
    if(!runStartedAt||!source)return false;
    var gen=generation(source);
    var status=lower(gen.status||source.status);
    var started=Date.parse(gen.startedAt||gen.createdAt||"")||0;
    var url=clean(gen.videoUrl);
    if(!url){
      var outputs=Array.isArray(source.outputs)?source.outputs:[];
      var active=clean(source.activeOutputId||gen.outputId||gen.requestId);
      var item=outputs.find(function(output){return clean(output&&output.id)===active})||outputs[0];
      url=clean(item&&item.videoUrl);
    }
    return status==="completed"&&validUrl(url)&&started>=runStartedAt-3000;
  }

  function busy(){
    var scope=root();if(!scope)return false;
    var button=scope.querySelector('[data-adfilm-build]'),action=scope.querySelector('.adfilm-actionbar');
    return Boolean(button&&(
      button.classList.contains('is-generating')||
      button.classList.contains('is-loading')||
      button.classList.contains('is-music-preparing')||
      button.getAttribute('aria-busy')==='true'||
      button.hasAttribute('data-adfilm-loader-pending')
    )||action&&action.classList.contains('is-engine-active'));
  }

  function markDraftMode(source){
    source=source||project();
    if(!source||manualOutputSelected||!draftActive())return source;
    if(source.preparingNewVersion===true)return source;
    try{source.preparingNewVersion=true}catch(_){}
    return source;
  }

  function clearSavedVideo(){
    if(manualOutputSelected||!draftActive())return;
    var scope=panel();if(!scope)return;
    scope.querySelectorAll('video[data-adfilm-result-video]').forEach(function(video){try{video.pause()}catch(_){}video.remove()});
    scope.querySelectorAll('[data-adfilm-result-toolbar],.adfilm-result-toolbar,[data-adfilm-result-actions-row],[data-adfilm-result-logo]').forEach(function(node){node.remove()});
    var target=scope.querySelector('[data-panel-frame]');if(target)target.classList.remove('has-result-video');
    var targetMedia=scope.querySelector('[data-panel-media]');if(targetMedia)targetMedia.classList.remove('has-result-video');
    window.AIVOAdFilmGeneratedVideo="";
    window.AIVOAdFilmGeneratedLogo="";
    window.AIVOAdFilmActiveOutputProjectId="";
    window.AIVOAdFilmActiveOutputId="";
  }

  function allowedMount(options){
    options=options||{};
    var source=lower(options.source);
    return manualOutputSelected||
      source==="completed-production"||
      source==="final-output"||
      source==="fresh-completion"||
      generationIsFreshCompletion(project());
  }

  function wrapControls(){
    var controls=window.AIVOAdFilmResultControls;
    if(!controls||typeof controls.mount!=="function")return false;
    if(controls.mount.__aivoDraftPreviewWrapped)return true;
    var original=controls.mount.bind(controls);
    function guardedMount(url,logo,options){
      if(draftActive()&&!allowedMount(options)){
        markDraftMode(project());
        clearSavedVideo();
        return null;
      }
      return original(url,logo,options);
    }
    guardedMount.__aivoDraftPreviewWrapped=true;
    guardedMount.__aivoOriginal=original;
    controls.mount=guardedMount;
    return true;
  }

  function schedule(){
    [0,40,120,260,520,900,1500,2400].forEach(function(delay){
      setTimeout(function(){
        if(generationIsFreshCompletion(project())){
          manualOutputSelected=true;
          runStartedAt=0;
          return;
        }
        markDraftMode(project());
        wrapControls();
        if(!manualOutputSelected)clearSavedVideo();
      },delay);
    });
  }

  function observe(){
    if(observer)observer.disconnect();
    var scope=panel();if(!scope)return;
    observer=new MutationObserver(function(){
      if(manualOutputSelected||!draftActive())return;
      if(scope.querySelector('video[data-adfilm-result-video]'))clearSavedVideo();
    });
    observer.observe(scope,{subtree:true,childList:true});
  }

  document.addEventListener('click',function(event){
    var output=event.target&&event.target.closest&&event.target.closest('[data-adfilm-output-gallery] [data-output-id]');
    if(output){manualOutputSelected=true;return}
    var build=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-adfilm-build]');
    if(build){
      manualOutputSelected=false;
      runStartedAt=Date.now();
      markDraftMode(project());
      clearSavedVideo();
    }
  },true);

  document.addEventListener('input',function(event){
    if(!event.target||!event.target.closest||!event.target.closest('[data-module-root][data-module="adfilm"]'))return;
    manualOutputSelected=false;
    markDraftMode(project());
    schedule();
  },true);
  document.addEventListener('change',function(event){
    if(!event.target||!event.target.closest||!event.target.closest('[data-module-root][data-module="adfilm"]'))return;
    manualOutputSelected=false;
    markDraftMode(project());
    schedule();
  },true);

  document.addEventListener('aivo:adfilm-project-sync',function(event){
    var source=event&&event.detail&&event.detail.project||project();
    if(generationIsFreshCompletion(source)){
      manualOutputSelected=true;
      runStartedAt=0;
      return;
    }
    if(draftActive()&&!manualOutputSelected){
      markDraftMode(source);
      if(event&&event.detail&&source)event.detail.project=source;
      if(source)window.AIVOAdFilmActiveProject=source;
    }
  },true);
  document.addEventListener('aivo:adfilm-project-sync',schedule,false);
  document.addEventListener('aivo:adfilm-assets-ready',schedule,false);
  document.addEventListener('aivo:module-mounted',function(event){
    if(event&&event.detail&&event.detail.key==='adfilm'){
      manualOutputSelected=false;
      setTimeout(observe,30);
      schedule();
    }
  },true);

  window.addEventListener('pageshow',function(){manualOutputSelected=false;runStartedAt=0;setTimeout(observe,30);schedule()});
  window.addEventListener('pagehide',function(){if(observer)observer.disconnect();clearTimeout(wrapTimer)});

  wrapTimer=setInterval(function(){if(wrapControls())clearInterval(wrapTimer)},50);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(observe,30);schedule()},{once:true});
  else{setTimeout(observe,30);schedule()}
})();
