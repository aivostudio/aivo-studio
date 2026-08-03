/* AIVO AI Reklam Filmi — professional output quality policy */
(function AIVO_AD_FILM_QUALITY_POLICY(){
  "use strict";
  if(window.__AIVO_AD_FILM_QUALITY_POLICY_V2__)return;
  window.__AIVO_AD_FILM_QUALITY_POLICY_V2__=true;

  function english(){
    return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0;
  }

  function hide(button){
    if(!button)return;
    button.hidden=true;
    button.setAttribute('aria-hidden','true');
    button.setAttribute('tabindex','-1');
    button.style.setProperty('display','none','important');
  }

  function apply(scope){
    var root=scope&&scope.matches&&scope.matches('[data-module-root][data-module="adfilm"]')
      ? scope
      : document.querySelector('[data-module-root][data-module="adfilm"]');
    if(!root)return;

    var button480=root.querySelector('button[data-value="480p"]');
    var button720=root.querySelector('button[data-value="720p"]');
    var qualityGroup=(button480||button720)&&((button480||button720).closest('[data-adfilm-choice]'));

    hide(button480);
    hide(button720);

    var invalidSelected=qualityGroup&&qualityGroup.querySelector('button[data-value="480p"].is-selected,button[data-value="720p"].is-selected');
    var button1080=qualityGroup&&qualityGroup.querySelector('button[data-value="1080p"]');
    if(invalidSelected&&button1080)button1080.click();

    var visible=qualityGroup&&Array.from(qualityGroup.querySelectorAll('button[data-value]')).filter(function(button){return !button.hidden});
    if(visible&&visible.length===2)qualityGroup.setAttribute('data-adfilm-professional-quality','1');

    var sub=root.querySelector('[data-adfilm-i18n="outputQualitySub"]');
    if(sub)sub.textContent=english()
      ? 'Choose 1080p professional quality or 4K premium quality.'
      : '1080p profesyonel kalite veya 4K premium kaliteyi seç.';

    var note=root.querySelector('[data-adfilm-i18n="qualityNote"]');
    if(note)note.textContent=english()
      ? '1080p professional final, 4K premium.'
      : '1080p profesyonel final, 4K premium.';
  }

  document.addEventListener('aivo:module-mounted',function(event){
    if(event&&event.detail&&event.detail.key==='adfilm'){
      [0,120,400,900].forEach(function(delay){setTimeout(function(){apply(event.detail.root)},delay)});
    }
  });
  document.addEventListener('aivo:adfilm-project-sync',function(){setTimeout(function(){apply()},0)});
  document.addEventListener('aivo:adfilm-assets-ready',function(){setTimeout(function(){apply()},0)});
  document.addEventListener('click',function(event){
    var lang=event.target&&event.target.closest&&event.target.closest('[data-aivo-language]');
    if(lang)setTimeout(function(){apply()},0);
  },true);

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(function(){apply()},200)},{once:true});
  else setTimeout(function(){apply()},200);

  window.AIVOAdFilmQualityPolicy={apply:apply};
})();
