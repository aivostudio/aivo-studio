/* AIVO AI Reklam Filmi — keep progress stable across the native Fal.ai confirmation */
(function AIVO_AD_FILM_CONFIRM_PROGRESS_BRIDGE(){
  "use strict";
  if(window.__AIVO_AD_FILM_CONFIRM_PROGRESS_BRIDGE_V1__)return;
  window.__AIVO_AD_FILM_CONFIRM_PROGRESS_BRIDGE_V1__=true;

  var originalConfirm=window.confirm.bind(window);
  var CONFIRM_RE=/(Fal\.ai|gerçek Fal\.ai üretimi|real Fal\.ai generation)/i;

  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function button(){var scope=root();return scope&&scope.querySelector('[data-adfilm-build]')}
  function action(){var scope=root();return scope&&scope.querySelector('.adfilm-actionbar')}
  function status(){var scope=root();return scope&&scope.querySelector('[data-adfilm-engine-status]')}

  function markAccepted(){
    window.__AIVO_AD_FILM_CONFIRM_ACCEPTED_UNTIL__=Date.now()+120000;
    var build=button(),bar=action(),node=status();
    if(build){
      build.classList.add('is-generating');
      build.setAttribute('aria-busy','true');
      build.disabled=true;
    }
    if(bar){
      bar.classList.add('is-engine-active');
      bar.setAttribute('data-adfilm-progress-lock','1');
    }
    if(node){
      node.removeAttribute('data-adfilm-idle-hidden');
      node.classList.add('is-visible','is-busy');
      node.style.setProperty('display','block','important');
      node.style.setProperty('visibility','visible','important');
      node.style.setProperty('opacity','1','important');
    }
    if(window.AIVOAdFilmProgressLock&&typeof window.AIVOAdFilmProgressLock.begin==='function')window.AIVOAdFilmProgressLock.begin();
  }

  function releaseCancelled(){
    window.__AIVO_AD_FILM_CONFIRM_ACCEPTED_UNTIL__=0;
    if(window.AIVOAdFilmProgressLock&&typeof window.AIVOAdFilmProgressLock.release==='function')window.AIVOAdFilmProgressLock.release();
    if(window.AIVOAdFilmProgressUI&&typeof window.AIVOAdFilmProgressUI.release==='function')window.AIVOAdFilmProgressUI.release();
    var build=button(),bar=action(),node=status();
    if(build){build.classList.remove('is-generating','is-loading','is-music-preparing');build.removeAttribute('aria-busy');build.disabled=false}
    if(bar){bar.classList.remove('is-engine-active');bar.removeAttribute('data-adfilm-progress-lock')}
    if(node){
      node.setAttribute('data-adfilm-idle-hidden','1');
      node.classList.remove('is-visible','is-busy','is-success','is-error');
      node.style.removeProperty('display');
      node.style.removeProperty('visibility');
      node.style.removeProperty('opacity');
    }
  }

  window.confirm=function(message){
    var relevant=CONFIRM_RE.test(String(message||''));
    var result=originalConfirm(message);
    if(relevant){
      if(result)markAccepted();
      else releaseCancelled();
    }
    return result;
  };
})();
