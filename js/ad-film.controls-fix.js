/* AIVO AI Reklam Filmi — legacy control bridge intentionally disabled.
   js/ad-film.result-controls.js is the single owner of live and gallery controls. */
(function AIVO_AD_FILM_CONTROLS_FIX_DISABLED(){
  "use strict";
  window.__AIVO_AD_FILM_CONTROLS_FIX__=true;

  if(!document.querySelector('link[href^="/css/studio.sidebar.icons.css"]')){
    var sidebarIcons=document.createElement("link");
    sidebarIcons.rel="stylesheet";
    sidebarIcons.href="/css/studio.sidebar.icons.css?v=1";
    document.head.appendChild(sidebarIcons);
  }

  if(!document.querySelector('script[src^="/js/ad-film.i18n-completion.js"]')){
    var script=document.createElement("script");
    script.src="/js/ad-film.i18n-completion.js?v=1";
    script.async=false;
    document.head.appendChild(script);
  }

  if(!document.querySelector('script[src^="/js/ad-film.radio-production-i18n.js"]')){
    var radioScript=document.createElement("script");
    radioScript.src="/js/ad-film.radio-production-i18n.js?v=1";
    radioScript.async=false;
    document.head.appendChild(radioScript);
  }

  if(!document.querySelector('script[src^="/js/ad-film.radio-word-estimate-i18n.js"]')){
    var estimateScript=document.createElement("script");
    estimateScript.src="/js/ad-film.radio-word-estimate-i18n.js?v=1";
    estimateScript.async=false;
    document.head.appendChild(estimateScript);
  }
})();
