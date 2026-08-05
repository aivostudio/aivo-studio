/* AIVO AI Ad Film — supported narration languages */
(function AIVO_AD_FILM_LANGUAGE_OPTIONS(){
  "use strict";
  if(window.__AIVO_AD_FILM_LANGUAGE_OPTIONS_V4__)return;
  window.__AIVO_AD_FILM_LANGUAGE_OPTIONS_V4__=true;

  var LANGUAGES=[
    ["tr","Türkçe"],["en","English"],["de","Deutsch"],["fr","Français"],["es","Español"],
    ["it","Italiano"],["pt","Português"],["ar","العربية"],["ru","Русский"],["nl","Nederlands"],
    ["pl","Polski"],["uk","Українська"],["hi","हिन्दी"],["id","Bahasa Indonesia"],["ms","Bahasa Melayu"],
    ["ja","日本語"],["ko","한국어"],["zh","中文"],["vi","Tiếng Việt"],["th","ไทย"]
  ];

  var LANGUAGE_SELECTOR='select[data-adfilm-input="language"],[data-adfilm-radio-panel] .adfilm-radio-card:first-child .adfilm-radio-fields>label:first-child>select';
  var applying=false;
  function root(){return document.querySelector('[data-module-root][data-module="adfilm"]')}
  function optionHtml(){return LANGUAGES.map(function(item){return '<option value="'+item[0]+'">'+item[1]+'</option>'}).join("")}
  function hasCompleteList(select){if(!select)return false;return LANGUAGES.every(function(item){return !!select.querySelector('option[value="'+item[0]+'"]')})}
  function apply(scope,preferred){if(applying)return;scope=scope&&scope.querySelectorAll?scope:root();if(!scope)return;applying=true;try{scope.querySelectorAll(LANGUAGE_SELECTOR).forEach(function(select){var current=String(preferred||select.value||"tr").toLowerCase();if(!hasCompleteList(select))select.innerHTML=optionHtml();if(!LANGUAGES.some(function(item){return item[0]===current}))current="tr";if(select.value!==current)select.value=current})}finally{applying=false}}
  function schedule(scope,preferred){[0,40,160,500].forEach(function(delay){setTimeout(function(){apply(scope||root(),preferred)},delay)})}

  function loadOutputControls(){if(!document.querySelector('link[data-adfilm-output-controls-css]')){var link=document.createElement("link");link.rel="stylesheet";link.href="/css/ad-film.output-controls.css?v=2";link.setAttribute("data-adfilm-output-controls-css","");document.head.appendChild(link)}if(window.__AIVO_AD_FILM_OUTPUT_CONTROLS__||document.querySelector('script[data-adfilm-output-controls]'))return;var script=document.createElement("script");script.src="/js/ad-film.output-controls.js?v=2";script.async=false;script.setAttribute("data-adfilm-output-controls","");document.head.appendChild(script)}
  function loadRadioNarrationEngine(){if(window.__AIVO_RADIO_NARRATION_ENGINE_V1__||document.querySelector('script[data-radio-narration-engine]'))return;var script=document.createElement('script');script.src='/js/ad-film.radio-narration-engine.js?v=1';script.async=false;script.setAttribute('data-radio-narration-engine','');document.head.appendChild(script)}

  document.addEventListener("aivo:module-mounted",function(event){if(event&&event.detail&&event.detail.key==="adfilm"){schedule(event.detail.root);loadOutputControls();loadRadioNarrationEngine()}});
  document.addEventListener("aivo:adfilm-project-sync",function(event){var project=event&&event.detail&&event.detail.project;schedule(root(),project&&project.narration&&project.narration.language)});
  document.addEventListener("aivo:radioad-project-sync",function(event){var project=event&&event.detail&&event.detail.project;schedule(root(),project&&project.narration&&project.narration.language)});
  document.addEventListener("aivo:language-change",function(){schedule(root())});
  document.addEventListener("aivo:adfilm-language-change",function(){schedule(root())});

  var observer=new MutationObserver(function(mutations){var scope=root();if(!scope||applying)return;var needsApply=mutations.some(function(mutation){if(mutation.type==="childList"){if(mutation.target&&mutation.target.matches&&mutation.target.matches(LANGUAGE_SELECTOR))return true;return Array.from(mutation.addedNodes||[]).some(function(node){return node.nodeType===1&&((node.matches&&node.matches(LANGUAGE_SELECTOR))||(node.querySelector&&node.querySelector(LANGUAGE_SELECTOR)))})}return false});if(needsApply)schedule(scope)});
  observer.observe(document.documentElement,{childList:true,subtree:true});

  loadOutputControls();loadRadioNarrationEngine();
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){schedule(root())},{once:true});else schedule(root());
})();
