/* AIVO AI Reklam Filmi — professional output quality policy */
(function AIVO_AD_FILM_QUALITY_POLICY(){
  "use strict";
  if(window.__AIVO_AD_FILM_QUALITY_POLICY_V5__)return;
  window.__AIVO_AD_FILM_QUALITY_POLICY_V5__=true;
  window.__AIVO_AD_FILM_QUALITY_POLICY_V4__=true;

  function english(){return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0}
  function root(scope){
    if(scope&&scope.matches&&scope.matches('[data-module-root][data-module="adfilm"]'))return scope;
    return document.querySelector('[data-module-root][data-module="adfilm"]');
  }
  function qualityGroup(scope){return scope&&scope.querySelector('[data-adfilm-choice="quality"]')}
  function valueOf(node){return String(node&&node.getAttribute&&node.getAttribute('data-value')||node&&node.textContent||'').trim().toLowerCase()}
  function removeLowQuality(scope){
    var group=qualityGroup(scope);if(!group)return false;
    group.querySelectorAll('[data-value="480p"],[data-value="720p"]').forEach(function(node){node.remove()});
    var allowed=Array.from(group.querySelectorAll('[data-value]')).filter(function(node){return valueOf(node)==='1080p'||valueOf(node)==='4k'});
    var selected=group.querySelector('.is-selected[data-value]');
    if(!selected||allowed.indexOf(selected)<0){
      allowed.forEach(function(node){node.classList.remove('is-selected')});
      var button1080=allowed.find(function(node){return valueOf(node)==='1080p'});
      if(button1080){button1080.classList.add('is-selected');button1080.click()}
    }
    group.setAttribute('data-professional-quality-only','1');
    return true;
  }
  function rewriteCopy(scope){
    if(!scope)return;
    var sub=scope.querySelector('[data-adfilm-i18n="outputQualitySub"]');
    if(sub){sub.removeAttribute('data-adfilm-i18n');sub.textContent=english()?'Choose 1080p professional quality or 4K premium quality.':'1080p profesyonel kalite veya 4K premium kaliteyi seç.'}
    var note=scope.querySelector('[data-adfilm-i18n="qualityNote"]');
    if(note){note.removeAttribute('data-adfilm-i18n');note.textContent=english()?'1080p professional final, 4K premium.':'1080p profesyonel final, 4K premium.'}
  }
  function apply(scope){
    scope=root(scope);if(!scope)return false;
    var changed=removeLowQuality(scope);rewriteCopy(scope);return changed;
  }
  function applyBurst(scope){[0,40,120,300,700,1400].forEach(function(delay){setTimeout(function(){apply(scope)},delay)})}
  function loadElapsedOwner(){
    if(window.__AIVO_AD_FILM_ELAPSED_OWNER_V1__)return;
    if(document.querySelector('script[src^="/js/ad-film.elapsed-owner.js"]'))return;
    var script=document.createElement('script');
    script.src='/js/ad-film.elapsed-owner.js?v=1';
    script.async=false;
    document.head.appendChild(script);
  }

  document.addEventListener('aivo:module-mounted',function(event){if(event&&event.detail&&event.detail.key==='adfilm'){applyBurst(event.detail.root);loadElapsedOwner()}});
  document.addEventListener('aivo:adfilm-assets-ready',function(){applyBurst();loadElapsedOwner()});
  document.addEventListener('aivo:adfilm-project-sync',function(){applyBurst();loadElapsedOwner()});
  document.addEventListener('click',function(event){
    if(event.target&&event.target.closest&&event.target.closest('[data-adfilm-open],[data-aivo-language]')){applyBurst();loadElapsedOwner()}
  },true);

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){applyBurst();loadElapsedOwner()},{once:true});else{applyBurst();loadElapsedOwner()}
  window.AIVOAdFilmQualityPolicy={apply:apply};
})();
