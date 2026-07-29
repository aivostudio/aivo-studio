/* AIVO AI Reklam Filmi — reopen module after intentional project reload */
(function AIVO_AD_FILM_REOPEN_FIX(){
  "use strict";
  if(window.__AIVO_AD_FILM_REOPEN_FIX__)return;
  window.__AIVO_AD_FILM_REOPEN_FIX__=true;

  var KEY="aivo_adfilm_reopen_module_v1";
  var timer=null;
  var attempts=0;

  function pending(){try{return sessionStorage.getItem(KEY)==="1"}catch(_){return false}}
  function clear(){try{sessionStorage.removeItem(KEY)}catch(_){} }

  function openModule(){
    if(!pending())return;
    clearTimeout(timer);
    attempts++;
    var current=document.querySelector('[data-module-root][data-module="adfilm"]');
    if(current){
      clear();
      return;
    }
    var button=document.querySelector("[data-adfilm-open]");
    if(button){
      button.click();
      timer=setTimeout(openModule,250);
      return;
    }
    if(attempts<60)timer=setTimeout(openModule,150);
  }

  document.addEventListener("aivo:module-mounted",function(event){
    if(event&&event.detail&&event.detail.key==="adfilm")clear();
  });
  window.addEventListener("pageshow",function(){attempts=0;openModule()});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){attempts=0;openModule()},{once:true});
  else openModule();
})();