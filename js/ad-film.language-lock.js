/* AIVO AI Ad Film — supported narration languages */
(function AIVO_AD_FILM_LANGUAGE_OPTIONS(){
  "use strict";
  if(window.__AIVO_AD_FILM_LANGUAGE_OPTIONS_V2__)return;
  window.__AIVO_AD_FILM_LANGUAGE_OPTIONS_V2__=true;

  var LANGUAGES=[
    ["tr","Türkçe"],["en","English"],["de","Deutsch"],["fr","Français"],
    ["es","Español"],["it","Italiano"],["pt","Português"],["ar","العربية"],
    ["ru","Русский"],["nl","Nederlands"],["pl","Polski"],["uk","Українська"],
    ["hi","हिन्दी"],["id","Bahasa Indonesia"],["ms","Bahasa Melayu"],
    ["ja","日本語"],["ko","한국어"],["zh","中文"],["vi","Tiếng Việt"],["th","ไทย"]
  ];

  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function apply(scope,preferred){
    scope=scope&&scope.querySelectorAll?scope:root();if(!scope)return;
    scope.querySelectorAll('select[data-adfilm-input="language"]').forEach(function(select){
      var current=String(preferred||select.value||"tr").toLowerCase();
      select.innerHTML=LANGUAGES.map(function(item){return '<option value="'+item[0]+'">'+item[1]+'</option>'}).join("");
      select.value=LANGUAGES.some(function(item){return item[0]===current})?current:"tr";
    });
  }

  function loadOutputControls(){
    if(!document.querySelector('link[data-adfilm-output-controls-css]')){
      var link=document.createElement("link");link.rel="stylesheet";link.href="/css/ad-film.output-controls.css?v=2";link.setAttribute("data-adfilm-output-controls-css","");document.head.appendChild(link);
    }
    if(window.__AIVO_AD_FILM_OUTPUT_CONTROLS__||document.querySelector('script[data-adfilm-output-controls]'))return;
    var script=document.createElement("script");script.src="/js/ad-film.output-controls.js?v=2";script.async=false;script.setAttribute("data-adfilm-output-controls","");document.head.appendChild(script);
  }

  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm"){setTimeout(function(){apply(event.detail.root)},20);loadOutputControls()}});
  document.addEventListener("aivo:adfilm-project-sync",function(event){var project=event&&event.detail&&event.detail.project;setTimeout(function(){apply(root(),project&&project.narration&&project.narration.language)},20)});
  loadOutputControls();
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){apply(root())},{once:true});else apply(root());
})();
