/* AIVO AI Reklam Filmi — bridge the real narration host to premium player */
(function AIVO_AD_FILM_NARRATION_PLAYER_HOST_FIX(){
  "use strict";
  if(window.__AIVO_AD_FILM_NARRATION_PLAYER_HOST_FIX_V1__)return;
  window.__AIVO_AD_FILM_NARRATION_PLAYER_HOST_FIX_V1__=true;

  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function apply(scope){
    scope=scope||root();
    if(!scope)return false;
    var host=scope.querySelector('[data-narration-engine-player]');
    if(!host)return false;
    host.setAttribute('data-adfilm-narration-engine-player','');
    var audio=host.querySelector('[data-narration-audio]');
    if(audio){
      audio.controls=false;
      audio.removeAttribute('controls');
      audio.classList.add('adfilm-native-audio-hidden');
    }
    return true;
  }

  document.addEventListener('aivo:module-mounted',function(event){
    if(event&&event.detail&&event.detail.key==='adfilm')apply(event.detail.root||root());
  },true);
  document.addEventListener('aivo:adfilm-project-sync',function(){apply(root())},true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){apply(root())},{once:true});
  else apply(root());
})();
