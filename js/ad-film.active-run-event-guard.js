/* AIVO AI Reklam Filmi — block stale completed-project events during a new run */
(function(){
  "use strict";
  if(window.__AIVO_AD_FILM_ACTIVE_RUN_EVENT_GUARD_V1__)return;
  window.__AIVO_AD_FILM_ACTIVE_RUN_EVENT_GUARD_V1__=true;

  var runStartedAt=0;
  var observer=null;

  function clean(value){return String(value==null?"":value).trim()}
  function lower(value){return clean(value).toLowerCase()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function button(){var scope=root();return scope&&scope.querySelector('[data-adfilm-build]')}
  function action(){var scope=root();return scope&&scope.querySelector('.adfilm-actionbar')}
  function isActive(){
    var build=button(),bar=action();
    return !!(build&&(build.classList.contains('is-generating')||build.getAttribute('aria-busy')==='true')||bar&&bar.classList.contains('is-engine-active'));
  }
  function projectTime(project){
    var gen=project&&project.generation||{};
    var values=[gen.startedAt,gen.createdAt,project&&project.startedAt].map(function(value){return Date.parse(value||'')}).filter(Number.isFinite);
    return values.length?Math.max.apply(Math,values):0;
  }
  function isCompleted(project){
    var gen=project&&project.generation||{};
    return lower(project&&project.status)==='completed'||lower(gen.status)==='completed'||!!clean(gen.videoUrl);
  }
  function markRun(){
    if(isActive()&&!runStartedAt)runStartedAt=Date.now();
    if(!isActive()&&runStartedAt&&Date.now()-runStartedAt>2000)runStartedAt=0;
  }

  document.addEventListener('aivo:adfilm-project-sync',function(event){
    markRun();
    if(!isActive())return;
    var incoming=event&&event.detail&&event.detail.project;
    if(!incoming||!isCompleted(incoming))return;
    var started=projectTime(incoming);
    if(!runStartedAt||!started||started<runStartedAt-5000){
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  },true);

  observer=new MutationObserver(markRun);
  observer.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class','aria-busy']});
  setInterval(markRun,500);
  window.addEventListener('pagehide',function(){if(observer)observer.disconnect()});
  window.AIVOAdFilmActiveRunEventGuard={active:isActive,startedAt:function(){return runStartedAt}};
})();
