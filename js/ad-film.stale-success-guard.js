/* AIVO AI Reklam Filmi — keep previous completed outputs out of the center progress panel */
(function AIVO_AD_FILM_STALE_SUCCESS_GUARD(){
  "use strict";
  if(window.__AIVO_AD_FILM_STALE_SUCCESS_GUARD_V1__)return;
  window.__AIVO_AD_FILM_STALE_SUCCESS_GUARD_V1__=true;

  var run=null;
  var sessionCompletion=null;

  function clean(value){return String(value==null?"":value).trim()}
  function lower(value){return clean(value).toLowerCase()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function projectId(source){var scope=root();return clean(source&&source.id||scope&&scope.dataset.adfilmProjectId)}
  function generation(source){return source&&source.generation||{}}
  function requestId(source){var gen=generation(source);return clean(gen.requestId||gen.outputId)}
  function generationStarted(source){return Date.parse(generation(source).startedAt||generation(source).createdAt||"")||0}
  function outputId(source){var gen=generation(source);return clean(source&&source.activeOutputId||gen.outputId||gen.requestId)}
  function busy(){
    var scope=root();if(!scope)return false;
    var button=scope.querySelector('[data-adfilm-build]'),action=scope.querySelector('.adfilm-actionbar');
    return !!(button&&(
      button.classList.contains('is-generating')||
      button.classList.contains('is-loading')||
      button.classList.contains('is-music-preparing')||
      button.getAttribute('aria-busy')==='true'||
      button.hasAttribute('data-adfilm-loader-pending')
    )||action&&action.classList.contains('is-engine-active'));
  }
  function completed(source){
    var gen=generation(source),state=lower(gen.status||source&&source.status);
    return state==="completed"&&!!clean(gen.videoUrl||source&&source.videoUrl);
  }
  function belongsToNewRun(source){
    if(!run||projectId(source)!==run.projectId||!completed(source))return false;
    var nextRequest=requestId(source),nextStarted=generationStarted(source);
    if(nextRequest&&run.previousRequestId&&nextRequest!==run.previousRequestId)return true;
    return Boolean(nextStarted&&nextStarted>=run.startedAt-1500);
  }
  function rememberCompletion(source){
    sessionCompletion={projectId:projectId(source),outputId:outputId(source),requestId:requestId(source)};
    run=null;
  }
  function isSessionCompletion(source){
    if(!sessionCompletion||!source)return false;
    return sessionCompletion.projectId===projectId(source)&&(
      sessionCompletion.outputId&&sessionCompletion.outputId===outputId(source)||
      sessionCompletion.requestId&&sessionCompletion.requestId===requestId(source)
    );
  }
  function hideStaleSuccess(source){
    var scope=root(),status=scope&&scope.querySelector('[data-adfilm-engine-status]');
    if(!scope||!status||!status.classList.contains('is-success'))return;
    source=source||project();
    if(belongsToNewRun(source)){rememberCompletion(source);return}
    if(isSessionCompletion(source))return;

    status.setAttribute('data-adfilm-idle-hidden','1');
    status.classList.remove('is-visible','is-success','is-error','is-busy');
    status.removeAttribute('data-stage');
    status.style.removeProperty('display');
    status.style.removeProperty('visibility');
    status.style.removeProperty('opacity');

    if(!busy()){
      var summary=scope.querySelector('.adfilm-actionbar__summary [data-adfilm-i18n="readyTitle"]');
      if(summary)summary.textContent=String(document.documentElement.lang||"").toLowerCase().indexOf('en')===0?'Advertising project will be prepared':'Reklam projesi hazırlanacak';
    }
  }
  function schedule(source){[0,60,220,520,980,1350].forEach(function(delay){setTimeout(function(){hideStaleSuccess(source||project())},delay)})}
  function beginRun(){
    var source=project();
    run={projectId:projectId(source),previousRequestId:requestId(source),startedAt:Date.now()};
    sessionCompletion=null;
    schedule(source);
  }

  document.addEventListener('click',function(event){
    var button=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-adfilm-build]');
    if(button)beginRun();
  },true);
  document.addEventListener('aivo:adfilm-project-sync',function(event){
    var source=event&&event.detail&&event.detail.project||project();
    if(belongsToNewRun(source))rememberCompletion(source);
    schedule(source);
  },false);
  document.addEventListener('aivo:module-mounted',function(event){
    if(event&&event.detail&&event.detail.key==='adfilm')schedule(project());
  });
  window.addEventListener('pageshow',function(){run=null;sessionCompletion=null;schedule(project())});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){schedule(project())},{once:true});else schedule(project());
})();
