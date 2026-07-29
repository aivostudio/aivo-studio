/* AIVO AI Reklam Filmi — clean idle/new-project UI */
(function AIVO_AD_FILM_IDLE_UI_CLEANUP(){
  "use strict";
  if(window.__AIVO_AD_FILM_IDLE_UI_CLEANUP__)return;
  window.__AIVO_AD_FILM_IDLE_UI_CLEANUP__=true;

  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function project(){return window.AIVOAdFilmActiveProject&&typeof window.AIVOAdFilmActiveProject==="object"?window.AIVOAdFilmActiveProject:null}
  function clean(value){return String(value==null?"":value).trim().toLowerCase()}
  function isRunning(source){
    var status=clean(source&&source.generation&&source.generation.status);
    var button=root()&&root().querySelector('[data-adfilm-build]');
    return status==="queued"||status==="processing"||!!(button&&button.classList.contains("is-generating"));
  }
  function defaultTitle(){
    var en=String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0;
    return en?"Advertising project will be prepared":"Reklam projesi hazırlanacak";
  }
  function cleanup(){
    var scope=root();if(!scope)return;

    scope.querySelectorAll('[data-adfilm-simple-auto],.adfilm-simple-auto').forEach(function(node){node.remove()});
    scope.querySelectorAll('.adfilm-reference-map,.adfilm-media-note').forEach(function(node){node.remove()});

    var status=scope.querySelector('[data-adfilm-engine-status]');
    var running=isRunning(project());
    if(status){
      if(running){
        status.removeAttribute('data-adfilm-idle-hidden');
      }else{
        status.setAttribute('data-adfilm-idle-hidden','1');
        status.classList.remove('is-visible','is-success','is-error','is-busy');
      }
    }

    if(!running){
      var action=scope.querySelector('.adfilm-actionbar');
      if(action)action.classList.remove('is-engine-active');
      var button=scope.querySelector('[data-adfilm-build]');
      if(button)button.classList.remove('is-generating');
      var summary=scope.querySelector('.adfilm-actionbar__summary [data-adfilm-i18n="readyTitle"]');
      if(summary)summary.textContent=defaultTitle();
    }
  }

  function schedule(){[0,80,260,700,1400].forEach(function(delay){setTimeout(cleanup,delay)})}
  document.addEventListener('aivo:module-mounted',function(event){if(event&&event.detail&&event.detail.key==='adfilm')schedule()});
  document.addEventListener('aivo:adfilm-project-sync',function(){setTimeout(cleanup,120)});
  var observer=new MutationObserver(function(){var scope=root();if(scope)setTimeout(cleanup,20)});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
