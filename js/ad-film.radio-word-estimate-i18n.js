/* AIVO Radio Advertisement — word estimate label TR/EN fix */
(function AIVO_RADIO_WORD_ESTIMATE_I18N(){
  "use strict";
  if(window.__AIVO_RADIO_WORD_ESTIMATE_I18N_V1__)return;
  window.__AIVO_RADIO_WORD_ESTIMATE_I18N_V1__=true;

  var ROOT='[data-module-root][data-module="adfilm"]';
  var PANEL='[data-adfilm-radio-panel]';

  function language(){
    try{
      if(window.AIVO_STUDIO_I18N&&typeof window.AIVO_STUDIO_I18N.getLanguage==='function'){
        return window.AIVO_STUDIO_I18N.getLanguage()==='en'?'en':'tr';
      }
    }catch(_){}
    try{
      if(window.AIVOAdFilmI18n&&typeof window.AIVOAdFilmI18n.language==='function'){
        return window.AIVOAdFilmI18n.language()==='en'?'en':'tr';
      }
    }catch(_){}
    var stored='';
    try{stored=String(localStorage.getItem('aivo_language')||localStorage.getItem('aivo_lang')||'').toLowerCase()}catch(_){}
    return stored==='en'||String(document.documentElement.lang||'').toLowerCase().indexOf('en')===0?'en':'tr';
  }

  function setFollowingText(node,value){
    if(!node)return;
    var next=node.nextSibling;
    if(next&&next.nodeType===Node.TEXT_NODE){
      if(next.nodeValue!==value)next.nodeValue=value;
      return;
    }
    node.parentNode.insertBefore(document.createTextNode(value),next||null);
  }

  function sync(scope){
    var root=scope&&scope.matches&&scope.matches(ROOT)?scope:document.querySelector(ROOT);
    var panel=root&&root.querySelector(PANEL);
    if(!panel)return;
    var count=panel.querySelector('[data-radio-word-count]');
    var estimate=panel.querySelector('[data-radio-estimate]');
    if(!count||!estimate||count.parentElement!==estimate.parentElement)return;
    var english=language()==='en';
    setFollowingText(count,english?' words · about ':' kelime · tahmini ');
    setFollowingText(estimate,english?' sec':' sn');
  }

  function schedule(scope){
    [0,40,120,300,700].forEach(function(delay){setTimeout(function(){sync(scope)},delay)});
  }

  document.addEventListener('aivo:module-mounted',function(event){
    if(event&&event.detail&&event.detail.key==='adfilm')schedule(event.detail.root);
  });
  ['aivo:adfilm-assets-ready','aivo:language-change','aivo:adfilm-language-change','aivo:radioad-project-sync'].forEach(function(name){
    document.addEventListener(name,function(){schedule(document.querySelector(ROOT))});
  });
  document.addEventListener('input',function(event){
    if(event.target&&event.target.closest&&event.target.closest(ROOT+' '+PANEL))schedule(document.querySelector(ROOT));
  },true);
  document.addEventListener('change',function(event){
    if(event.target&&event.target.closest&&event.target.closest(ROOT+' '+PANEL))schedule(document.querySelector(ROOT));
  },true);
  document.addEventListener('click',function(event){
    if(event.target&&event.target.closest&&event.target.closest(ROOT+' '+PANEL))schedule(document.querySelector(ROOT));
  },true);
  window.addEventListener('pageshow',function(){schedule(document.querySelector(ROOT))});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){schedule(document.querySelector(ROOT))},{once:true});
  else schedule(document.querySelector(ROOT));
})();
