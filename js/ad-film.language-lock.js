/* AIVO AI Ad Film — V1 narration language lock */
(function AIVO_AD_FILM_LANGUAGE_LOCK(){
  "use strict";
  if(window.__AIVO_AD_FILM_LANGUAGE_LOCK__) return;
  window.__AIVO_AD_FILM_LANGUAGE_LOCK__=true;

  function apply(root){
    var scope=root&&root.querySelector?root:document;
    scope.querySelectorAll('select[data-adfilm-input="language"]').forEach(function(select){
      Array.from(select.options).forEach(function(option){
        if(option.value!=="tr"&&option.value!=="en") option.remove();
      });
      if(select.value!=="tr"&&select.value!=="en"){
        select.value="tr";
        select.dispatchEvent(new Event("change",{bubbles:true}));
      }
    });
  }

  function loadOutputControls(){
    if(window.__AIVO_AD_FILM_OUTPUT_CONTROLS__||document.querySelector('script[data-adfilm-output-controls]')) return;
    var script=document.createElement("script");
    script.src="/js/ad-film.output-controls.js?v=1";
    script.async=false;
    script.setAttribute("data-adfilm-output-controls","");
    document.head.appendChild(script);
  }

  document.addEventListener("aivo:module-mounted",function(event){
    if(event&&event.detail&&event.detail.key==="adfilm"){
      setTimeout(function(){apply(event.detail.root)},20);
      loadOutputControls();
    }
  });

  var observer=new MutationObserver(function(){apply(document)});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  loadOutputControls();
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",function(){apply(document)},{once:true});
  else apply(document);
})();
