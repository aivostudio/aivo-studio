/* AIVO AI Reklam Filmi — UI-only professional quality policy */
(function AIVO_AD_FILM_QUALITY_UI_ONLY(){
  "use strict";
  if(window.__AIVO_AD_FILM_QUALITY_UI_ONLY_V3__)return;
  window.__AIVO_AD_FILM_QUALITY_UI_ONLY_V3__=true;

  var DIRECTION_LIMIT=1200;

  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function root(scope){
    if(scope&&scope.matches&&scope.matches('[data-module-root][data-module="adfilm"]'))return scope;
    return document.querySelector('[data-module-root][data-module="adfilm"]');
  }
  function valueOf(node){return String(node&&node.getAttribute&&node.getAttribute('data-value')||node&&node.textContent||'').trim().toLowerCase()}
  function applyDirectionLimit(scope){
    var textarea=scope&&scope.querySelector('[data-adfilm-input="creativeDirection"]');
    if(!textarea)return;
    textarea.maxLength=DIRECTION_LIMIT;
    textarea.setAttribute('maxlength',String(DIRECTION_LIMIT));
    var count=scope.querySelector('[data-plan-direction-count]');
    if(count){
      count.textContent=String(textarea.value.length);
      var wrap=count.parentElement;
      if(wrap){
        Array.from(wrap.childNodes).forEach(function(node){
          if(node.nodeType===3&&node.nodeValue&&node.nodeValue.indexOf('/')>=0)node.nodeValue=' / '+DIRECTION_LIMIT;
        });
      }
    }
  }
  function apply(scope){
    scope=root(scope);if(!scope)return false;
    applyDirectionLimit(scope);
    var group=scope.querySelector('[data-adfilm-choice="quality"]');
    if(!group)return true;
    group.querySelectorAll('[data-value="480p"],[data-value="2k"]').forEach(function(node){node.remove()});
    var allowed=Array.from(group.querySelectorAll('[data-value]')).filter(function(node){var value=valueOf(node);return value==='720p'||value==='1080p'||value==='4k'});
    var selected=group.querySelector('.is-selected[data-value]');
    if(!selected||allowed.indexOf(selected)<0){
      allowed.forEach(function(node){node.classList.remove('is-selected')});
      var button1080=allowed.find(function(node){return valueOf(node)==='1080p'});
      if(button1080){button1080.classList.add('is-selected');button1080.click()}
    }
    var sub=scope.querySelector('[data-adfilm-i18n="outputQualitySub"]');
    if(sub){sub.removeAttribute('data-adfilm-i18n');sub.textContent=english()?'Choose 720p economical, 1080p professional or 4K premium quality.':'720p ekonomik, 1080p profesyonel veya 4K premium kaliteyi seç.'}
    var note=scope.querySelector('[data-adfilm-i18n="qualityNote"]');
    if(note){note.removeAttribute('data-adfilm-i18n');note.textContent=english()?'720p economical preview, 1080p professional final, 4K premium.':'720p ekonomik, 1080p profesyonel final, 4K premium.'}
    group.setAttribute('data-quality-layout','three');
    return true;
  }
  function burst(scope){[0,50,150,400,900].forEach(function(delay){setTimeout(function(){apply(scope)},delay)})}
  document.addEventListener('aivo:module-mounted',function(event){if(event&&event.detail&&event.detail.key==='adfilm')burst(event.detail.root)});
  document.addEventListener('aivo:adfilm-assets-ready',function(){burst()});
  document.addEventListener('aivo:adfilm-project-sync',function(){burst()});
  document.addEventListener('input',function(event){
    if(event.target&&event.target.matches&&event.target.matches('[data-module="adfilm"] [data-adfilm-input="creativeDirection"]'))applyDirectionLimit(root());
  },true);
  document.addEventListener('click',function(event){if(event.target&&event.target.closest&&event.target.closest('[data-adfilm-open],[data-aivo-language]'))burst()},true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){burst()},{once:true});else burst();
  window.AIVOAdFilmQualityUI={apply:apply};
})();
