/* =========================================================
   AIVO — AI REKLAM FILMI / BASIC MODE SCENE CLEANUP
   Basic Mode does not expose a technical scene plan. AIVO
   prepares scene order automatically; detailed control belongs
   to Advanced Mode.
   ========================================================= */
(function AIVO_AD_FILM_BASIC_SCENE_CLEANUP(){
  "use strict";
  if(window.__AIVO_AD_FILM_BASIC_SCENE_CLEANUP__) return;
  window.__AIVO_AD_FILM_BASIC_SCENE_CLEANUP__=true;

  var COPY={
    tr:{
      advanced:"İsteğe bağlı: görsel stil ve çıktı kalitesi.",
      automatic:"AIVO, yüklediğin görselleri reklam süresine göre sıralar ve sahneleri otomatik hazırlar."
    },
    en:{
      advanced:"Optional: visual style and output quality.",
      automatic:"AIVO arranges your uploaded visuals for the selected duration and prepares the scenes automatically."
    }
  };

  function language(){
    var html=String(document.documentElement.lang||"").toLowerCase();
    var stored="";
    try{stored=String(localStorage.getItem("aivo_language")||localStorage.getItem("aivo_lang")||"").toLowerCase()}catch(_){}
    return stored==="en"||html.indexOf("en")===0?"en":"tr";
  }

  function apply(scope){
    if(!scope)return;

    var storyboard=scope.querySelector(".adfilm-card--storyboard");
    if(storyboard)storyboard.remove();

    var copy=COPY[language()]||COPY.tr;
    var advancedSub=scope.querySelector(".adfilm-simple-advanced__copy small");
    if(advancedSub){
      advancedSub.removeAttribute("data-simple-copy");
      advancedSub.textContent=copy.advanced;
    }

    var automaticSub=scope.querySelector(".adfilm-simple-auto small");
    if(automaticSub){
      automaticSub.removeAttribute("data-simple-copy");
      automaticSub.textContent=copy.automatic;
    }

    scope.classList.add("is-basic-scene-plan-hidden");
  }

  function findRoot(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function schedule(scope){setTimeout(function(){apply(scope||findRoot())},160)}

  document.addEventListener("aivo:module-mounted",function(event){
    if(event&&event.detail&&event.detail.key==="adfilm")schedule(event.detail.root);
  });

  window.addEventListener("storage",function(event){
    if(event&&(event.key==="aivo_language"||event.key==="aivo_lang"))schedule(findRoot());
  });

  var observer=new MutationObserver(function(){
    var scope=findRoot();
    if(scope)schedule(scope);
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){schedule(findRoot())},{once:true});
  else schedule(findRoot());
})();
