/* AIVO AI Reklam Filmi — legacy control bridge intentionally disabled.
   js/ad-film.result-controls.js is the single owner of live and gallery controls. */
(function AIVO_AD_FILM_CONTROLS_FIX_DISABLED(){
  "use strict";
  window.__AIVO_AD_FILM_CONTROLS_FIX__=true;

  if(!document.querySelector('script[src^="/js/ad-film.i18n-completion.js"]')){
    var script=document.createElement("script");
    script.src="/js/ad-film.i18n-completion.js?v=1";
    script.async=false;
    document.head.appendChild(script);
  }
})();
