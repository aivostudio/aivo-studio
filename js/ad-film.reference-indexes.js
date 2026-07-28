/* AIVO AI Reklam Filmi — keep visible @Image labels aligned with Fal input order. */
(function AIVO_AD_FILM_REFERENCE_INDEXES(){
  "use strict";
  if(window.__AIVO_AD_FILM_REFERENCE_INDEXES__)return;
  window.__AIVO_AD_FILM_REFERENCE_INDEXES__=true;

  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function sync(scope){
    if(!scope)return;
    var tray=scope.querySelector("[data-role-preview]");if(!tray)return;
    var index=1;
    tray.querySelectorAll(".adfilm-role-thumb:not(.adfilm-role-thumb--logo)").forEach(function(card){
      var badge=card.querySelector("div > span");if(badge)badge.textContent="@Image"+(index++);
    });
  }
  function schedule(scope){[0,80,220,520].forEach(function(delay){setTimeout(function(){sync(scope||root())},delay)})}

  document.addEventListener("change",function(event){if(event.target&&event.target.closest&&event.target.closest('[data-module-root][data-module="adfilm"] [data-adfilm-role-file]'))schedule(root())},true);
  document.addEventListener("click",function(event){if(event.target&&event.target.closest&&event.target.closest("[data-role-remove],[data-adfilm-draft-reset]"))schedule(root())},true);
  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm")schedule(event.detail.root)});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){schedule(root())},{once:true});else schedule(root());
})();
