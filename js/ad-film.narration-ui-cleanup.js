/* AIVO AI Reklam Filmi — narration UI cleanup */
(function AIVO_AD_FILM_NARRATION_UI_CLEANUP(){
  "use strict";
  if(window.__AIVO_AD_FILM_NARRATION_UI_CLEANUP_V1__)return;
  window.__AIVO_AD_FILM_NARRATION_UI_CLEANUP_V1__=true;

  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function clean(scope){
    scope=scope||root();if(!scope)return;
    var voiceCard=scope.querySelector('.adfilm-card--voice');
    if(voiceCard){
      voiceCard.querySelectorAll('[data-adfilm-choice="scriptMode"]').forEach(function(node){node.remove()});
      voiceCard.querySelectorAll('[data-pa-action="download"]').forEach(function(node){node.remove()});
    }
  }
  function schedule(scope){[0,80,220,500,1000,1600].forEach(function(delay){setTimeout(function(){clean(scope||root())},delay)})}

  document.addEventListener('aivo:module-mounted',function(event){if(event&&event.detail&&event.detail.key==='adfilm')schedule(event.detail.root)},true);
  document.addEventListener('aivo:adfilm-assets-ready',function(){schedule(root())},true);
  document.addEventListener('aivo:adfilm-project-sync',function(){schedule(root())},true);
  new MutationObserver(function(){clean(root())}).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){schedule(root())},{once:true});else schedule(root());
})();
