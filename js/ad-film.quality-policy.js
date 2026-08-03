/* AIVO AI Reklam Filmi — temporary quality policy before public launch */
(function AIVO_AD_FILM_QUALITY_POLICY(){
  "use strict";
  if(window.__AIVO_AD_FILM_QUALITY_POLICY_V1__)return;
  window.__AIVO_AD_FILM_QUALITY_POLICY_V1__=true;

  function english(){
    return String(document.documentElement.lang||"").toLowerCase().indexOf("en")===0;
  }

  function apply(scope){
    var root=scope&&scope.matches&&scope.matches('[data-module-root][data-module="adfilm"]')
      ? scope
      : document.querySelector('[data-module-root][data-module="adfilm"]');
    if(!root)return;

    var qualityGroup=null;
    var button720=root.querySelector('button[data-value="720p"]');
    if(button720){
      qualityGroup=button720.closest('[data-adfilm-choice]');
      button720.hidden=true;
      button720.setAttribute('aria-hidden','true');
      button720.setAttribute('tabindex','-1');
      button720.style.setProperty('display','none','important');
    }

    var selected720=qualityGroup&&qualityGroup.querySelector('button[data-value="720p"].is-selected');
    if(selected720){
      var button1080=qualityGroup.querySelector('button[data-value="1080p"]');
      if(button1080)button1080.click();
    }

    var sub=root.querySelector('[data-adfilm-i18n="outputQualitySub"]');
    if(sub)sub.textContent=english()
      ? 'Choose 1080p professional quality or 4K premium quality. 480p remains available during testing.'
      : '1080p profesyonel kalite veya 4K premium kaliteyi seç. 480p test sürecinde kullanılabilir.';

    var note=root.querySelector('[data-adfilm-i18n="qualityNote"]');
    if(note)note.textContent=english()
      ? '480p internal test, 1080p professional final, 4K premium.'
      : '480p dahili test, 1080p profesyonel final, 4K premium.';
  }

  document.addEventListener('aivo:module-mounted',function(event){
    if(event&&event.detail&&event.detail.key==='adfilm')setTimeout(function(){apply(event.detail.root)},0);
  });
  document.addEventListener('aivo:adfilm-project-sync',function(){setTimeout(function(){apply()},0)});
  document.addEventListener('click',function(event){
    var lang=event.target&&event.target.closest&&event.target.closest('[data-aivo-language]');
    if(lang)setTimeout(function(){apply()},0);
  },true);

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(function(){apply()},200)},{once:true});
  else setTimeout(function(){apply()},200);

  window.AIVOAdFilmQualityPolicy={apply:apply};
})();
