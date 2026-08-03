/* AIVO AI Reklam Filmi — active run and clean reopen guard */
(function(){
  "use strict";
  if(window.__AIVO_AD_FILM_ACTIVE_RUN_EVENT_GUARD_V4__)return;
  window.__AIVO_AD_FILM_ACTIVE_RUN_EVENT_GUARD_V4__=true;
  window.__AIVO_AD_FILM_ACTIVE_RUN_EVENT_GUARD_V3__=true;
  window.__AIVO_AD_FILM_ACTIVE_RUN_EVENT_GUARD_V2__=true;

  var runStartedAt=0;
  var sessionRun=false;
  var cleanupTimer=null;
  var originalConfirm=window.confirm.bind(window);
  var FAL_CONFIRM_RE=/(Bu test gerçek Fal\.ai üretimi başlatır|This test starts a real Fal\.ai generation)/i;

  function clean(value){return String(value==null?"":value).trim()}
  function lower(value){return clean(value).toLowerCase()}
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function button(){var scope=root();return scope&&scope.querySelector('[data-adfilm-build]')}
  function action(){var scope=root();return scope&&scope.querySelector('.adfilm-actionbar')}
  function setCurrentRunCompleted(on){
    var scope=root();if(!scope)return;
    if(on)scope.setAttribute('data-adfilm-current-run-completed','1');
    else scope.removeAttribute('data-adfilm-current-run-completed');
  }
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
  function idleTitle(){return String(document.documentElement.lang||'').toLowerCase().indexOf('en')===0?'Advertising project will be prepared':'Reklam projesi hazırlanacak'}
  function hideStaleCompleted(){
    if(isActive())return;
    var scope=root();if(!scope||scope.getAttribute('data-adfilm-current-run-completed')==='1')return;
    var node=scope.querySelector('[data-adfilm-engine-status]');
    if(node&&node.classList.contains('is-success')){
      node.className='adfilm-engine-status';
      node.setAttribute('data-adfilm-idle-hidden','1');
      node.removeAttribute('data-stage');
      node.style.removeProperty('display');
      node.style.removeProperty('visibility');
      node.style.removeProperty('opacity');
    }
    var bar=action();if(bar){bar.classList.remove('is-engine-active');bar.removeAttribute('data-adfilm-progress-lock')}
    var build=button();if(build){
      build.classList.remove('is-generating','is-loading','is-music-preparing');
      build.removeAttribute('aria-busy');
      build.disabled=build.dataset.narrationGuard==='blocked';
    }
    var title=scope.querySelector('.adfilm-actionbar__summary [data-adfilm-i18n="readyTitle"]');
    if(title)title.textContent=idleTitle();
  }
  function markRun(){
    if(isActive()&&!runStartedAt)runStartedAt=Date.now();
    if(!isActive()&&runStartedAt&&!sessionRun&&Date.now()-runStartedAt>2000)runStartedAt=0;
  }
  function scheduleCleanup(){
    clearTimeout(cleanupTimer);
    var checks=0;
    function check(){
      checks++;
      markRun();
      hideStaleCompleted();
      if(!sessionRun&&checks<8)cleanupTimer=setTimeout(check,250);
    }
    check();
  }

  window.confirm=function(message){
    if(FAL_CONFIRM_RE.test(String(message||'')))return true;
    return originalConfirm(message);
  };

  document.addEventListener('click',function(event){
    var build=event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-adfilm-build]');
    if(build){
      /* Clear an old completed card before the lazy asset loader marks the
         button busy. Otherwise the previous success state becomes visible for
         one frame while the production engine is still loading. */
      setCurrentRunCompleted(false);
      hideStaleCompleted();
      sessionRun=true;
      runStartedAt=Date.now();
      clearTimeout(cleanupTimer);
    }
  },true);

  document.addEventListener('aivo:adfilm-project-sync',function(event){
    markRun();
    var incoming=event&&event.detail&&event.detail.project;
    if(incoming&&isCompleted(incoming)&&sessionRun){
      var started=projectTime(incoming);
      if(started&&runStartedAt&&started>=runStartedAt-5000){
        setCurrentRunCompleted(true);
        return;
      }
      if(isActive()){
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }
    }
    if(!isActive()){
      if(!sessionRun)scheduleCleanup();
      return;
    }
    if(!incoming||!isCompleted(incoming))return;
    var startedAt=projectTime(incoming);
    if(!runStartedAt||!startedAt||startedAt<runStartedAt-5000){
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  },true);

  document.addEventListener('aivo:module-mounted',function(event){
    if(!event||!event.detail||event.detail.key!=='adfilm')return;
    sessionRun=false;
    runStartedAt=0;
    setCurrentRunCompleted(false);
    scheduleCleanup();
  });

  window.addEventListener('pagehide',function(){clearTimeout(cleanupTimer)});
  window.AIVOAdFilmActiveRunEventGuard={
    active:isActive,
    startedAt:function(){return runStartedAt},
    hideStaleCompleted:hideStaleCompleted,
    allowCurrentCompletion:function(){setCurrentRunCompleted(true)}
  };
})();
